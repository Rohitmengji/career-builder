/*
 * Unit tests for computeSalaryBenchmark in ./salary-benchmark — the
 * privacy-preserving "is this offer competitive?" calculation (pure logic).
 *
 * WHY: this shows a subject posting against an aggregate market drawn from OTHER
 * tenants' salary data. That is cross-tenant data, so it MUST never let anyone
 * reverse-engineer an individual competitor's figures. The k-anonymity rules are
 * a hard privacy requirement, not a nicety — hence the "MANDATORY" suites.
 *
 * Behaviors asserted:
 *  - SUPPRESSION (returns available:false, null market): fewer than K_ANON_MIN
 *    comparable jobs; all data from a single tenant (even if >= k jobs); fewer
 *    than MIN_TENANTS distinct tenants; or one tenant dominating (>50% share).
 *    Becomes available exactly at the floor (k jobs, balanced across >= MIN_TENANTS).
 *  - NO LEAKS: p25/p50/p75 are rounded to the period step (roundStepFor) so no
 *    exact competitor figure is recoverable, ordering p25<=p50<=p75 holds, and
 *    hourly wages round to whole dollars (a flat 1000-step would collapse them to $0).
 *  - CURRENCY/PERIOD SAFETY: only rows matching the subject's currency AND pay
 *    period count toward k; mismatched rows are excluded (and can drop the pool
 *    below the threshold).
 *  - PERCENTILE: the subject's percentile within the market midpoints; a
 *    top-of-market posting is 100th; when the employer hides pay (null/null) the
 *    market range is still shown (the "honest" part) but posted/percentile are null;
 *    a posting needs BOTH range ends to be counted.
 */
import { describe, it, expect } from "vitest";
import {
  computeSalaryBenchmark,
  roundStepFor,
  K_ANON_MIN,
  MIN_TENANTS,
  type SalaryDatum,
  type BenchmarkSubject,
} from "./salary-benchmark";

const USD = (salaryMin: number, salaryMax: number, tenantId: string): SalaryDatum => ({
  salaryMin,
  salaryMax,
  salaryCurrency: "USD",
  salaryPeriod: "yearly",
  tenantId,
});

const subject = (min: number | null, max: number | null): BenchmarkSubject => ({
  salaryMin: min,
  salaryMax: max,
  salaryCurrency: "USD",
  salaryPeriod: "yearly",
});

// A healthy market: 5 jobs across 3 distinct tenants.
const HEALTHY: SalaryDatum[] = [
  USD(100_000, 120_000, "t1"), // mid 110k
  USD(120_000, 140_000, "t2"), // mid 130k
  USD(140_000, 160_000, "t3"), // mid 150k
  USD(160_000, 180_000, "t1"), // mid 170k
  USD(180_000, 200_000, "t2"), // mid 190k
];

describe("computeSalaryBenchmark — k-anonymity suppression (MANDATORY)", () => {
  it("suppresses when fewer than K_ANON_MIN comparable jobs", () => {
    const tooFew = HEALTHY.slice(0, K_ANON_MIN - 1);
    const res = computeSalaryBenchmark(subject(130_000, 150_000), tooFew);
    expect(res.available).toBe(false);
    expect(res.market).toBeNull();
    expect(res.percentile).toBeNull();
    expect(res.sampleSize).toBe(0);
  });

  it("suppresses when all data comes from a single tenant (even if >= k jobs)", () => {
    const oneTenant = [
      USD(100_000, 120_000, "solo"),
      USD(120_000, 140_000, "solo"),
      USD(140_000, 160_000, "solo"),
      USD(160_000, 180_000, "solo"),
      USD(180_000, 200_000, "solo"),
      USD(200_000, 220_000, "solo"),
    ];
    expect(oneTenant.length).toBeGreaterThanOrEqual(K_ANON_MIN);
    const res = computeSalaryBenchmark(subject(150_000, 170_000), oneTenant);
    expect(res.available).toBe(false);
    expect(res.market).toBeNull();
  });

  it("becomes available exactly at the k-anonymity threshold (k jobs, >= MIN_TENANTS tenants)", () => {
    expect(HEALTHY.length).toBe(K_ANON_MIN);
    const distinctTenants = new Set(HEALTHY.map((d) => d.tenantId)).size;
    expect(distinctTenants).toBeGreaterThanOrEqual(MIN_TENANTS);
    const res = computeSalaryBenchmark(subject(150_000, 170_000), HEALTHY);
    expect(res.available).toBe(true);
    expect(res.market).not.toBeNull();
    expect(res.sampleSize).toBe(K_ANON_MIN);
  });
});

describe("computeSalaryBenchmark — no individual data leaks", () => {
  it("never returns a raw datum; market figures are rounded to the period step", () => {
    // Odd values so an unrounded percentile would reveal a specific posting.
    const market = [
      USD(101_111, 121_111, "t1"),
      USD(133_333, 153_333, "t2"),
      USD(145_678, 165_678, "t3"),
      USD(167_777, 187_777, "t1"),
      USD(199_999, 219_999, "t2"),
    ];
    const step = roundStepFor("yearly");
    const res = computeSalaryBenchmark(subject(150_000, 170_000), market);
    expect(res.available).toBe(true);
    for (const v of [res.market!.p25, res.market!.p50, res.market!.p75]) {
      expect(v % step).toBe(0); // rounded — no exact competitor figure recoverable
    }
    // p25 <= p50 <= p75 ordering holds.
    expect(res.market!.p25).toBeLessThanOrEqual(res.market!.p50);
    expect(res.market!.p50).toBeLessThanOrEqual(res.market!.p75);
  });

  it("suppresses when one tenant dominates the pool (> 50% share), even with >= MIN_TENANTS tenants", () => {
    // 5 jobs across 3 tenants but 3 from t1 (60% > 50%) -> dominant -> suppressed.
    const lopsided = [
      USD(100_000, 120_000, "t1"),
      USD(120_000, 140_000, "t1"),
      USD(140_000, 160_000, "t1"),
      USD(160_000, 180_000, "t2"),
      USD(180_000, 200_000, "t3"),
    ];
    const res = computeSalaryBenchmark(subject(150_000, 170_000), lopsided);
    expect(res.available).toBe(false);
    expect(res.market).toBeNull();
  });

  it("allows a balanced pool (no tenant over 50%) at the floor", () => {
    // 2 + 2 + 1 across 3 tenants -> max 40% -> available.
    const balanced = [
      USD(100_000, 120_000, "t1"),
      USD(120_000, 140_000, "t1"),
      USD(140_000, 160_000, "t2"),
      USD(160_000, 180_000, "t2"),
      USD(180_000, 200_000, "t3"),
    ];
    const res = computeSalaryBenchmark(subject(150_000, 170_000), balanced);
    expect(res.available).toBe(true);
  });

  it("rounds hourly wages to whole dollars (not to $0)", () => {
    const hourly: SalaryDatum[] = [
      { salaryMin: 18, salaryMax: 22, salaryCurrency: "USD", salaryPeriod: "hourly", tenantId: "t1" },
      { salaryMin: 20, salaryMax: 26, salaryCurrency: "USD", salaryPeriod: "hourly", tenantId: "t2" },
      { salaryMin: 24, salaryMax: 30, salaryCurrency: "USD", salaryPeriod: "hourly", tenantId: "t3" },
      { salaryMin: 28, salaryMax: 34, salaryCurrency: "USD", salaryPeriod: "hourly", tenantId: "t1" },
      { salaryMin: 30, salaryMax: 40, salaryCurrency: "USD", salaryPeriod: "hourly", tenantId: "t2" },
    ];
    const res = computeSalaryBenchmark(
      { salaryMin: 25, salaryMax: 31, salaryCurrency: "USD", salaryPeriod: "hourly" },
      hourly,
    );
    expect(res.available).toBe(true);
    expect(res.market!.p50).toBeGreaterThan(0); // would be $0 under a flat 1000-step
    expect(res.market!.p50 % roundStepFor("hourly")).toBe(0);
  });
});

describe("computeSalaryBenchmark — currency / period safety", () => {
  it("ignores data in a different currency than the subject", () => {
    const mixed: SalaryDatum[] = [
      ...HEALTHY.map((d) => ({ ...d, salaryCurrency: "EUR" })), // all EUR — must be excluded
    ];
    const res = computeSalaryBenchmark(subject(150_000, 170_000), mixed); // subject USD
    expect(res.available).toBe(false); // nothing in USD → suppressed
  });

  it("ignores data with a different pay period (yearly vs hourly)", () => {
    const hourly = HEALTHY.map((d) => ({ ...d, salaryPeriod: "hourly" }));
    const res = computeSalaryBenchmark(subject(150_000, 170_000), hourly);
    expect(res.available).toBe(false);
  });

  it("only counts the matching-currency subset toward k", () => {
    const market: SalaryDatum[] = [
      ...HEALTHY.slice(0, 3), // 3 USD across t1,t2,t3
      { ...USD(300_000, 320_000, "t9"), salaryCurrency: "GBP" },
      { ...USD(310_000, 330_000, "t8"), salaryCurrency: "GBP" },
    ];
    // Only 3 USD rows -> below k -> suppressed.
    const res = computeSalaryBenchmark(subject(150_000, 170_000), market);
    expect(res.available).toBe(false);
  });
});

describe("computeSalaryBenchmark — percentile + median context", () => {
  it("computes the subject's percentile within the market distribution", () => {
    // Market midpoints: 110,130,150,170,190 (k). Subject mid = 150 -> 3 of 5 <= 150 = 60%.
    const res = computeSalaryBenchmark(subject(140_000, 160_000), HEALTHY);
    expect(res.available).toBe(true);
    expect(res.posted).toBe(150_000);
    expect(res.percentile).toBe(60);
  });

  it("a top-of-market posting lands at the 100th percentile", () => {
    const res = computeSalaryBenchmark(subject(190_000, 210_000), HEALTHY); // mid 200k > all
    expect(res.percentile).toBe(100);
  });

  it("shows the market range but NO percentile when the employer hides pay", () => {
    const res = computeSalaryBenchmark(subject(null, null), HEALTHY);
    expect(res.available).toBe(true); // the honest part: market still shown
    expect(res.market).not.toBeNull();
    expect(res.posted).toBeNull();
    expect(res.percentile).toBeNull();
  });

  it("requires BOTH ends of a range to count a posting (single-ended excluded)", () => {
    const oneEnded = [
      { ...USD(100_000, 0, "t1"), salaryMax: null },
      { ...USD(120_000, 0, "t2"), salaryMax: null },
      USD(140_000, 160_000, "t3"),
      USD(160_000, 180_000, "t1"),
      USD(180_000, 200_000, "t2"),
    ];
    // Only 3 rows have both ends -> below k -> suppressed.
    const res = computeSalaryBenchmark(subject(150_000, 170_000), oneEnded);
    expect(res.available).toBe(false);
  });
});
