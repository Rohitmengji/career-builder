/*
 * Nurture-sequence scheduler (ADR-0019, B4) — pure, no DB.
 *
 * WHAT: given an enrollment's start time, the campaign's steps, and which steps were
 *   already sent, decide which step (if any) is due to send now.
 * WHY: the cron dispatcher must be idempotent and anti-spam. This is the single
 *   source of truth for the schedule, unit-tested independently of DB/email.
 * HOW: steps are delivered SEQUENTIALLY (never step 2 before step 1) and at most ONE
 *   per dispatch run — nextDueStep returns the lowest-index UNSENT step IF its send
 *   time (enrolledAt + offsetDays) has arrived; if that next step isn't due yet, it
 *   returns null (wait — don't skip ahead). Combined with a unique (enrollment,step)
 *   send record, re-running the dispatcher can never double-send.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export interface NurtureStep {
  stepIndex: number;
  offsetDays: number;
}

export interface NextDueInput {
  enrolledAt: Date | string;
  now: Date | string;
  steps: NurtureStep[];
  sent: number[]; // already-sent stepIndexes
}

/** When step `offsetDays` after `enrolledAt` becomes sendable. */
export function stepSendTime(enrolledAt: Date | string, offsetDays: number): Date {
  return new Date(new Date(enrolledAt).getTime() + Math.max(0, offsetDays) * DAY_MS);
}

/**
 * The next step to send for this enrollment, or null if none is due. Sequential: the
 * lowest-index unsent step gates the rest — if it isn't due yet, nothing sends (we do
 * NOT skip ahead to a later step). At most one step per call (anti-spam + trickle).
 */
export function nextDueStep(input: NextDueInput): number | null {
  const now = new Date(input.now);
  const sent = new Set(input.sent);
  const ordered = [...input.steps].sort((a, b) => a.stepIndex - b.stepIndex);
  for (const step of ordered) {
    if (sent.has(step.stepIndex)) continue;
    // First unsent step decides: due → send it; not due → wait (don't look further).
    return stepSendTime(input.enrolledAt, step.offsetDays) <= now ? step.stepIndex : null;
  }
  return null; // all steps sent
}

/** True when every step has been sent (enrollment can be marked done). */
export function allStepsSent(steps: NurtureStep[], sent: number[]): boolean {
  const sentSet = new Set(sent);
  return steps.length > 0 && steps.every((s) => sentSet.has(s.stepIndex));
}
