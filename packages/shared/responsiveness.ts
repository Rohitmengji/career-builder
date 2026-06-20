/*
 * @career-builder/shared/responsiveness — Employer Responsiveness Score.
 *
 * The accountability metric behind the "Candidate Promise": of the applicants
 * who applied long enough ago to have been actioned, what fraction actually got
 * a response — and what fraction were ghosted (left untouched). No ATS exposes
 * this; it is the candidate-facing trust signal.
 *
 * Pure + framework-agnostic so the definitions (and their fairness/robustness
 * guards) are unit-testable in isolation from the DB. Computed read-only from
 * each application's current status + submission time — no event history needed
 * for v1 (accurate time-to-response lands in a later slice once structured
 * status events accumulate).
 *
 * Definitions (deliberate + defensible, since this is a PUBLIC badge):
 *  - "responded": the application moved past the initial "applied" state (it
 *    reached screening/interview/offer/hired/rejected — i.e. a human acted).
 *  - "ghosted": still "applied" AND older than the SLA window (had ample time to
 *    be actioned, but wasn't).
 *  - "pending": still "applied" but within the SLA window (too early to judge —
 *    EXCLUDED from the rate so a burst of fresh applications can't tank a score).
 *  - The rate is over "settled" applications only (responded + ghosted).
 *  - Suppressed below MIN_SETTLED so a tiny, noisy, or gameable sample shows no
 *    badge at all.
 */

/** Applications still "applied" after this many days count as ghosted. */
export const GHOST_SLA_DAYS = 14;
/** Minimum settled applications before a score is shown at all. */
export const MIN_SETTLED = 10;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Statuses that mean the candidate got an ANSWER (the opposite of being ghosted).
 *
 * "rejected" is intentionally included: a timely rejection is closure, not
 * ghosting — and most applicants are legitimately rejected, so EXCLUDING it would
 * make a fast, courteous employer look WORSE than one that ghosts (wrong). The
 * public badge therefore claims only "X% get an answer (not ghosted)", never
 * "X% are engaged/considered". Distinguishing rubber-stamp rejections requires
 * decision-time data (slice 2's structured status events) — out of scope for v1.
 */
const RESPONDED_STATUSES = new Set(["screening", "interview", "offer", "hired", "rejected"]);

export type ResponsivenessGrade = "excellent" | "good" | "fair" | "low";

export interface ApplicationStatusDatum {
  status: string;
  submittedAt: Date | string | number;
}

export interface ResponsivenessScore {
  /** false when there isn't enough settled data to show a score. */
  available: boolean;
  /** Settled applications the score is based on (responded + ghosted). */
  sampleSize: number;
  /** 0–100, percent of settled applicants who received a response. */
  responseRate: number | null;
  /** 0–100, percent of settled applicants left ghosted. */
  ghostRate: number | null;
  grade: ResponsivenessGrade | null;
  /** Applications still within the response window (not yet judged). */
  pendingCount: number;
}

function toMs(d: Date | string | number): number {
  if (d instanceof Date) return d.getTime();
  if (typeof d === "number") return d;
  const t = Date.parse(d);
  return Number.isNaN(t) ? NaN : t;
}

function gradeFor(responseRate: number): ResponsivenessGrade {
  if (responseRate >= 90) return "excellent";
  if (responseRate >= 75) return "good";
  if (responseRate >= 50) return "fair";
  return "low";
}

function suppressed(pendingCount = 0): ResponsivenessScore {
  return {
    available: false,
    sampleSize: 0,
    responseRate: null,
    ghostRate: null,
    grade: null,
    pendingCount,
  };
}

/**
 * Compute the Employer Responsiveness Score from a tenant's applications.
 *
 * @param apps  each application's current status + submission time
 * @param now   current time (ms or Date) — passed in for deterministic tests
 * @param opts  override the SLA window / min sample (defaults are the published ones)
 */
export function computeResponsiveness(
  apps: ApplicationStatusDatum[],
  now: Date | number = Date.now(),
  opts: { ghostSlaDays?: number; minSettled?: number } = {},
): ResponsivenessScore {
  const nowMs = typeof now === "number" ? now : now.getTime();
  const slaMs = (opts.ghostSlaDays ?? GHOST_SLA_DAYS) * DAY_MS;
  const minSettled = opts.minSettled ?? MIN_SETTLED;

  let responded = 0;
  let ghosted = 0;
  let pending = 0;

  for (const a of apps) {
    const submittedMs = toMs(a.submittedAt);
    if (Number.isNaN(submittedMs)) continue; // skip unparseable rows
    const ageMs = nowMs - submittedMs;
    const isApplied = a.status === "applied";

    if (!isApplied && RESPONDED_STATUSES.has(a.status)) {
      // Got a real response, regardless of age.
      responded++;
    } else if (isApplied) {
      if (ageMs > slaMs) ghosted++;
      else pending++;
    }
    // Unknown statuses are ignored (don't inflate or deflate the rate).
  }

  const settled = responded + ghosted;
  if (settled < minSettled) return suppressed(pending);

  const responseRate = Math.round((responded / settled) * 100);
  const ghostRate = 100 - responseRate;

  return {
    available: true,
    sampleSize: settled,
    responseRate,
    ghostRate,
    grade: gradeFor(responseRate),
    pendingCount: pending,
  };
}
