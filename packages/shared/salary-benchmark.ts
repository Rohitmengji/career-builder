/*
 * @career-builder/shared/salary-benchmark — k-anonymized market pay benchmarks.
 *
 * Pure, framework-agnostic aggregation behind the "Salary Truth" feature. Given
 * a set of PUBLIC posted salary ranges from comparable published jobs across the
 * market, produce a market median range + (optionally) where a given posting
 * falls — WITHOUT ever exposing any individual salary or which tenants
 * contributed.
 *
 * The privacy guarantees live here (ADR-0002), so they are unit-testable in
 * isolation from the DB:
 *   - k-anonymity: suppress unless >= K_ANON_MIN contributing jobs AND
 *     >= MIN_TENANTS distinct tenants contribute.
 *   - rounding: published percentiles are rounded to ROUND_TO so no exact
 *     competitor figure is recoverable from the aggregate.
 *   - currency/period safety: only same-currency, same-period data is combined.
 */

/** Minimum contributing jobs before any aggregate is shown (brief: k=5). */
export const K_ANON_MIN = 5;
/** Minimum distinct tenants — one company's spread must not be "the market". */
export const MIN_TENANTS = 3;
/**
 * No single tenant may contribute more than this fraction of the sample. Stops
 * an asymmetric pool (e.g. 3 jobs from one company + 1 each from two others)
 * where the dominant contributor could back out the others from the aggregate.
 */
export const MAX_TENANT_SHARE = 0.5;

/**
 * Rounding granularity for published market figures, per pay period — defeats
 * pinpoint de-anonymization. Period-aware because a flat 1,000 would round every
 * hourly wage to $0 and barely perturb six-figure annual salaries.
 */
export function roundStepFor(period: string): number {
  switch (period) {
    case "hourly":
      return 1;
    case "monthly":
      return 500;
    case "yearly":
    default:
      return 5000;
  }
}

/** One comparable posting's PUBLIC salary data (already filtered to a role family upstream). */
export interface SalaryDatum {
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
  salaryPeriod: string;
  tenantId: string;
}

/** The current job we're contextualizing (its own posting; may lack a salary). */
export interface BenchmarkSubject {
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
  salaryPeriod: string;
}

export interface SalaryBenchmark {
  /** false when k-anonymity suppressed the aggregate (too few jobs/tenants). */
  available: boolean;
  /**
   * Number of comparable jobs that contributed. SERVER-ONLY signal (logging /
   * decisions) — MUST NOT be rendered to a client: exposing the exact count at
   * the k-anonymity floor enables small-sample de-anonymization.
   */
  sampleSize: number;
  currency: string;
  period: string;
  /** Market percentiles of comparable posted midpoints, rounded. null if suppressed. */
  market: { p25: number; p50: number; p75: number } | null;
  /** This posting's representative pay (midpoint), if it posted one; else null. */
  posted: number | null;
  /** Where `posted` falls in the market, 0–100. null if suppressed or no posted pay. */
  percentile: number | null;
}

function midpoint(min: number | null, max: number | null): number | null {
  if (typeof min === "number" && typeof max === "number") return (min + max) / 2;
  return null; // require BOTH ends for a clean, non-misleading midpoint
}

function roundTo(n: number, to: number): number {
  return Math.round(n / to) * to;
}

/** Linear-interpolated percentile value of a SORTED ascending array. */
function quantile(sorted: number[], q: number): number {
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

const suppressed = (currency: string, period: string): SalaryBenchmark => ({
  available: false,
  sampleSize: 0,
  currency,
  period,
  market: null,
  posted: null,
  percentile: null,
});

/**
 * Compute a k-anonymized market benchmark for `subject` from `market` data.
 *
 * `market` should already be the role-family candidates (same experienceLevel +
 * department, published, current job excluded) — this function does the
 * currency/period match, k-anonymity gate, percentile math, and rounding.
 */
export function computeSalaryBenchmark(
  subject: BenchmarkSubject,
  market: SalaryDatum[],
  opts: { kMin?: number; minTenants?: number; maxTenantShare?: number } = {},
): SalaryBenchmark {
  const kMin = opts.kMin ?? K_ANON_MIN;
  const minTenants = opts.minTenants ?? MIN_TENANTS;
  const maxTenantShare = opts.maxTenantShare ?? MAX_TENANT_SHARE;
  const currency = subject.salaryCurrency;
  const period = subject.salaryPeriod;

  // Only combine like-with-like, and only rows with a usable midpoint.
  const values: number[] = [];
  const perTenant = new Map<string, number>();
  for (const d of market) {
    if (d.salaryCurrency !== currency || d.salaryPeriod !== period) continue;
    const mid = midpoint(d.salaryMin, d.salaryMax);
    if (mid === null) continue;
    values.push(mid);
    perTenant.set(d.tenantId, (perTenant.get(d.tenantId) ?? 0) + 1);
  }

  // k-anonymity, three gates (else reveal nothing):
  //  1. enough comparable jobs,
  //  2. enough distinct tenants,
  //  3. no single tenant dominates the pool (asymmetric-contribution attack).
  const dominantShare = values.length ? Math.max(...perTenant.values()) / values.length : 1;
  if (values.length < kMin || perTenant.size < minTenants || dominantShare > maxTenantShare) {
    return suppressed(currency, period);
  }

  values.sort((a, b) => a - b);
  const step = roundStepFor(period);
  const market_ = {
    p25: roundTo(quantile(values, 0.25), step),
    p50: roundTo(quantile(values, 0.5), step),
    p75: roundTo(quantile(values, 0.75), step),
  };

  const posted = midpoint(subject.salaryMin, subject.salaryMax);
  let percentile: number | null = null;
  if (posted !== null) {
    // Fraction of the market at or below this posting (rounded to whole %).
    const atOrBelow = values.filter((v) => v <= posted).length;
    percentile = Math.round((atOrBelow / values.length) * 100);
  }

  return {
    available: true,
    sampleSize: values.length,
    currency,
    period,
    market: market_,
    posted,
    percentile,
  };
}
