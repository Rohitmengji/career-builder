/*
 * Tests for shared/ghosting-risk — proactive "don't ghost" nudge.
 * Pinned: answered apps are never at risk; SLA + warn-window thresholds; overdue vs
 * at_risk boundaries; counts; most-overdue-first ordering; unparseable dates skipped.
 */
import { describe, it, expect } from "vitest";
import { classifyGhostingRisk, computeGhostingRisk, GHOST_WARN_DAYS } from "./ghosting-risk";
import { GHOST_SLA_DAYS } from "./responsiveness";

const NOW = new Date("2026-06-28T00:00:00.000Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

describe("classifyGhostingRisk", () => {
  it("an answered application (status past 'applied') is never at risk", () => {
    expect(classifyGhostingRisk("screening", 99)).toBe("ok");
    expect(classifyGhostingRisk("rejected", 99)).toBe("ok");
  });
  it("pending + past the SLA is overdue", () => {
    expect(classifyGhostingRisk("applied", GHOST_SLA_DAYS)).toBe("overdue");
    expect(classifyGhostingRisk("applied", GHOST_SLA_DAYS + 5)).toBe("overdue");
  });
  it("pending + within the warn window (but pre-SLA) is at_risk", () => {
    expect(classifyGhostingRisk("applied", GHOST_SLA_DAYS - GHOST_WARN_DAYS)).toBe("at_risk");
    expect(classifyGhostingRisk("applied", GHOST_SLA_DAYS - 1)).toBe("at_risk");
  });
  it("pending but fresh is ok", () => {
    expect(classifyGhostingRisk("applied", GHOST_SLA_DAYS - GHOST_WARN_DAYS - 1)).toBe("ok");
    expect(classifyGhostingRisk("applied", 0)).toBe("ok");
  });
});

describe("computeGhostingRisk", () => {
  it("counts at_risk + overdue and returns only actionable items, most-overdue first", () => {
    const out = computeGhostingRisk([
      { id: "fresh", status: "applied", submittedAt: daysAgo(1) },          // ok → excluded
      { id: "answered", status: "interview", submittedAt: daysAgo(40) },    // ok → excluded
      { id: "warn", status: "applied", submittedAt: daysAgo(GHOST_SLA_DAYS - 2) }, // at_risk
      { id: "over1", status: "applied", submittedAt: daysAgo(GHOST_SLA_DAYS + 1) }, // overdue
      { id: "over2", status: "applied", submittedAt: daysAgo(GHOST_SLA_DAYS + 10) }, // overdue, oldest
    ], NOW);
    expect(out.atRisk).toBe(1);
    expect(out.overdue).toBe(2);
    expect(out.items.map((i) => i.id)).toEqual(["over2", "over1", "warn"]); // most-overdue first
    expect(out.items[0].daysUntilSla).toBeLessThan(0);
  });

  it("skips unparseable submission dates (fail-safe)", () => {
    const out = computeGhostingRisk([{ id: "bad", status: "applied", submittedAt: "not-a-date" }], NOW);
    expect(out.items).toHaveLength(0);
  });

  it("reports daysWaiting as whole days", () => {
    const out = computeGhostingRisk([{ id: "x", status: "applied", submittedAt: daysAgo(GHOST_SLA_DAYS + 3) }], NOW);
    expect(out.items[0].daysWaiting).toBe(GHOST_SLA_DAYS + 3);
  });
});
