/*
 * Admin Analytics API — dashboard data.
 *
 * GET /api/admin/analytics — aggregated analytics data
 */

import { NextResponse } from "next/server";
import { getSessionReadOnly } from "@/lib/auth";
import { analyticsRepo, applicationRepo, jobRepo, tenantRepo } from "@career-builder/database";

/** GET /api/admin/analytics — dashboard metrics */
export async function GET() {
  const session = await getSessionReadOnly();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.tenantId;

  const [
    tenantStats,
    pipelineStats,
    recentApplications,
    jobViews,
    searchTerms,
    dailyApplications,
    eventCounts,
    funnelData,
    sourceBreakdown,
    topJobsByConversion,
    dailyTrend,
  ] = await Promise.all([
    tenantRepo.getStats(tenantId),
    applicationRepo.countByStatus(tenantId),
    applicationRepo.getRecentByTenant(tenantId, 10),
    analyticsRepo.getJobViews(tenantId, 30),
    analyticsRepo.getSearchTerms(tenantId, 30),
    analyticsRepo.getDailyApplications(tenantId, 30),
    analyticsRepo.getEventCounts(tenantId, 30),
    analyticsRepo.getFunnelData(tenantId, 30),
    analyticsRepo.getSourceBreakdown(tenantId, 30),
    analyticsRepo.getTopJobsByConversion(tenantId, 30),
    analyticsRepo.getDailyTrend(tenantId, 30),
  ]);

  return NextResponse.json({
    overview: tenantStats,
    pipeline: pipelineStats,
    recentApplications,
    jobViews,
    searchTerms,
    dailyApplications,
    eventCounts,
    funnelData,
    sourceBreakdown,
    topJobsByConversion,
    dailyTrend,
  });
}
