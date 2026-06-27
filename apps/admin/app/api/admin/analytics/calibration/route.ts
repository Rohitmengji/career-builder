/*
 * GET /api/admin/analytics/calibration — interviewer calibration (ADR-0028).
 *
 * Per-interviewer leniency/harshness vs the panel on shared candidates, computed by
 * the pure shared/rater-calibration engine from this tenant's scorecard ratings.
 * MANAGER+ only (it names evaluators — a team-quality tool, not for every recruiter);
 * tenant-scoped; flag-gated (rater_calibration); read-only; min-sample suppressed.
 * Internal-only — about staff evaluators, contains NO candidate PII.
 */

import { NextResponse } from "next/server";
import { getSessionReadOnly } from "@/lib/auth";
import { scorecardRepo } from "@career-builder/database";
import { isEnabled } from "@career-builder/shared/feature-flags";
import { computeRaterCalibration } from "@career-builder/shared/rater-calibration";

const NO_STORE = { "Cache-Control": "no-store" } as const;
const MANAGE_ROLES = ["super_admin", "admin", "hiring_manager"];

export async function GET() {
  if (!isEnabled("rater_calibration")) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  const session = await getSessionReadOnly();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  // Manager+ only — leniency is a per-evaluator signal; don't expose it to all recruiters.
  if (!MANAGE_ROLES.includes(session.role)) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403, headers: NO_STORE });

  const rows = await scorecardRepo.getCalibrationRows(session.tenantId);
  return NextResponse.json({ calibration: computeRaterCalibration(rows) }, { headers: NO_STORE });
}
