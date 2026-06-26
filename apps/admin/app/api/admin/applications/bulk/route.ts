/*
 * Bulk application actions.
 *
 * POST /api/admin/applications/bulk
 *   body: { ids: string[], action: "status" | "reject" | "export", status?, message? }
 *   - status : move all to a target stage
 *   - reject : move all to "rejected" + send a (optionally custom) email each
 *   - export : return a CSV of the selected applications
 *
 * Every id is re-verified against session.tenantId server-side (findManyByIds +
 * bulkUpdateStatus are tenant-scoped), so a spoofed/foreign id is silently
 * dropped — a bulk action can never touch another tenant's rows.
 */

import { NextResponse } from "next/server";
import { getSession, validateCsrf, writeAuditLog } from "@/lib/auth";
import { applicationRepo, eventRepo } from "@career-builder/database";
import { bulkApplicationActionSchema, safeParse } from "@career-builder/security/validate";
import { emailService } from "@career-builder/email";
import { applicationsToCsv } from "@/lib/csvExport";
import { getBlindHiringConfig, redactApplicants } from "@/lib/blindHiring";
import { visibleJobIds } from "@/lib/hiringTeams";
import { decisionLedgerRepo } from "@career-builder/database";
import { isEnabled } from "@career-builder/shared/feature-flags";
import { entriesFromRaw, seal as sealLedgerEntries } from "@career-builder/shared/decision-ledger";

const WRITE_ROLES = ["super_admin", "admin", "hiring_manager", "recruiter"];

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!WRITE_ROLES.includes(session.role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }
  if (!(await validateCsrf(req))) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = safeParse(bulkApplicationActionSchema, body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { ids, action, status } = parsed.data;

  // Tenant-scoped fetch — foreign/unknown ids are dropped here.
  const ownedRaw = await applicationRepo.findManyByIds(ids, session.tenantId);
  // Hiring-team scope (ADR-0020): drop rows for jobs this user can't access, so a
  // team-scoped recruiter can't bulk-act on applications outside their teams.
  const vis = await visibleJobIds(session);
  const owned = vis === null ? ownedRaw : ownedRaw.filter((a) => vis.includes(a.jobId));
  if (owned.length === 0) {
    return NextResponse.json({ error: "No matching applications." }, { status: 404 });
  }
  const ownedIds = owned.map((a) => a.id);

  /* ---- Export → CSV ---- */
  if (action === "export") {
    // Blind hiring redacts the export too — a CSV must never leak identity.
    const blind = await getBlindHiringConfig(session.tenantId);
    const csv = applicationsToCsv(redactApplicants(owned, blind));
    const filename = `applications-${new Date().toISOString().slice(0, 10)}.csv`;
    await writeAuditLog(session.userId, session.email, "application_bulk_export", `${owned.length} applications`);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  /* ---- Status / Reject → bulk update ---- */
  const targetStatus = action === "reject" ? "rejected" : status;
  if (!targetStatus) {
    return NextResponse.json({ error: "A target status is required." }, { status: 400 });
  }

  const updated = await applicationRepo.bulkUpdateStatus(ownedIds, session.tenantId, targetStatus);
  await writeAuditLog(
    session.userId,
    session.email,
    action === "reject" ? "application_bulk_reject" : "application_bulk_status",
    `${updated} application(s) → ${targetStatus}`,
  );

  // Structured candidate-visible events (ADR-0005) for the rows that changed.
  const changed = owned.filter((a) => a.status !== targetStatus);
  const eventsRecorded = Promise.allSettled(
    changed.map((a) =>
      eventRepo.record({
        tenantId: session.tenantId,
        applicationId: a.id,
        type: "status_change",
        fromStatus: a.status,
        toStatus: targetStatus,
        actorId: session.userId,
        actorType: "recruiter",
        visibility: "candidate",
      }),
    ),
  );
  eventsRecorded.catch((err) => console.error("[applications/bulk] event record failed:", err));

  // Decision Ledger (ADR-0027): seal a receipt for each row that reached a TERMINAL
  // status. Bulk has no per-record reason, so these seal statuses + screening only.
  // Best-effort, after the terminal events persist; never blocks the response.
  if (isEnabled("decision_ledger") && (targetStatus === "hired" || targetStatus === "rejected") && changed.length > 0) {
    void (async () => {
      try {
        await eventsRecorded;
        for (const a of changed) {
          try {
            const raw = await decisionLedgerRepo.buildInput(session.tenantId, a.id);
            const digest = sealLedgerEntries(entriesFromRaw(raw));
            await decisionLedgerRepo.storeSeal(session.tenantId, a.id, digest, new Date().toISOString());
          } catch (err) { console.error("[applications/bulk] seal failed:", a.id, err); }
        }
      } catch (err) { console.error("[applications/bulk] ledger seal batch failed:", err); }
    })();
  }

  // Reject: notify candidates (fire-and-forget; never block the response).
  // Bulk reject sends only the template's generic rejection copy. It has no
  // per-record disclosure opt-in, so an uncurated free-text message must NOT be
  // emailed to candidates ungated (ADR-0010) — candidate-facing rejection reasons
  // flow exclusively through the gated single-application adverse-action path.
  if (action === "reject") {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_WEB_URL || "http://localhost:3000";
    const companyName = process.env.NEXT_PUBLIC_COMPANY_NAME || "Our Company";
    Promise.allSettled(
      owned.map((a) =>
        emailService.sendStatusUpdate({
          candidateFirstName: a.firstName,
          candidateEmail: a.email,
          jobTitle: a.job?.title || "the position",
          newStatus: "rejected",
          companyName,
          siteUrl,
        }),
      ),
    ).catch((err) => console.error("[applications/bulk] reject emails failed:", err));
  }

  return NextResponse.json({ success: true, updated });
}
