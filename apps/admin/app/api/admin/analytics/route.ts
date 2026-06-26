/*
 * Admin Analytics API — dashboard data.
 *
 * GET /api/admin/analytics — aggregated analytics data
 */

import { NextResponse } from "next/server";
import { getSessionReadOnly } from "@/lib/auth";
import { analyticsRepo, applicationRepo, tenantRepo } from "@career-builder/database";
import { withRequestLogging } from "@career-builder/observability/request-logger";
import { logger } from "@career-builder/observability/logger";
import { getBlindHiringConfig, redactApplicants } from "@/lib/blindHiring";
import { visibleJobIds } from "@/lib/hiringTeams";

const log = logger.api;

/** GET /api/admin/analytics — dashboard metrics */
export const GET = withRequestLogging(async () => {
  const session = await getSessionReadOnly();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.tenantId;

  try {
    // Hiring-team scope (ADR-0020): the "recent applications" widget carries candidate
    // identity, so restrict it to the user's team jobs (null = no restriction). The
    // remaining aggregates are non-PII org-level counts and stay org-wide by design.
    const vis = await visibleJobIds(session);
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
      applicationRepo.getRecentByTenant(tenantId, 10, vis ?? undefined),
      analyticsRepo.getJobViews(tenantId, 30),
      analyticsRepo.getSearchTerms(tenantId, 30),
      analyticsRepo.getDailyApplications(tenantId, 30),
      analyticsRepo.getEventCounts(tenantId, 30),
      analyticsRepo.getFunnelData(tenantId, 30),
      analyticsRepo.getSourceBreakdown(tenantId, 30),
      analyticsRepo.getTopJobsByConversion(tenantId, 30),
      analyticsRepo.getDailyTrend(tenantId, 30),
    ]);

    // Blind hiring: the "recent applications" widget must not expose identity.
    const blind = await getBlindHiringConfig(tenantId);

    return NextResponse.json({
      overview: tenantStats,
      pipeline: pipelineStats,
      recentApplications: redactApplicants(recentApplications, blind),
      jobViews,
      searchTerms,
      dailyApplications,
      eventCounts,
      funnelData,
      sourceBreakdown,
      topJobsByConversion,
      dailyTrend,
    });
  } catch (err: any) {
    log.error("analytics_fetch_failed", { tenantId, err: err.message, stack: err.stack });
    return NextResponse.json({ error: "Failed to load analytics" }, { status: 500 });
  }
});
