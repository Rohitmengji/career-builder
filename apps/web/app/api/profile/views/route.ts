/*
 * GET /api/profile/views — the candidate-visible "who viewed me" log.
 *
 * The trust proof point of blind hiring: a candidate sees who on the hiring team
 * has viewed their application(s). Scoped to the logged-in candidate's own
 * applications (matched by email within their tenant); returns only viewer name
 * + timestamp — never the wider staff audit log.
 */

import { NextResponse } from "next/server";
import { getCurrentCandidate } from "@/lib/candidateAuth";
import { applicationRepo, auditRepo } from "@career-builder/database";

export async function GET() {
  const candidate = await getCurrentCandidate();
  if (!candidate) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const appIds = await applicationRepo.findIdsByEmail(candidate.tenantId, candidate.email);
  const views = await auditRepo.findProfileViews(candidate.tenantId, appIds);

  return NextResponse.json(
    { views },
    { headers: { "Cache-Control": "no-store" } },
  );
}
