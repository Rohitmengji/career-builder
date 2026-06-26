/*
 * GET /api/admin/analytics/hiring — hiring-velocity metrics (ADR-0017, B5).
 *
 * Median time-to-first-response / time-to-hire / time-to-decision, computed from
 * the ApplicationEvent spine (status_change events anchored at submittedAt) by the
 * pure shared/hiring-metrics. Recruiter+; tenant-scoped; flag-gated. Read-only.
 */

import { NextResponse } from "next/server";
import { getSessionReadOnly } from "@/lib/auth";
import { analyticsRepo } from "@career-builder/database";
import { isEnabled } from "@career-builder/shared/feature-flags";
import { computeHiringMetrics } from "@career-builder/shared/hiring-metrics";

const NO_STORE = { "Cache-Control": "no-store" } as const;

export async function GET() {
  if (!isEnabled("advanced_analytics")) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  const session = await getSessionReadOnly();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  if (session.role === "viewer") return NextResponse.json({ error: "Insufficient permissions" }, { status: 403, headers: NO_STORE });

  const timelines = await analyticsRepo.getApplicationTimelines(session.tenantId);
  return NextResponse.json({ metrics: computeHiringMetrics(timelines) }, { headers: NO_STORE });
}
