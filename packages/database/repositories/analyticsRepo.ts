/*
 * Analytics Repository — event tracking and funnel aggregation.
 *
 * Event types tracked:
 *   page_view        — career site page visited
 *   job_list_view    — /jobs listing page viewed
 *   job_view         — individual job detail viewed
 *   apply_start      — apply modal opened
 *   apply_complete   — application successfully submitted
 *   search           — job search performed
 *   application_submit — alias for apply_complete (legacy)
 */

import { prisma } from "../client";

export interface TrackEventInput {
  type: string;
  tenantId: string;
  jobId?: string;
  pageSlug?: string;
  metadata?: Record<string, unknown>;
  sessionId?: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

export const analyticsRepo = {
  async track(event: TrackEventInput) {
    return prisma.analyticsEvent.create({
      data: {
        type: event.type,
        tenantId: event.tenantId,
        jobId: event.jobId,
        pageSlug: event.pageSlug,
        metadata: event.metadata ? JSON.stringify(event.metadata) : undefined,
        sessionId: event.sessionId,
        referrer: event.referrer,
        utmSource: event.utmSource,
        utmMedium: event.utmMedium,
        utmCampaign: event.utmCampaign,
      },
    });
  },

  async getJobViews(tenantId: string, days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    return prisma.analyticsEvent.groupBy({
      by: ["jobId"],
      where: {
        tenantId,
        type: "job_view",
        createdAt: { gte: since },
        jobId: { not: null },
      },
      _count: { jobId: true },
      orderBy: { _count: { jobId: "desc" } },
      take: 20,
    });
  },

  async getEventCounts(tenantId: string, days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    return prisma.analyticsEvent.groupBy({
      by: ["type"],
      where: {
        tenantId,
        createdAt: { gte: since },
      },
      _count: { type: true },
    });
  },

  async getSearchTerms(tenantId: string, days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const events = await prisma.analyticsEvent.findMany({
      where: {
        tenantId,
        type: "search",
        createdAt: { gte: since },
      },
      select: { metadata: true },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    // Parse metadata and aggregate search terms
    const termCounts = new Map<string, number>();
    for (const event of events) {
      try {
        const meta = typeof event.metadata === "string"
          ? JSON.parse(event.metadata)
          : event.metadata;
        const q = meta?.query;
        if (typeof q === "string" && q.trim()) {
          const term = q.trim().toLowerCase();
          termCounts.set(term, (termCounts.get(term) || 0) + 1);
        }
      } catch { /* skip malformed metadata */ }
    }

    return Array.from(termCounts.entries())
      .map(([term, count]) => ({ term, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 50);
  },

  async getDailyApplications(tenantId: string, days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const events = await prisma.analyticsEvent.findMany({
      where: {
        tenantId,
        type: "application_submit",
        createdAt: { gte: since },
      },
      select: { createdAt: true },
    });

    // Group by day
    const dayCounts = new Map<string, number>();
    for (const event of events) {
      const day = event.createdAt.toISOString().slice(0, 10);
      dayCounts.set(day, (dayCounts.get(day) || 0) + 1);
    }

    return Array.from(dayCounts.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  },

  /** Full funnel: page_view → job_list_view → job_view → apply_start → apply_complete */
  async getFunnelData(tenantId: string, days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const stages = [
      "page_view",
      "job_list_view",
      "job_view",
      "apply_start",
      "apply_complete",
    ] as const;

    const counts = await prisma.analyticsEvent.groupBy({
      by: ["type"],
      where: {
        tenantId,
        type: { in: [...stages] },
        createdAt: { gte: since },
      },
      _count: { type: true },
    });

    const countMap = new Map(counts.map((c) => [c.type, c._count.type]));

    return stages.map((stage) => ({
      stage,
      count: countMap.get(stage) ?? 0,
    }));
  },

  /** Group events by traffic source using dedicated utmSource / referrer columns */
  async getSourceBreakdown(tenantId: string, days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const events = await prisma.analyticsEvent.findMany({
      where: {
        tenantId,
        type: { in: ["page_view", "job_view"] },
        createdAt: { gte: since },
      },
      select: { utmSource: true, referrer: true },
      take: 5000,
    });

    const sourceCounts = new Map<string, number>();
    for (const event of events) {
      // Priority: UTM source > referrer hostname > "direct"
      let label = "direct";
      if (event.utmSource) {
        label = event.utmSource.slice(0, 40);
      } else if (event.referrer) {
        try {
          label = new URL(event.referrer).hostname.replace(/^www\./, "").slice(0, 40);
        } catch {
          label = event.referrer.slice(0, 40);
        }
      }
      sourceCounts.set(label, (sourceCounts.get(label) || 0) + 1);
    }

    return Array.from(sourceCounts.entries())
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  },

  /** Top jobs ranked by conversion rate (apply_complete / job_view) */
  async getTopJobsByConversion(tenantId: string, days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [views, completions] = await Promise.all([
      prisma.analyticsEvent.groupBy({
        by: ["jobId"],
        where: {
          tenantId,
          type: "job_view",
          createdAt: { gte: since },
          jobId: { not: null },
        },
        _count: { jobId: true },
      }),
      prisma.analyticsEvent.groupBy({
        by: ["jobId"],
        where: {
          tenantId,
          type: "apply_complete",
          createdAt: { gte: since },
          jobId: { not: null },
        },
        _count: { jobId: true },
      }),
    ]);

    const completionMap = new Map(completions.map((c) => [c.jobId, c._count.jobId]));

    return views
      .filter((v) => v.jobId && v._count.jobId >= 5)
      .map((v) => {
        const applyCount = completionMap.get(v.jobId!) ?? 0;
        const conversionRate = v._count.jobId > 0 ? applyCount / v._count.jobId : 0;
        return {
          jobId: v.jobId!,
          views: v._count.jobId,
          applications: applyCount,
          conversionRate: Math.round(conversionRate * 1000) / 10, // percentage, 1dp
        };
      })
      .sort((a, b) => b.applications - a.applications)
      .slice(0, 20);
  },

  /** Daily trend of key event types for chart rendering */
  async getDailyTrend(tenantId: string, days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const events = await prisma.analyticsEvent.findMany({
      where: {
        tenantId,
        type: { in: ["job_view", "apply_start", "apply_complete"] },
        createdAt: { gte: since },
      },
      select: { type: true, createdAt: true },
      orderBy: { createdAt: "asc" },
      take: 50000,
    });

    // Build map: date → { job_view, apply_start, apply_complete }
    const dayMap = new Map<string, Record<string, number>>();
    for (const event of events) {
      const day = event.createdAt.toISOString().slice(0, 10);
      if (!dayMap.has(day)) {
        dayMap.set(day, { job_view: 0, apply_start: 0, apply_complete: 0 });
      }
      const entry = dayMap.get(day)!;
      entry[event.type] = (entry[event.type] ?? 0) + 1;
    }

    return Array.from(dayMap.entries())
      .map(([date, counts]) => ({ date, ...counts }))
      .sort((a, b) => a.date.localeCompare(b.date));
  },
};
