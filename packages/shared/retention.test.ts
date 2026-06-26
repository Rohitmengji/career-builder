/*
 * Unit tests for the data-retention policy helpers (./retention) — the pure
 * logic that decides when a terminal application is due to be purged.
 *
 * WHY: retention drives destructive deletion, so the policy parser must be
 * defensive (default OFF, conservative windows, no crash on bad input) and the
 * purge predicate must only ever fire for terminal statuses past their window.
 * Pure + DB-free; the actual purge job applies these decisions elsewhere.
 *
 * Key behaviors asserted:
 *  - parseRetention defaults to DEFAULT_RETENTION (enabled:false) on undefined /
 *    invalid JSON; reads from settings.retention or the raw object; and clamps
 *    negative / non-numeric / absurd day values to the fallback or the cap (36_500);
 *  - cutoffFor returns null when disabled or for non-terminal statuses, and the
 *    per-status (rejectedDays / hiredDays) cutoff date otherwise;
 *  - isDueForPurge is true ONLY strictly past the window for a terminal status —
 *    the exactly-at-window boundary is KEPT — and never fires for non-terminal
 *    statuses or when the policy is disabled.
 */
import { describe, it, expect } from "vitest";
import { parseRetention, cutoffFor, isDueForPurge, DEFAULT_RETENTION } from "./retention";

const NOW = new Date("2026-06-22T00:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

describe("parseRetention", () => {
  it("defaults to OFF with conservative windows", () => {
    expect(parseRetention(undefined)).toEqual(DEFAULT_RETENTION);
    expect(parseRetention("{not json")).toEqual(DEFAULT_RETENTION);
    expect(parseRetention(DEFAULT_RETENTION).enabled).toBe(false);
  });
  it("reads from settings.retention or the object itself", () => {
    expect(parseRetention({ retention: { enabled: true, rejectedDays: 30 } })).toMatchObject({ enabled: true, rejectedDays: 30 });
    expect(parseRetention({ enabled: true, hiredDays: 1000 })).toMatchObject({ enabled: true, hiredDays: 1000 });
  });
  it("clamps negative / absurd / non-numeric days to the fallback or the cap", () => {
    expect(parseRetention({ enabled: true, rejectedDays: -5 }).rejectedDays).toBe(DEFAULT_RETENTION.rejectedDays);
    expect(parseRetention({ enabled: true, rejectedDays: "abc" }).rejectedDays).toBe(DEFAULT_RETENTION.rejectedDays);
    expect(parseRetention({ enabled: true, hiredDays: 9e9 }).hiredDays).toBe(36_500);
  });
});

describe("cutoffFor", () => {
  const policy = { enabled: true, rejectedDays: 100, hiredDays: 1000 };
  it("returns null when disabled or for non-terminal statuses", () => {
    expect(cutoffFor("rejected", { ...policy, enabled: false }, NOW)).toBeNull();
    expect(cutoffFor("applied", policy, NOW)).toBeNull();
    expect(cutoffFor("interview", policy, NOW)).toBeNull();
  });
  it("uses the per-status window", () => {
    expect(cutoffFor("rejected", policy, NOW)!.getTime()).toBe(daysAgo(100).getTime());
    expect(cutoffFor("hired", policy, NOW)!.getTime()).toBe(daysAgo(1000).getTime());
  });
});

describe("isDueForPurge", () => {
  const policy = { enabled: true, rejectedDays: 100, hiredDays: 1000 };
  it("is true only past the window for a terminal status", () => {
    expect(isDueForPurge(daysAgo(101), "rejected", policy, NOW)).toBe(true);
    expect(isDueForPurge(daysAgo(99), "rejected", policy, NOW)).toBe(false);
    expect(isDueForPurge(daysAgo(100), "rejected", policy, NOW)).toBe(false); // boundary: kept
    expect(isDueForPurge(daysAgo(1001), "hired", policy, NOW)).toBe(true);
  });
  it("never purges non-terminal or when disabled", () => {
    expect(isDueForPurge(daysAgo(9999), "interview", policy, NOW)).toBe(false);
    expect(isDueForPurge(daysAgo(9999), "rejected", { ...policy, enabled: false }, NOW)).toBe(false);
  });
});
