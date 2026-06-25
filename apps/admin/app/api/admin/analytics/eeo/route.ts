/*
 * GET /api/admin/analytics/eeo — aggregate EEO report (ADR-0013).
 *
 * ADMIN-ONLY (stricter than recruiter) — EEO data is sensitive HR/compliance data.
 * Returns ONLY the small-cell + complementary-suppressed aggregate (never individual
 * rows). The raw demographic rows never leave the server unsuppressed. Flag-gated.
 */

import { NextResponse } from "next/server";
import { getSessionReadOnly } from "@/lib/auth";
import { eeoRepo } from "@career-builder/database";
import { isEnabled } from "@career-builder/shared/feature-flags";
import { computeEeoAggregate } from "@career-builder/shared/eeo-aggregate";

const NO_STORE = { "Cache-Control": "no-store" } as const;
const REPORT_ROLES = ["super_admin", "admin"]; // EEO reports are admin-only

export async function GET() {
  if (!isEnabled("eeo_self_id")) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  const session = await getSessionReadOnly();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  if (!REPORT_ROLES.includes(session.role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403, headers: NO_STORE });
  }

  const rows = await eeoRepo.listForAggregate(session.tenantId);
  // Suppress BEFORE responding — only the aggregate ever leaves the server.
  return NextResponse.json({ aggregate: computeEeoAggregate(rows) }, { headers: NO_STORE });
}
