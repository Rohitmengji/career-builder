/*
 * Tests for shared/trust-index — k-anon cross-tenant employer benchmark.
 * Pinned: SUPPRESS below MIN_TENANTS (k-anonymity); percentile direction honors
 * higherIsBetter; ties get half-credit; market percentiles correct.
 */

import { describe, it, expect } from "vitest";
import { benchmarkMetric, TRUST_MIN_TENANTS } from "./trust-index";

describe("benchmarkMetric — k-anonymity", () => {
  it("suppresses when fewer than MIN_TENANTS contribute", () => {
    const market = Array.from({ length: TRUST_MIN_TENANTS - 1 }, (_, i) => 50 + i);
    const b = benchmarkMetric(80, market, {});
    expect(b.available).toBe(false);
    expect(b.median).toBeNull();
    expect(b.percentile).toBeNull();
    expect(b.sampleTenants).toBe(TRUST_MIN_TENANTS - 1);
  });

  it("available once >= MIN_TENANTS contribute (quantiles interpolate, rounded to 5)", () => {
    const market = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]; // exactly MIN_TENANTS (10)
    const b = benchmarkMetric(35, market, {});
    expect(b.available).toBe(true);
    expect(b.median).toBe(55); // interpolated (50,60)→55, not a single tenant's value
    expect(b.p25).toBe(35);
    expect(b.p75).toBe(80);
  });

  it("at the OLD floor of 5 the market is now SUPPRESSED (10 required so quantiles can't land on one tenant)", () => {
    const b = benchmarkMetric(35, [10, 20, 30, 40, 50], {});
    expect(b.available).toBe(false);
    expect(b.median).toBeNull();
    expect(b.percentile).toBeNull();
  });
});

describe("benchmarkMetric — percentile direction", () => {
  // Percentile needs >= TRUST_MIN_TENANTS_PERCENTILE (10) contributors to publish.
  const market = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

  it("higherIsBetter: a high own value ranks high (quartile-banded)", () => {
    expect(benchmarkMetric(90, market, { higherIsBetter: true }).percentile).toBe(75); // beats 8 + half tie → 85 → band 75
    expect(benchmarkMetric(10, market, { higherIsBetter: true }).percentile).toBe(0);
  });

  it("lowerIsBetter: a low own value ranks high (e.g. time-to-decision)", () => {
    expect(benchmarkMetric(10, market, { higherIsBetter: false }).percentile).toBe(100); // beats 9 + half tie → 95 → band 100
    expect(benchmarkMetric(90, market, { higherIsBetter: false }).percentile).toBe(25); // beats 1 + half tie → 15 → band 25
  });

  it("ties get half credit (then quartile-banded)", () => {
    expect(benchmarkMetric(60, market, { higherIsBetter: true }).percentile).toBe(50); // 5 below + half tie → 55 → band 50
  });

  it("percentile is SWEEP-RESISTANT once published: always a quartile band, ranked on coarsened values", () => {
    const m = [37, 52, 52, 68, 91, 12, 25, 44, 60, 88]; // 10 contributors → rank published
    for (let own = 0; own <= 100; own++) {
      const p = benchmarkMetric(own, m, { higherIsBetter: true }).percentile!;
      expect([0, 25, 50, 75, 100]).toContain(p);
    }
    // a sub-5 change in own coarsens to the same band → identical rank (no fine oracle)
    expect(benchmarkMetric(70, m, { higherIsBetter: true }).percentile).toBe(benchmarkMetric(72, m, { higherIsBetter: true }).percentile);
  });

  it("null own value → percentile null but market still shown", () => {
    const b = benchmarkMetric(null, market, {});
    expect(b.available).toBe(true);
    expect(b.median).toBe(55); // 10-value market [10..100] → median 55 (rounded to 5)
    expect(b.percentile).toBeNull();
  });
});
