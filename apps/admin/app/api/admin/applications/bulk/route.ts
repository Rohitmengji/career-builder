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
import { applicationRepo } from "@career-builder/database";
import { bulkApplicationActionSchema, safeParse } from "@career-builder/security/validate";
import { sanitizeString } from "@career-builder/security/sanitize";
import { emailService } from "@career-builder/email";
import { applicationsToCsv } from "@/lib/csvExport";
import { getBlindHiringConfig, redactApplicants } from "@/lib/blindHiring";

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

  const { ids, action, status, message } = parsed.data;

  // Tenant-scoped fetch — foreign/unknown ids are dropped here.
  const owned = await applicationRepo.findManyByIds(ids, session.tenantId);
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

  // Reject: notify candidates (fire-and-forget; never block the response).
  if (action === "reject") {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_WEB_URL || "http://localhost:3000";
    const companyName = process.env.NEXT_PUBLIC_COMPANY_NAME || "Our Company";
    const note = message ? sanitizeString(message, 2000) : undefined;
    Promise.allSettled(
      owned.map((a) =>
        emailService.sendStatusUpdate({
          candidateFirstName: a.firstName,
          candidateEmail: a.email,
          jobTitle: a.job?.title || "the position",
          newStatus: "rejected",
          companyName,
          siteUrl,
          message: note,
        }),
      ),
    ).catch((err) => console.error("[applications/bulk] reject emails failed:", err));
  }

  return NextResponse.json({ success: true, updated });
}
