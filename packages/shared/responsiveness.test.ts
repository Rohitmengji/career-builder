import { describe, it, expect } from "vitest";
import {
  computeResponsiveness,
  GHOST_SLA_DAYS,
  MIN_SETTLED,
  type ApplicationStatusDatum,
} from "./responsiveness";

const NOW = Date.parse("2026-06-20T00:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(NOW - n * DAY);

/** Build N applications with a given status, all older than the SLA window. */
function settled(status: string, n: number): ApplicationStatusDatum[] {
  return Array.from({ length: n }, () => ({ status, submittedAt: daysAgo(GHOST_SLA_DAYS + 5) }));
}

describe("computeResponsiveness — min-sample suppression", () => {
  it("suppresses when settled applications are below MIN_SETTLED", () => {
    const apps = settled("interview", MIN_SETTLED - 1);
    const res = computeResponsiveness(apps, NOW);
    expect(res.available).toBe(false);
    expect(res.responseRate).toBeNull();
    expect(res.grade).toBeNull();
  });

  it("becomes available exactly at MIN_SETTLED settled applications", () => {
    const apps = settled("interview", MIN_SETTLED);
    const res = computeResponsiveness(apps, NOW);
    expect(res.available).toBe(true);
    expect(res.sampleSize).toBe(MIN_SETTLED);
    expect(res.responseRate).toBe(100);
    expect(res.grade).toBe("excellent");
  });

  it("recent (within-SLA) 'applied' apps are pending and don't count toward the rate", () => {
    // 10 responded (settled) + 50 brand-new applied (pending) → rate stays 100.
    const apps = [
      ...settled("interview", MIN_SETTLED),
      ...Array.from({ length: 50 }, () => ({ status: "applied", submittedAt: daysAgo(1) })),
    ];
    const res = computeResponsiveness(apps, NOW);
    expect(res.available).toBe(true);
    expect(res.sampleSize).toBe(MIN_SETTLED); // pending excluded
    expect(res.pendingCount).toBe(50);
    expect(res.responseRate).toBe(100);
  });
});

describe("computeResponsiveness — response vs ghost", () => {
  it("counts old 'applied' apps as ghosted", () => {
    // 15 responded + 5 ghosted (old + still applied) → 75% response, 25% ghost.
    const apps = [...settled("hired", 15), ...settled("applied", 5)];
    const res = computeResponsiveness(apps, NOW);
    expect(res.available).toBe(true);
    expect(res.sampleSize).toBe(20);
    expect(res.responseRate).toBe(75);
    expect(res.ghostRate).toBe(25);
    expect(res.grade).toBe("good");
  });

  it("treats rejected/hired/offer/interview/screening all as responded (a human acted)", () => {
    const apps = [
      ...settled("rejected", 4),
      ...settled("hired", 2),
      ...settled("offer", 2),
      ...settled("interview", 1),
      ...settled("screening", 1),
    ];
    const res = computeResponsiveness(apps, NOW);
    expect(res.sampleSize).toBe(10);
    expect(res.responseRate).toBe(100);
  });

  it("a timely rejection counts as an answer, NOT as ghosting (anti-ghosting intent)", () => {
    // Deliberate: 10 rejected (answered) + 10 old-applied (ghosted) -> 50% answered.
    // Excluding rejections would wrongly make a courteous fast-rejecting employer
    // look like a ghoster. See ADR-0003.
    const apps = [...settled("rejected", 10), ...settled("applied", 10)];
    const res = computeResponsiveness(apps, NOW);
    expect(res.responseRate).toBe(50);
    expect(res.ghostRate).toBe(50);
  });

  it("ghostRate is always the complement of responseRate", () => {
    const apps = [...settled("interview", 6), ...settled("applied", 6)];
    const res = computeResponsiveness(apps, NOW);
    expect(res.responseRate! + res.ghostRate!).toBe(100);
    expect(res.responseRate).toBe(50);
    expect(res.grade).toBe("fair");
  });

  it("grades a low responder accordingly", () => {
    const apps = [...settled("interview", 2), ...settled("applied", 8)]; // 20% response
    const res = computeResponsiveness(apps, NOW);
    expect(res.responseRate).toBe(20);
    expect(res.grade).toBe("low");
  });
});

describe("computeResponsiveness — robustness", () => {
  it("ignores unknown statuses (don't inflate or deflate the rate)", () => {
    const apps = [
      ...settled("interview", 10),
      ...settled("archived", 5), // unknown → ignored entirely
    ];
    const res = computeResponsiveness(apps, NOW);
    expect(res.sampleSize).toBe(10);
    expect(res.responseRate).toBe(100);
  });

  it("skips rows with an unparseable submittedAt", () => {
    const apps: ApplicationStatusDatum[] = [
      ...settled("interview", 10),
      { status: "applied", submittedAt: "not-a-date" },
    ];
    const res = computeResponsiveness(apps, NOW);
    expect(res.sampleSize).toBe(10); // bad row dropped, not counted as ghost
  });

  it("accepts Date, ISO string, and epoch-ms submittedAt forms", () => {
    const apps: ApplicationStatusDatum[] = [
      ...Array.from({ length: 4 }, () => ({ status: "interview", submittedAt: daysAgo(30) })),
      ...Array.from({ length: 3 }, () => ({ status: "hired", submittedAt: new Date(NOW - 30 * DAY).toISOString() })),
      ...Array.from({ length: 3 }, () => ({ status: "offer", submittedAt: NOW - 30 * DAY })),
    ];
    const res = computeResponsiveness(apps, NOW);
    expect(res.available).toBe(true);
    expect(res.responseRate).toBe(100);
  });

  it("an exactly-at-SLA-boundary applied app is still pending (strictly older than SLA is ghosted)", () => {
    const apps = [
      ...settled("interview", MIN_SETTLED),
      { status: "applied", submittedAt: new Date(NOW - GHOST_SLA_DAYS * DAY) }, // exactly SLA
    ];
    const res = computeResponsiveness(apps, NOW);
    expect(res.pendingCount).toBe(1);
    expect(res.sampleSize).toBe(MIN_SETTLED);
  });
});
