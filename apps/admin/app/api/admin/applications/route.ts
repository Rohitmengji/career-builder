/*
 * Admin Applications API — pipeline management.
 *
 * GET    /api/admin/applications           — list applications (filtered, paginated)
 * PATCH  /api/admin/applications           — update status, rating
 * DELETE /api/admin/applications?id=<id>   — delete an application
 */

import { NextResponse } from "next/server";
import { getSession, getSessionReadOnly, validateCsrf, writeAuditLog } from "@/lib/auth";
import { applicationRepo, eventRepo, adverseActionRepo, stageRepo, tagRepo } from "@career-builder/database";
import type { ApplicationFilters } from "@career-builder/database";
import { updateApplicationSchema, paginationSchema, safeParse } from "@career-builder/security/validate";
import { sanitizeString, sanitizeEmail } from "@career-builder/security/sanitize";
import { emailService } from "@career-builder/email";
import { getBlindHiringConfig, redactApplicants, redactApplicant } from "@/lib/blindHiring";
import { isEnabled } from "@career-builder/shared/feature-flags";
import { candidateLabel, type AdverseCategory } from "@career-builder/shared/adverse-action";
import { statusForStage } from "@career-builder/shared/pipeline";

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

  // Blind hiring config first — it gates whether free-text candidate search is
  // even allowed (searching identity/résumé fields would defeat blind hiring).
  const blind = await getBlindHiringConfig(session.tenantId);

  const filters: ApplicationFilters = { tenantId: session.tenantId };

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

  // Free-text candidate search (name / email / résumé text) — ONLY when blind
  // hiring is off; otherwise it's a de-anonymization bypass and is ignored.
  const q = searchParams.get("q");
  if (q && !blind.enabled) filters.q = sanitizeString(q, 100);

  // Tag filter (ADR-0016) — comma-separated tag ids, AND semantics. Only honoured
  // when the flag is on; foreign tag ids match nothing (tenant-scoped via the join).
  const tagsEnabled = isEnabled("application_tags");
  if (tagsEnabled) {
    const tagsParam = searchParams.get("tags");
    if (tagsParam) {
      const tagIds = tagsParam.split(",").map((t) => sanitizeString(t, 50)).filter(Boolean).slice(0, 50);
      if (tagIds.length > 0) filters.tags = tagIds;
    }
  }

  const result = await applicationRepo.findByTenant(filters, page, perPage);
  const stats = await applicationRepo.countByStatus(session.tenantId);

  // Redact identifying fields server-side BEFORE the payload leaves the API
  // (default-deny). Recruiters never receive PII when blind hiring is on.
  const applications = redactApplicants(result.data, blind);

  // Attach each application's tags — but NOT under blind hiring. Tags are free-text
  // recruiter labels rendered next to the candidate row; a label like "John — Google
  // referral" would re-identify a candidate the blind-hiring redaction just hid (same
  // de-anonymization risk as free-text search, which is also disabled above). So tags
  // are suppressed server-side whenever blind hiring is on (default-deny — a redaction
  // leak is Sev1). The tag FILTER still works (it matches by tag id, not label).
  if (tagsEnabled && !blind.enabled && applications.length > 0) {
    const tagMap = await tagRepo.listForApplications(
      session.tenantId,
      applications.map((a) => a.id),
    );
    for (const a of applications as Array<{ id: string; tags?: unknown }>) {
      a.tags = tagMap.get(a.id) ?? [];
    }
  }

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

  const { id, status, stageId, rating, notes, adverseAction } = parsed.data;

  // Verify application belongs to tenant
  const existing = await applicationRepo.findById(id);
  if (!existing || existing.tenantId !== session.tenantId) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  // Blind hiring: redact the response, and keep candidate names OUT of the
  // (long-lived) audit log so identity can't leak via the audit feed.
  const blind = await getBlindHiringConfig(session.tenantId);

  // Custom pipeline stage assignment (ADR-0015, flag-gated). `status` stays the
  // canonical 6-value field the reasoners use; a stage's `kind` derives it. The
  // specific stage is persisted in `stageId` (for the board), `status` for everyone else.
  let effStatus: typeof status = status;
  let assignStageId: string | null = null;
  if (stageId && isEnabled("custom_pipeline_stages")) {
    const stage = await stageRepo.findByIdScoped(stageId, session.tenantId);
    if (!stage) return NextResponse.json({ error: "Unknown stage." }, { status: 400 });
    assignStageId = stage.id;
    effStatus = statusForStage(stage) as typeof status;
  }

  if (effStatus) {
    if (assignStageId) {
      await applicationRepo.setStage(id, session.tenantId, assignStageId, effStatus);
    } else {
      await applicationRepo.updateStatus(id, effStatus, notes ? sanitizeString(notes, 2000) : undefined);
    }
    const updated = await applicationRepo.findByIdScoped(id, session.tenantId);
    if (!updated) return NextResponse.json({ error: "Application not found" }, { status: 404 });
    await writeAuditLog(
      session.userId,
      session.email,
      "application_status_change",
      `application ${id.slice(-6)}: ${existing.status} → ${effStatus}`,
    );

    // Structured, candidate-visible workflow event (ADR-0005) — powers the real
    // candidate timeline + accurate responsiveness timing. Best-effort.
    if (effStatus !== existing.status) {
      eventRepo
        .record({
          tenantId: session.tenantId,
          applicationId: id,
          type: "status_change",
          fromStatus: existing.status,
          toStatus: effStatus,
          actorId: session.userId,
          actorType: "recruiter",
          visibility: "candidate",
        })
        .catch((err) => console.error("[applications] event record failed:", err));
    }

    // Structured rejection reason (ADR-0010). Stored on reject; the recruiter's
    // per-record `sharedWithCandidate` intent is persisted as-is. Candidate display
    // (timeline + this email) is gated by the `adverse_action_disclosure` flag AND
    // that opt-in — so freeText is never auto-disclosed.
    let candidateRejectionMessage: string | undefined;
    if (effStatus === "rejected" && adverseAction) {
      try {
        await adverseActionRepo.upsert({
          tenantId: session.tenantId,
          applicationId: id,
          kind: "rejection",
          category: adverseAction.category,
          freeText: adverseAction.freeText ? sanitizeString(adverseAction.freeText, 5000) : null,
          stage: existing.status,
          sharedWithCandidate: !!adverseAction.sharedWithCandidate,
          candidateMessage: adverseAction.candidateMessage ? sanitizeString(adverseAction.candidateMessage, 2000) : null,
          decidedById: session.userId,
        });
        // Disclose to the candidate ONLY if the record persisted AND disclosure is
        // gated on (flag + per-record opt-in) — so the email and the in-app
        // "why we didn't move forward" view never diverge from the stored record.
        if (isEnabled("adverse_action_disclosure") && adverseAction.sharedWithCandidate) {
          candidateRejectionMessage =
            (adverseAction.candidateMessage && sanitizeString(adverseAction.candidateMessage, 2000)) ||
            candidateLabel(adverseAction.category as AdverseCategory);
        }
      } catch (err) {
        // Record failed → do NOT disclose anything (consistency over a half-written reason).
        console.error("[applications] adverse action record failed:", err);
      }
    }

    // Status email goes to the CANDIDATE about themselves — not redacted
    // (redaction protects RECRUITER views, not the candidate's own email).
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_WEB_URL || "http://localhost:3000";
    const companyName = process.env.NEXT_PUBLIC_COMPANY_NAME || "Our Company";
    emailService.sendStatusUpdate({
      candidateFirstName: existing.firstName,
      candidateEmail: existing.email,
      jobTitle: existing.job?.title || "the position",
      newStatus: effStatus,
      companyName,
      siteUrl,
      message: candidateRejectionMessage ?? (notes ? sanitizeString(notes, 2000) : undefined),
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
