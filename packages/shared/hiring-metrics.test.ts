import { describe, it, expect } from "vitest";
import { computeHiringMetrics, median, type AppTimeline } from "./hiring-metrics";

const day = (n: number) => new Date(2026, 0, 1 + n).toISOString();

describe("median", () => {
  it("handles odd, even, and empty", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe("computeHiringMetrics", () => {
  it("computes medians anchored at submittedAt", () => {
    const apps: AppTimeline[] = [
      // applied day0 → screening day2 → hired day10
      { submittedAt: day(0), events: [{ toStatus: "screening", at: day(2) }, { toStatus: "hired", at: day(10) }] },
      // applied day0 → screening day4 → rejected day6
      { submittedAt: day(0), events: [{ toStatus: "screening", at: day(4) }, { toStatus: "rejected", at: day(6) }] },
    ];
    const m = computeHiringMetrics(apps);
    expect(m.timeToFirstResponseDays).toBe(3); // median(2,4)
    expect(m.timeToHireDays).toBe(10); // only the first reached hired
    expect(m.timeToDecisionDays).toBe(8); // median(10, 6)
    expect(m.samples).toEqual({ firstResponse: 2, hire: 1, decision: 2 });
    expect(m.total).toBe(2);
  });

  it("returns null medians (with sample 0) when no app reached the milestone", () => {
    const apps: AppTimeline[] = [{ submittedAt: day(0), events: [] }];
    const m = computeHiringMetrics(apps);
    expect(m.timeToFirstResponseDays).toBeNull();
    expect(m.timeToHireDays).toBeNull();
    expect(m.timeToDecisionDays).toBeNull();
    expect(m.total).toBe(1);
  });

  it("uses the FIRST terminal event for decision and ignores pre-apply clock skew", () => {
    const apps: AppTimeline[] = [
      {
        submittedAt: day(5),
        events: [
          { toStatus: "rejected", at: day(1) }, // before submittedAt → ignored
          { toStatus: "screening", at: day(7) },
          { toStatus: "rejected", at: day(9) },
        ],
      },
    ];
    const m = computeHiringMetrics(apps);
    expect(m.timeToFirstResponseDays).toBe(2); // screening at day7 - submitted day5
    expect(m.timeToDecisionDays).toBe(4); // rejected at day9 - day5 (the pre-apply one ignored)
  });
});
