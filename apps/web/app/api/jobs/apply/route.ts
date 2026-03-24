/*
 * Job Application API — handles the apply workflow.
 *
 * POST /api/jobs/apply
 * Accepts: multipart/form-data (with resume file) OR application/json
 * Fields: jobId, tenantId, firstName, lastName, email, phone, resumeUrl, coverLetter, linkedinUrl, resume (file)
 *
 * Returns: { success, applicationId? , error? }
 */

import { NextResponse } from "next/server";
import { getJobProvider } from "@/lib/jobs/provider";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { createApplicationSchema, safeParse } from "@career-builder/security/validate";
import { sanitizeString, sanitizeEmail, stripHtml } from "@career-builder/security/sanitize";
import { validateUpload, UPLOAD_PRESETS, isPathSafe } from "@career-builder/security/file-upload";
import { validateUrl } from "@career-builder/security/url";
import { getRateLimiter, getClientIp } from "@career-builder/security/rate-limit";
import { emailService } from "@career-builder/email";

export async function POST(request: Request) {
  try {
    // Rate limit — prevent abuse of public apply endpoint
    const limiter = getRateLimiter("public");
    const ip = getClientIp(request) || "unknown";
    const rl = limiter.check(`apply:${ip}`);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many applications. Please try again later." },
        { status: 429 },
      );
    }

    const contentType = request.headers.get("content-type") || "";

    let fields: Record<string, string> = {};
    let resumeFile: File | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      for (const [key, value] of formData.entries()) {
        if (key === "resume" && value instanceof File) {
          resumeFile = value;
        } else if (typeof value === "string") {
          fields[key] = value;
        }
      }
    } else {
      fields = await request.json();
    }

    // Validate required fields with Zod
    const parsed = safeParse(createApplicationSchema, fields);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error },
        { status: 400 },
      );
    }

    // Sanitize inputs
    const email = sanitizeEmail(parsed.data.email);
    if (!email) {
      return NextResponse.json(
        { success: false, error: "Invalid email format" },
        { status: 400 },
      );
    }

    // Validate resume: at least one of file or URL required
    const hasFile = resumeFile && resumeFile.size > 0;
    const hasUrl = parsed.data.resumeUrl && parsed.data.resumeUrl.trim().length > 0;
    if (!hasFile && !hasUrl) {
      return NextResponse.json(
        { success: false, error: "Resume is required (upload a file or provide a URL)" },
        { status: 400 },
      );
    }

    // Validate resume URL using SSRF-safe validator
    if (hasUrl) {
      const urlResult = validateUrl(parsed.data.resumeUrl!, { allowedProtocols: ["https:", "http:"] });
      if (!urlResult.valid) {
        return NextResponse.json(
          { success: false, error: `Invalid resume URL: ${urlResult.error}` },
          { status: 400 },
        );
      }
    }

    // Validate LinkedIn URL if provided
    if (parsed.data.linkedinUrl) {
      const linkedinResult = validateUrl(parsed.data.linkedinUrl, {
        allowedProtocols: ["https:"],
        allowedHosts: ["linkedin.com", "www.linkedin.com"],
      });
      if (!linkedinResult.valid) {
        return NextResponse.json(
          { success: false, error: `Invalid LinkedIn URL: ${linkedinResult.error}` },
          { status: 400 },
        );
      }
    }

    // Validate resume file using security package — magic bytes + extension + size
    let savedResumeUrl = parsed.data.resumeUrl?.trim() || "";
    if (hasFile && resumeFile) {
      const buffer = Buffer.from(await resumeFile.arrayBuffer());
      const validation = validateUpload(
        { name: resumeFile.name, size: resumeFile.size, type: resumeFile.type },
        buffer,
        UPLOAD_PRESETS.resume,
      );

      if (!validation.valid) {
        return NextResponse.json(
          { success: false, error: validation.error },
          { status: 400 },
        );
      }

      const uploadDir = path.join(process.cwd(), "data", "resumes");
      await mkdir(uploadDir, { recursive: true });

      const filename = validation.safeFilename!;

      // Verify path safety
      if (!isPathSafe(filename, uploadDir)) {
        return NextResponse.json(
          { success: false, error: "Invalid file path" },
          { status: 400 },
        );
      }

      const filePath = path.join(uploadDir, filename);
      await writeFile(filePath, buffer);

      savedResumeUrl = `/data/resumes/${filename}`;
    }

    const provider = getJobProvider();
    const result = await provider.apply({
      jobId: sanitizeString(parsed.data.jobId, 100),
      tenantId: sanitizeString(parsed.data.tenantId || "default", 50),
      firstName: sanitizeString(parsed.data.firstName, 100),
      lastName: sanitizeString(parsed.data.lastName, 100),
      email,
      phone: sanitizeString(parsed.data.phone || "", 30),
      resumeUrl: savedResumeUrl,
      coverLetter: parsed.data.coverLetter ? stripHtml(parsed.data.coverLetter) : "",
      linkedinUrl: parsed.data.linkedinUrl?.trim() || "",
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    // ── Send email notifications (fire-and-forget — don't block response) ──
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
    const adminUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.ADMIN_API_URL || "http://localhost:3001";
    const companyName = process.env.NEXT_PUBLIC_COMPANY_NAME || "Our Company";

    // Fetch job details for the email (best-effort)
    const jobProvider = getJobProvider();
    let jobTitle = "the position";
    let jobDepartment = "";
    let jobLocation = "";
    try {
      const jobDetail = await jobProvider.getById(sanitizeString(parsed.data.jobId, 100));
      if (jobDetail?.job) {
        jobTitle = jobDetail.job.title;
        jobDepartment = jobDetail.job.department;
        jobLocation = jobDetail.job.location;
      }
    } catch { /* best-effort */ }

    // Fire both emails concurrently — don't await (non-blocking)
    Promise.allSettled([
      emailService.sendApplicationConfirmation({
        candidateFirstName: sanitizeString(parsed.data.firstName, 100),
        candidateLastName: sanitizeString(parsed.data.lastName, 100),
        candidateEmail: email,
        jobTitle,
        companyName,
        applicationId: result.applicationId || "",
        siteUrl,
      }),
      emailService.sendApplicationNotification({
        candidateFirstName: sanitizeString(parsed.data.firstName, 100),
        candidateLastName: sanitizeString(parsed.data.lastName, 100),
        candidateEmail: email,
        candidatePhone: sanitizeString(parsed.data.phone || "", 30),
        candidateLinkedin: parsed.data.linkedinUrl?.trim() || "",
        jobTitle,
        jobDepartment,
        jobLocation,
        companyName,
        applicationId: result.applicationId || "",
        resumeUrl: savedResumeUrl,
        coverLetter: parsed.data.coverLetter ? stripHtml(parsed.data.coverLetter) : "",
        adminUrl,
      }),
    ]).catch((err) => console.error("[apply] Email send error:", err));

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("[API /api/jobs/apply] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
