/*
 * Tests for shared/nurture — the sequence scheduler.
 * Pinned invariants: sequential delivery (no skipping ahead), one step per run,
 * idempotent w.r.t. already-sent, and "done" detection.
 */

import { describe, it, expect } from "vitest";
import { nextDueStep, allStepsSent, stepSendTime } from "./nurture";

const steps = [
  { stepIndex: 0, offsetDays: 0 },
  { stepIndex: 1, offsetDays: 7 },
  { stepIndex: 2, offsetDays: 14 },
];
const enrolledAt = new Date("2026-01-01T00:00:00Z");

describe("nextDueStep", () => {
  it("sends step 0 immediately (offset 0) on enrollment day", () => {
    expect(nextDueStep({ enrolledAt, now: enrolledAt, steps, sent: [] })).toBe(0);
  });

  it("after step 0 sent, waits until day 7 for step 1 (no skipping)", () => {
    const day3 = new Date("2026-01-04T00:00:00Z");
    expect(nextDueStep({ enrolledAt, now: day3, steps, sent: [0] })).toBeNull();
    const day7 = new Date("2026-01-08T00:00:00Z");
    expect(nextDueStep({ enrolledAt, now: day7, steps, sent: [0] })).toBe(1);
  });

  it("sends only ONE step per run even when several are overdue", () => {
    const day30 = new Date("2026-01-31T00:00:00Z");
    // All overdue, none sent → returns the EARLIEST unsent (0), not 1 or 2.
    expect(nextDueStep({ enrolledAt, now: day30, steps, sent: [] })).toBe(0);
    expect(nextDueStep({ enrolledAt, now: day30, steps, sent: [0] })).toBe(1);
    expect(nextDueStep({ enrolledAt, now: day30, steps, sent: [0, 1] })).toBe(2);
  });

  it("returns null when all steps already sent (idempotent)", () => {
    expect(nextDueStep({ enrolledAt, now: new Date("2026-03-01T00:00:00Z"), steps, sent: [0, 1, 2] })).toBeNull();
  });

  it("does not skip ahead: if step 1 is unsent and not due, step 2 never sends early", () => {
    const day10 = new Date("2026-01-11T00:00:00Z"); // step1 due (day7), step2 not (day14)
    // step1 unsent → it gates; even though step2 exists, we return step1.
    expect(nextDueStep({ enrolledAt, now: day10, steps, sent: [0] })).toBe(1);
    // If somehow step1 sent but not due-ordering issue: step2 not due → null
    const day10b = new Date("2026-01-09T00:00:00Z");
    expect(nextDueStep({ enrolledAt, now: day10b, steps, sent: [0, 1] })).toBeNull();
  });
});

describe("allStepsSent", () => {
  it("true only when every step index is in sent", () => {
    expect(allStepsSent(steps, [0, 1, 2])).toBe(true);
    expect(allStepsSent(steps, [0, 1])).toBe(false);
    expect(allStepsSent([], [])).toBe(false); // empty campaign isn't "done"
  });
});

describe("stepSendTime", () => {
  it("adds offsetDays to enrolledAt; clamps negative to 0", () => {
    expect(stepSendTime(enrolledAt, 7).toISOString()).toBe("2026-01-08T00:00:00.000Z");
    expect(stepSendTime(enrolledAt, -5).toISOString()).toBe(enrolledAt.toISOString());
  });
});
