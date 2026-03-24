/*
 * Analytics Repository — event tracking and aggregation.
 */

import { prisma } from "../client";

export interface TrackEventInput {
  type: string;
  tenantId: string;
  jobId?: string;
  pageSlug?: string;
  metadata?: Record<string, unknown>;
  sessionId?: string;
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
};
