/*
 * Salary Benchmark Repository — the ONE deliberate cross-tenant aggregate.
 *
 * Every other read path in this codebase is strictly tenant-scoped (no Postgres
 * RLS on SQLite/Turso — isolation is enforced in app code). The "Salary Truth"
 * market benchmark is the single intentional exception: it reads PUBLIC posted
 * salary ranges from PUBLISHED jobs across ALL tenants to build a market view.
 *
 * Hard rules (ADR-0002):
 *  - Only PUBLISHED jobs (their salary is already public on each tenant's site).
 *  - Returns raw comparable rows for SERVER-SIDE aggregation only. Callers MUST
 *    pass these through @career-builder/shared/salary-benchmark
 *    (computeSalaryBenchmark), which enforces k-anonymity (>= k jobs AND >= N
 *    tenants) and rounding BEFORE anything reaches a client. These rows must
 *    never be returned to a browser.
 *  - The current job is excluded so the benchmark is "this role vs the market".
 *
 * This repo lives in @career-builder/database and intentionally does NOT import
 * @career-builder/shared (that would invert the package layering); the pure
 * k-anonymity logic is applied by the web server layer that owns both deps.
 */

import { prisma } from "../client";

export interface ComparableSalaryQuery {
  /** Current job id — excluded from the market set. */
  jobId: string;
  /** Role family: matched exactly across tenants (v1). */
  department: string;
  experienceLevel: string;
  /** Only like-with-like is combined. */
  salaryCurrency: string;
  salaryPeriod: string;
}

/** A single comparable posting's public salary data (server-only). */
export interface ComparableSalaryRow {
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
  salaryPeriod: string;
  tenantId: string;
}

export const salaryBenchmarkRepo = {
  /**
   * Fetch PUBLIC posted salary data for comparable PUBLISHED jobs across ALL
   * tenants in the same role family (excluding the current job). Bounded by
   * `cap` for percentile stability and cost. SERVER-ONLY — see file header.
   */
  async findComparable(q: ComparableSalaryQuery, cap = 2000): Promise<ComparableSalaryRow[]> {
    return prisma.job.findMany({
      where: {
        isPublished: true,
        id: { not: q.jobId },
        department: q.department,
        experienceLevel: q.experienceLevel,
        salaryCurrency: q.salaryCurrency,
        salaryPeriod: q.salaryPeriod,
        salaryMin: { not: null },
        salaryMax: { not: null },
      },
      select: {
        salaryMin: true,
        salaryMax: true,
        salaryCurrency: true,
        salaryPeriod: true,
        tenantId: true,
      },
      // Deterministic, market-relevant sampling when the set exceeds `cap`:
      // most recent postings first (avoids DB-order bias in the percentiles).
      orderBy: { postedAt: "desc" },
      take: cap,
    });
  },
};
