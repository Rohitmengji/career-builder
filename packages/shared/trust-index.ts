/*
 * @career-builder/shared/trust-index — k-anonymized cross-tenant employer benchmark.
 *
 * NOVEL (no mainstream ATS): lets an employer see how its OWN outcome metrics (v1:
 * responsiveness — the "we don't ghost" rate, ADR-0003) compare to the anonymized
 * MARKET of other employers on the platform. On-thesis (the trust wedge) + a real
 * network-effect moat: the benchmark gets better as more tenants join, and it nudges
 * employers to compete on candidate experience.
 *
 * PRIVACY (mirrors salary-benchmark, ADR-0002): the market is built from per-tenant
 * metric VALUES only (no tenant identity ever crosses), and is SUPPRESSED unless
 * >= MIN_TENANTS distinct tenants contribute — so no single employer's number is
 * identifiable and a tiny sample can't be de-anonymized. A tenant compares its own
 * value (which it owns) against this aggregate; it never sees another tenant's value.
 * Pure: the cross-tenant repo passes anonymized values here; k-anon is enforced HERE
 * before anything reaches a client.
 */

/** A market needs at least this many distinct contributing tenants to be shown at all.
 *  Set to 10 (not 5) because each tenant contributes exactly ONE value: at k=5 the
 *  quantile positions land on individual tenants' raw rates AND one tenant is 20% of a
 *  quartile band. At >=10, one tenant is <=10% — below the band — and (n-1)*q yields
 *  non-integer positions so quantiles interpolate across several tenants rather than
 *  exposing any single one. (Quantiles are also rounded to the nearest 5.) */
export const TRUST_MIN_TENANTS = 10;
/** The percentile rank is gated on the same floor (it's a viewer-controlled oracle). */
export const TRUST_MIN_TENANTS_PERCENTILE = TRUST_MIN_TENANTS;

export interface MetricBenchmark {
  /** false when k-anonymity suppressed the market (too few contributing tenants). */
  available: boolean;
  /** How many tenants' values formed the market (>= MIN_TENANTS when available). */
  sampleTenants: number;
  /** Market percentiles of the metric (null when suppressed). */
  median: number | null;
  p25: number | null;
  p75: number | null;
  /** Where the tenant's own value sits in the market, 0–100 (higher = better always).
   *  null when suppressed or the tenant has no own value. */
  percentile: number | null;
}

function quantile(sortedAsc: number[], q: number): number {
  if (sortedAsc.length === 1) return sortedAsc[0];
  const pos = (sortedAsc.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sortedAsc[lo];
  return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (pos - lo);
}

/** Round published market percentiles to the nearest 5 so a single competitor's exact
 *  (anonymized) rate can't be read off a quantile at the minimum k. */
function roundCoarse(x: number): number {
  return Math.round(x / 5) * 5;
}

/**
 * Coarsen the contributing-tenant count into a band — the EXACT count is withheld from
 * clients so a viewer can't watch it tick (a tenant crossing the min-settled floor /
 * joining / leaving) to isolate and track an individual competitor across requests.
 */
export function bucketContributors(n: number): string {
  if (n >= 100) return "100+";
  if (n >= 25) return "25–99";
  if (n >= 10) return "10–24";
  if (n >= 5) return "5–9";
  return "<5";
}

/**
 * k-anonymized benchmark of `own` against the anonymized `market` values.
 * `higherIsBetter` controls the percentile direction (responsiveness: higher better;
 * time-to-decision: lower better). Suppressed below `minTenants`.
 */
export function benchmarkMetric(
  own: number | null,
  market: number[],
  opts: { minTenants?: number; higherIsBetter?: boolean; minTenantsForPercentile?: number } = {},
): MetricBenchmark {
  const minTenants = opts.minTenants ?? TRUST_MIN_TENANTS;
  const higherIsBetter = opts.higherIsBetter ?? true;

  if (market.length < minTenants) {
    return { available: false, sampleTenants: market.length, median: null, p25: null, p75: null, percentile: null };
  }

  const sorted = [...market].sort((a, b) => a - b);
  // Coarsen percentiles (nearest 5) so an exact per-tenant rate isn't recoverable from
  // a quantile that lands on a single contributor's value at the minimum k.
  const median = roundCoarse(quantile(sorted, 0.5));
  const p25 = roundCoarse(quantile(sorted, 0.25));
  const p75 = roundCoarse(quantile(sorted, 0.75));

  let percentile: number | null = null;
  // PERCENTILE IS A RANK ORACLE: the viewer controls `own` and can re-query freely, so
  // a percentile lets them SWEEP `own` and probe the competitor distribution. Three
  // guards close it: (0) only publish it once >= TRUST_MIN_TENANTS_PERCENTILE tenants
  // contribute, so one tenant is <= ~10% — below the quartile band, can't move it alone
  // (banding alone is insufficient at the k=5 floor where 1 tenant = 20%); (1) rank
  // against the COARSENED market (nearest 5); (2) BAND the output to quartiles.
  if (own !== null && Number.isFinite(own) && market.length >= (opts.minTenantsForPercentile ?? TRUST_MIN_TENANTS_PERCENTILE)) {
    const ownC = roundCoarse(own);
    const coarsened = sorted.map(roundCoarse);
    const better = coarsened.filter((v) => (higherIsBetter ? ownC > v : ownC < v)).length;
    const equal = coarsened.filter((v) => v === ownC).length;
    const raw = ((better + equal / 2) / coarsened.length) * 100;
    percentile = Math.round(raw / 25) * 25; // quartile band: 0 | 25 | 50 | 75 | 100
  }

  return { available: true, sampleTenants: market.length, median, p25, p75, percentile };
}
