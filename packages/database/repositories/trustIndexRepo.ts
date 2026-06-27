/*
 * Trust Index Repository (ADR-0029) — a deliberate CROSS-TENANT aggregate (the second,
 * after salaryBenchmarkRepo). Builds the anonymized market for the Employer Trust Index.
 *
 * Hard rules (mirror ADR-0002):
 *  - Returns per-tenant metric VALUES ONLY — never a tenantId, never raw rows. The
 *    viewing tenant is EXCLUDED so it can't trivially back out others.
 *  - Computed from AGGREGATE COUNTS (groupBy), never by pulling application rows — no
 *    PII leaves the DB. v1 metric = responsiveness (responded / settled), the public
 *    "we don't ghost" rate (ADR-0003).
 *  - k-anonymity (>= TRUST_MIN_TENANTS = 10 distinct tenants) is enforced by the shared layer
 *    (trust-index.benchmarkMetric) BEFORE anything reaches a client. These values
 *    must never be returned to a browser directly.
 *  - Does NOT import @career-builder/shared (package layering); the SLA cutoff +
 *    min-settled floor are passed in by the server layer that owns the shared deps,
 *    so the market uses the SAME definitions as the tenant's own responsiveness score.
 */

import { prisma } from "../client";

export const trustIndexRepo = {
  /**
   * Per-tenant responsiveness rates (0–100) across ALL OTHER tenants, for tenants with
   * at least `minSettled` settled applications. Anonymized (no tenant identity).
   * SERVER-ONLY — pass through shared/trust-index for k-anon before any client.
   */
  async getMarketResponsivenessRates(opts: {
    excludeTenantId: string;
    cutoff: Date;
    minSettled: number;
    /** The canonical "responded" statuses — passed from the server layer so the market
     *  uses the EXACT same closed allow-list as the per-tenant badge (no open
     *  "anything != applied" rule that a future non-canonical status could skew). */
    respondedStatuses: string[];
  }): Promise<number[]> {
    const notViewer = { tenantId: { not: opts.excludeTenantId } };

    const [statusCounts, ghostCounts] = await Promise.all([
      // responded = applications in a whitelisted "heard back" status (closed allow-list).
      prisma.application.groupBy({
        by: ["tenantId"],
        where: { ...notViewer, status: { in: opts.respondedStatuses } },
        _count: { _all: true },
      }),
      // ghosted = still "applied" AND older than the SLA cutoff (unanswered too long).
      prisma.application.groupBy({
        by: ["tenantId"],
        where: { ...notViewer, status: "applied", submittedAt: { lt: opts.cutoff } },
        _count: { _all: true },
      }),
    ]);

    const respondedByTenant = new Map<string, number>();
    for (const row of statusCounts) {
      respondedByTenant.set(row.tenantId, row._count._all);
    }
    const ghostedByTenant = new Map<string, number>();
    for (const row of ghostCounts) ghostedByTenant.set(row.tenantId, row._count._all);

    const tenantIds = new Set<string>([...respondedByTenant.keys(), ...ghostedByTenant.keys()]);
    const rates: number[] = [];
    for (const t of tenantIds) {
      const responded = respondedByTenant.get(t) ?? 0;
      const ghosted = ghostedByTenant.get(t) ?? 0;
      const settled = responded + ghosted;
      if (settled < opts.minSettled) continue; // same floor as the per-tenant badge
      rates.push(Math.round((responded / settled) * 100));
    }
    return rates;
  },

  /**
   * The VIEWER's own responsiveness, computed the SAME all-time count way as the market
   * (so the comparison is apples-to-apples — the per-tenant badge's recent-5000 window
   * would skew the percentile for high-volume tenants). Tenant-scoped.
   */
  async getTenantResponsivenessRate(tenantId: string, opts: {
    cutoff: Date;
    minSettled: number;
    respondedStatuses: string[];
  }): Promise<{ available: boolean; responseRate: number; sampleSize: number }> {
    const [responded, ghosted] = await Promise.all([
      prisma.application.count({ where: { tenantId, status: { in: opts.respondedStatuses } } }),
      prisma.application.count({ where: { tenantId, status: "applied", submittedAt: { lt: opts.cutoff } } }),
    ]);
    const settled = responded + ghosted;
    if (settled < opts.minSettled) return { available: false, responseRate: 0, sampleSize: settled };
    return { available: true, responseRate: Math.round((responded / settled) * 100), sampleSize: settled };
  },
};
