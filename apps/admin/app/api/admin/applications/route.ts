/*
 * Admin Applications API — pipeline management.
 *
 * GET    /api/admin/applications           — list applications (filtered, paginated)
 * PATCH  /api/admin/applications           — update status, rating
 * DELETE /api/admin/applications?id=<id>   — delete an application
 */

import { NextResponse } from "next/server";
import { getSession, getSessionReadOnly, validateCsrf, writeAuditLog } from "@/lib/auth";
import { applicationRepo } from "@career-builder/database";
import { updateApplicationSchema, paginationSchema, safeParse } from "@career-builder/security/validate";
import { sanitizeString, sanitizeEmail } from "@career-builder/security/sanitize";
import { emailService } from "@career-builder/email";
import { getBlindHiringConfig, redactApplicants, redactApplicant } from "@/lib/blindHiring";

/** GET /api/admin/applications — list applications (recruiter+ only) */
export async function GET(req: Request) {
  const session = await getSessionReadOnly();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Viewers cannot access application data
  if (session.role === "viewer") {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);

  // Validate pagination params
  const pgParsed = safeParse(paginationSchema, {
    page: searchParams.get("page") ? parseInt(searchParams.get("page")!, 10) : 1,
    perPage: searchParams.get("perPage") ? parseInt(searchParams.get("perPage")!, 10) : 20,
  });
  let page = 1;
  let perPage = 20;
  if (pgParsed.success) {
    page = pgParsed.data.page ?? 1;
    perPage = pgParsed.data.perPage ?? 20;
  }

  const filters: {
    tenantId: string;
    jobId?: string;
    status?: string;
    email?: string;
    department?: string;
  } = {
    tenantId: session.tenantId,
  };

  const jobId = searchParams.get("jobId");
  if (jobId) filters.jobId = sanitizeString(jobId, 100);

  const status = searchParams.get("status");
  if (status) {
    const validStatuses = ["applied", "screening", "interview", "offer", "hired", "rejected"];
    if (validStatuses.includes(status)) filters.status = status;
  }

  const email = searchParams.get("email");
  if (email) filters.email = sanitizeEmail(email) || undefined;

  const department = searchParams.get("department");
  if (department) filters.department = sanitizeString(department, 100);

  const result = await applicationRepo.findByTenant(filters, page, perPage);
  const stats = await applicationRepo.countByStatus(session.tenantId);

  // Blind hiring: redact identifying fields server-side BEFORE the payload
  // leaves the API (default-deny). Recruiters never receive PII when on.
  const blind = await getBlindHiringConfig(session.tenantId);
  const applications = redactApplicants(result.data, blind);

  return NextResponse.json({
    applications,
    pagination: result.pagination,
    stats,
    blindHiring: blind.enabled,
  });
}

/** PATCH /api/admin/applications — update status or rating */
export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!["super_admin", "admin", "hiring_manager", "recruiter"].includes(session.role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const csrfValid = await validateCsrf(req);
  if (!csrfValid) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  const body = await req.json();

  // Validate with Zod schema
  const parsed = safeParse(updateApplicationSchema, body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { id, status, rating, notes } = parsed.data;

  // Verify application belongs to tenant
  const existing = await applicationRepo.findById(id);
  if (!existing || existing.tenantId !== session.tenantId) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  // Blind hiring: redact the response, and keep candidate names OUT of the
  // (long-lived) audit log so identity can't leak via the audit feed.
  const blind = await getBlindHiringConfig(session.tenantId);

  if (status) {
    const updated = await applicationRepo.updateStatus(id, status, notes ? sanitizeString(notes, 2000) : undefined);
    await writeAuditLog(
      session.userId,
      session.email,
      "application_status_change",
      `application ${id.slice(-6)}: ${existing.status} → ${status}`,
    );

    // Status email goes to the CANDIDATE about themselves — not redacted
    // (redaction protects RECRUITER views, not the candidate's own email).
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_WEB_URL || "http://localhost:3000";
    const companyName = process.env.NEXT_PUBLIC_COMPANY_NAME || "Our Company";
    emailService.sendStatusUpdate({
      candidateFirstName: existing.firstName,
      candidateEmail: existing.email,
      jobTitle: existing.job?.title || "the position",
      newStatus: status,
      companyName,
      siteUrl,
      message: notes ? sanitizeString(notes, 2000) : undefined,
    }).catch((err) => console.error("[applications] Status email failed:", err));

    return NextResponse.json({ application: redactApplicant(updated, blind) });
  }

  if (rating !== undefined) {
    const updated = await applicationRepo.updateRating(id, rating);
    return NextResponse.json({ application: redactApplicant(updated, blind) });
  }

  return NextResponse.json({ error: "No update provided" }, { status: 400 });
}

/** DELETE /api/admin/applications?id=<id> */
export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role !== "admin" && session.role !== "super_admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const csrfValid = await validateCsrf(req);
  if (!csrfValid) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id || typeof id !== "string" || id.length > 100) {
    return NextResponse.json({ error: "Application ID is required" }, { status: 400 });
  }

  const existing = await applicationRepo.findById(id);
  if (!existing || existing.tenantId !== session.tenantId) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  await applicationRepo.delete(id);
  await writeAuditLog(
    session.userId,
    session.email,
    "application_delete",
    `application ${id}`, // no candidate name — audit logs are long-lived
  );

  return NextResponse.json({ success: true });
}
