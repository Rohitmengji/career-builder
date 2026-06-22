/*
 * @career-builder/shared/scorecard — pure structured-scorecard logic (ADR-0007).
 *
 * A job defines a rubric: a list of criterion labels. Each interviewer submits a
 * scorecard with a 1-5 score per criterion plus an overall hiring recommendation.
 * This module parses/validates the rubric and aggregates scorecards across
 * interviewers into a single decision view. Pure + framework-agnostic so the math
 * is unit-testable and shared by both apps. No PII, no DB, no I/O.
 */

export type Recommendation = "strong_yes" | "yes" | "no" | "strong_no";

export const RECOMMENDATIONS: readonly Recommendation[] = [
  "strong_yes",
  "yes",
  "no",
  "strong_no",
] as const;

/** Numeric weight per recommendation, for an overall lean (−2..+2). */
const RECOMMENDATION_WEIGHT: Record<Recommendation, number> = {
  strong_yes: 2,
  yes: 1,
  no: -1,
  strong_no: -2,
};

export const MAX_CRITERIA = 12;
export const MAX_CRITERION_LEN = 120;
export const MIN_SCORE = 1;
export const MAX_SCORE = 5;
/** Below this many submitted scorecards, the decision is "needs more feedback". */
export const MIN_SCORECARDS_FOR_DECISION = 2;

export interface ScorecardRatingInput {
  criterion: string;
  score: number;
  comment?: string | null;
}

export interface ScorecardInput {
  interviewerId: string;
  recommendation: Recommendation;
  ratings: ScorecardRatingInput[];
}

export interface CriterionAggregate {
  criterion: string;
  /** Mean score across scorecards that rated this criterion (null if none did). */
  average: number | null;
  count: number;
}

export interface ScorecardAggregate {
  total: number;
  /** Mean of every individual criterion score across all scorecards (null if none). */
  overallAverage: number | null;
  perCriterion: CriterionAggregate[];
  /** Count of each recommendation value. */
  recommendationCounts: Record<Recommendation, number>;
  /** Net lean in [-2, 2] from recommendation weights (null when no scorecards). */
  recommendationLean: number | null;
  /** True until at least MIN_SCORECARDS_FOR_DECISION are in. */
  needsMoreFeedback: boolean;
}

export function isRecommendation(v: unknown): v is Recommendation {
  return typeof v === "string" && (RECOMMENDATIONS as readonly string[]).includes(v);
}

/** Round to one decimal place (half-up), avoiding float noise like 3.9999999. */
function round1(n: number): number {
  return Math.round((n + Number.EPSILON) * 10) / 10;
}

/**
 * Parse + validate a rubric (criterion labels) from unknown input (JSON string or
 * array). Trims, drops blanks/dupes (case-insensitive), caps length + count.
 * Never throws.
 */
export function parseScorecardCriteria(raw: unknown): string[] {
  let value = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    const label = item.trim().slice(0, MAX_CRITERION_LEN);
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
    if (out.length >= MAX_CRITERIA) break;
  }
  return out;
}

/**
 * Clamp a raw score to an integer in [MIN_SCORE, MAX_SCORE]; null when there's no
 * real score. Crucially, null/undefined/"" are treated as "no score" (not 0) so a
 * missing rating never silently becomes a 1 and drags the average down.
 */
export function clampScore(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.min(MAX_SCORE, Math.max(MIN_SCORE, Math.round(n)));
}

/**
 * Aggregate submitted scorecards into a single decision view. Each criterion's
 * average is computed only over scorecards that actually rated it (a missing
 * rating doesn't drag the mean down). `criteria` is the canonical rubric order;
 * any rated criterion not in the rubric (e.g. after a rubric edit) is appended so
 * historical feedback is never hidden.
 */
export function aggregateScorecards(
  scorecards: ScorecardInput[],
  criteria: string[] = [],
): ScorecardAggregate {
  const recommendationCounts: Record<Recommendation, number> = {
    strong_yes: 0,
    yes: 0,
    no: 0,
    strong_no: 0,
  };

  // Sum + count per criterion (keyed by exact label).
  const sums = new Map<string, { sum: number; count: number }>();
  const order: string[] = [];
  const ensure = (label: string) => {
    if (!sums.has(label)) {
      sums.set(label, { sum: 0, count: 0 });
      order.push(label);
    }
    return sums.get(label)!;
  };
  // Seed with the rubric so unrated criteria still show (average null).
  for (const c of criteria) ensure(c);

  let allScoresSum = 0;
  let allScoresCount = 0;
  let leanSum = 0;

  for (const sc of scorecards) {
    if (isRecommendation(sc.recommendation)) {
      recommendationCounts[sc.recommendation] += 1;
      leanSum += RECOMMENDATION_WEIGHT[sc.recommendation];
    }
    for (const r of sc.ratings) {
      const score = clampScore(r.score);
      if (score === null || typeof r.criterion !== "string") continue;
      const label = r.criterion.trim();
      if (!label) continue;
      const bucket = ensure(label);
      bucket.sum += score;
      bucket.count += 1;
      allScoresSum += score;
      allScoresCount += 1;
    }
  }

  const perCriterion: CriterionAggregate[] = order.map((criterion) => {
    const { sum, count } = sums.get(criterion)!;
    return {
      criterion,
      average: count > 0 ? round1(sum / count) : null,
      count,
    };
  });

  const total = scorecards.length;
  return {
    total,
    overallAverage: allScoresCount > 0 ? round1(allScoresSum / allScoresCount) : null,
    perCriterion,
    recommendationCounts,
    recommendationLean: total > 0 ? round1(leanSum / total) : null,
    needsMoreFeedback: total < MIN_SCORECARDS_FOR_DECISION,
  };
}
