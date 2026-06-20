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
import path from "path";
import { createStorage } from "@career-builder/shared/storage";
import { createApplicationSchema, safeParse } from "@career-builder/security/validate";
import { sanitizeString, sanitizeEmail, stripHtml } from "@career-builder/security/sanitize";
import { validateUpload, UPLOAD_PRESETS, isPathSafe } from "@career-builder/security/file-upload";
import { extractResumeText } from "@/lib/resume/extract";
import { validateUrl } from "@career-builder/security/url";
import { getRateLimiter, getClientIp } from "@career-builder/security/rate-limit";
import { emailService } from "@career-builder/email";
import { getKV } from "@career-builder/shared/kv";
import { getWebTenantId, isMultiTenantWeb, getWebTenantEmailSettings } from "@/lib/tenant-runtime";
import type { ApplyResponse } from "@/lib/jobs/types";

// Application submissions are never cacheable.
const NO_STORE = { "Cache-Control": "no-store" } as const;

function json(body: ApplyResponse, status: number) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

/** Structured security log (rate-limit, tenant-spoof) — greppable, no PII. */
function logSecurity(event: string, detail: Record<string, string | number>) {
  console.warn(`[security][apply] ${event}`, JSON.stringify(detail));
}

// Idempotency: a client sends a stable Idempotency-Key per attempt; we cache the
// outcome so a retry/refresh of the SAME attempt can't create a second record.
const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;
const idempotencyKeyFor = (tenantId: string, key: string) => `apply:idem:${tenantId}:${key}`;

export async function POST(request: Request) {
  try {
    // Resolve the tenant for THIS request from the host (env pin when the
    // multi_tenant_web flag is off). This — not any client-supplied value — is
    // the tenant the application is persisted under.
    const resolvedTenantId = await getWebTenantId();

    // Rate limit — prevent abuse of public apply endpoint. Scoped per tenant so
    // one tenant's traffic can't exhaust another's budget.
    const limiter = getRateLimiter("public");
    const ip = getClientIp(request) || "unknown";
    const rl = limiter.check(`apply:${resolvedTenantId}:${ip}`);
    if (!rl.allowed) {
      logSecurity("rate_limited", { tenantId: resolvedTenantId, ip });
      return json(
        { success: false, error: "Too many applications. Please try again later." },
        429,
      );
    }

    // Idempotency: short-circuit a repeat of the same attempt (retry/refresh)
    // before re-uploading the file or re-creating the record. KV failures degrade
    // gracefully (the natural dedup in the provider is the backstop).
    const idempotencyKey = request.headers.get("idempotency-key")?.trim().slice(0, 200) || "";
    const kv = getKV();
    if (idempotencyKey) {
      try {
        const cached = await kv.get(idempotencyKeyFor(resolvedTenantId, idempotencyKey));
        if (cached) {
          return json({ success: true, applicationId: cached, duplicate: true }, 200);
        }
      } catch {
        /* KV unavailable — continue without idempotency short-circuit */
      }
    }

    const contentType = request.headers.get("content-type") || "";

    let fields: Record<string, string> = {};
    let resumeFile: File | null = null;

    try {
      if (contentType.includes("multipart/form-data")) {
        const formData = await request.formData();
        for (const [key, value] of formData.entries()) {
          if (key === "resume" && value instanceof File) {
            resumeFile = value;
          } else if (typeof value === "string") {
            fields[key] = value;
          }
        }
      } else if (contentType.includes("application/json")) {
        fields = await request.json();
      } else {
        return json({ success: false, error: "Unsupported content type." }, 415);
      }
    } catch {
      // Malformed multipart/JSON body.
      return json({ success: false, error: "We couldn't read the submitted form. Please try again." }, 400);
    }

    // Validate required fields with Zod
    const parsed = safeParse(createApplicationSchema, fields);
    if (!parsed.success) {
      return json({ success: false, error: parsed.error }, 400);
    }

    // Isolation: never trust a client-supplied tenantId. When multi-tenant is
    // active, an explicit tenantId that disagrees with the host is rejected
    // (a spoof attempt) rather than silently coerced.
    const clientTenantId = parsed.data.tenantId
      ? sanitizeString(parsed.data.tenantId, 50)
      : "";
    if (isMultiTenantWeb() && clientTenantId && clientTenantId !== resolvedTenantId) {
      logSecurity("tenant_mismatch", { host: resolvedTenantId, claimed: clientTenantId, ip });
      return json(
        { success: false, error: "This application can't be submitted from here. Please reload the page and try again." },
        403,
      );
    }

    // Sanitize inputs
    const email = sanitizeEmail(parsed.data.email);
    if (!email) {
      return json({ success: false, error: "Please enter a valid email address." }, 400);
    }

    // Validate resume: at least one of file or URL required
    const hasFile = resumeFile && resumeFile.size > 0;
    const hasUrl = parsed.data.resumeUrl && parsed.data.resumeUrl.trim().length > 0;
    if (!hasFile && !hasUrl) {
      return json(
        { success: false, error: "Please upload a resume file or provide a resume URL." },
        400,
      );
    }

    // Validate resume URL using SSRF-safe validator
    if (hasUrl) {
      const urlResult = validateUrl(parsed.data.resumeUrl!, { allowedProtocols: ["https:", "http:"] });
      if (!urlResult.valid) {
        return json({ success: false, error: `Invalid resume URL: ${urlResult.error}` }, 400);
      }
    }

    // Validate LinkedIn URL if provided
    if (parsed.data.linkedinUrl) {
      const linkedinResult = validateUrl(parsed.data.linkedinUrl, {
        allowedProtocols: ["https:"],
        allowedHosts: ["linkedin.com", "www.linkedin.com"],
      });
      if (!linkedinResult.valid) {
        return json({ success: false, error: `Invalid LinkedIn URL: ${linkedinResult.error}` }, 400);
      }
    }

    // Validate resume file using security package — magic bytes + extension + size
    let savedResumeUrl = parsed.data.resumeUrl?.trim() || "";
    let resumeText: string | null = null;
    if (hasFile && resumeFile) {
      const buffer = Buffer.from(await resumeFile.arrayBuffer());
      const validation = validateUpload(
        { name: resumeFile.name, size: resumeFile.size, type: resumeFile.type },
        buffer,
        UPLOAD_PRESETS.resume,
      );

      if (!validation.valid) {
        return json({ success: false, error: validation.error }, 400);
      }

      const uploadDir = path.join(process.cwd(), "data", "resumes");
      const filename = validation.safeFilename!;

      // Verify path safety
      if (!isPathSafe(filename, uploadDir)) {
        logSecurity("unsafe_file_path", { tenantId: resolvedTenantId, ip });
        return json({ success: false, error: "Invalid file." }, 400);
      }

      // Route through the storage abstraction: durable object storage in
      // production (STORAGE_DRIVER=blob|s3), local filesystem in dev.
      const storage = createStorage({
        localDir: uploadDir,
        localPublicPrefix: "/data/resumes",
        keyPrefix: "resumes",
        tenantId: resolvedTenantId, // cloud keys → t/<tenantId>/resumes/<file>
      });
      const stored = await storage.put(filename, buffer, resumeFile.type || "application/octet-stream");
      savedResumeUrl = stored.url;

      // Best-effort resume text extraction (PDF / plain text). Fail-safe: returns
      // null and NEVER blocks the application. Runs on the validated buffer.
      resumeText = await extractResumeText({
        bytes: buffer,
        mimeType: resumeFile.type || "",
      });
    }

    const provider = getJobProvider();
    const result = await provider.apply({
      jobId: sanitizeString(parsed.data.jobId, 100),
      tenantId: resolvedTenantId, // host-resolved; not the client value
      firstName: sanitizeString(parsed.data.firstName, 100),
      lastName: sanitizeString(parsed.data.lastName, 100),
      email,
      phone: sanitizeString(parsed.data.phone || "", 30),
      resumeUrl: savedResumeUrl,
      ...(resumeText ? { resumeText } : {}),
      coverLetter: parsed.data.coverLetter ? stripHtml(parsed.data.coverLetter) : "",
      linkedinUrl: parsed.data.linkedinUrl?.trim() || "",
    });

    if (!result.success) {
      // Map the provider's machine-readable reason to an accurate status.
      const status = result.code === "job_not_found" ? 404 : result.code === "duplicate" ? 409 : 400;
      return json(result, status);
    }

    // Record the idempotency outcome so a retry of THIS attempt is a no-op.
    if (idempotencyKey && result.applicationId) {
      try {
        await kv.set(
          idempotencyKeyFor(resolvedTenantId, idempotencyKey),
          result.applicationId,
          IDEMPOTENCY_TTL_SECONDS,
        );
      } catch {
        /* best-effort */
      }
    }

    // ── Send email notifications (fire-and-forget — don't block response) ──
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
    const adminUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.ADMIN_API_URL || "http://localhost:3001";
    const companyName = process.env.NEXT_PUBLIC_COMPANY_NAME || "Our Company";

    // Fetch job details for the email (best-effort, tenant-scoped)
    const jobProvider = getJobProvider();
    let jobTitle = "the position";
    let jobDepartment = "";
    let jobLocation = "";
    try {
      const jobDetail = await jobProvider.getById(sanitizeString(parsed.data.jobId, 100), resolvedTenantId);
      if (jobDetail?.job) {
        jobTitle = jobDetail.job.title;
        jobDepartment = jobDetail.job.department;
        jobLocation = jobDetail.job.location;
      }
    } catch { /* best-effort */ }

    // Per-tenant sender (from + admin inbox); platform default when unset/unverified.
    const tenantSender = await getWebTenantEmailSettings();

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
      }, tenantSender),
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
      }, tenantSender),
    ]).catch((err) => console.error("[apply] Email send error:", err));

    return json(result, 201);
  } catch (error) {
    // Log full detail server-side only; never expose internals to the client.
    console.error("[API /api/jobs/apply] Error:", error);
    return json(
      { success: false, error: "Unable to submit your application right now. Please try again in a few minutes." },
      500,
    );
  }
}
