/*
 * GET /api/admin/applications/[id]/portable-record — the candidate's VERIFIED
 * cross-platform track record (ADR-0030), shown to a recruiter ONLY when the candidate
 * has granted it.
 *
 * Gates (all required): flag portable_record; recruiter+ session; the application is
 * this tenant's (findByIdScoped) AND the recruiter may access its job (hiring-team
 * scope, ADR-0020); AND a CURRENT portable_profile_share consent grant exists for
 * (this tenant, the candidate's email) — a revocation (granted=false) fails closed.
 *
 * Returns COUNTS ONLY (employers / applications / interviews / offers / hires across the
 * platform — never which employers, never another candidate, never recruiter data).
 */

import { NextResponse } from "next/server";
import { getSessionReadOnly } from "@/lib/auth";
import { applicationRepo, consentRepo, portableRepo } from "@career-builder/database";
import { isEnabled } from "@career-builder/shared/feature-flags";
import { computeFootprint } from "@career-builder/shared/portable-record";
import { canAccessJob } from "@/lib/hiringTeams";

const NO_STORE = { "Cache-Control": "no-store" } as const;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isEnabled("portable_record")) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  const session = await getSessionReadOnly();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  if (session.role === "viewer") return NextResponse.json({ error: "Insufficient permissions" }, { status: 403, headers: NO_STORE });

  const { id } = await params;
  // The application must be this tenant's AND accessible to this recruiter's team.
  const app = await applicationRepo.findByIdScoped(id, session.tenantId);
  if (!app || !(await canAccessJob(session, app.jobId))) return NextResponse.json({ error: "Application not found" }, { status: 404, headers: NO_STORE });

  // The candidate must have a CURRENT grant for THIS tenant (revocation fails closed).
  const consent = await consentRepo.currentFor(session.tenantId, app.email);
  if (consent.portable_profile_share !== true) {
    return NextResponse.json({ shared: false, footprint: null }, { headers: NO_STORE });
  }

  // Counts-only footprint over the candidate's OWN applications across the platform.
  const rows = await portableRepo.getOwnApplicationsAcrossTenants(app.email);
  return NextResponse.json({ shared: true, footprint: computeFootprint(rows) }, { headers: NO_STORE });
}
