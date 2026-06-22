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
