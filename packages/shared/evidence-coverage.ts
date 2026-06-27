/*
 * @career-builder/shared/evidence-coverage — "no score without evidence" (ADR-0031).
 *
 * NOVEL fairness nudge: structured-interview research shows scores are far less biased
 * when each rating is backed by a concrete, job-related justification. This measures how
 * much of a scorecard's ratings carry written evidence — and especially flags EXTREME
 * scores (1 or 5) given with no justification, the ones most likely to be gut-feel /
 * halo / horn bias. Complements the AI bias linter (ADR-0026, which checks the LANGUAGE)
 * by checking COVERAGE. Pure, no DB; advisory (a nudge, never auto-blocks a decision).
 */

export interface RatingEvidence {
  score: number;
  comment?: string | null;
}

/** A comment must be at least this many trimmed chars to count as real evidence. */
export const MIN_EVIDENCE_CHARS = 15;
/** Below this fraction of evidenced ratings the scorecard is flagged "thin". */
const ADEQUATE_RATIO = 0.6;

export interface EvidenceCoverage {
  total: number;
  withEvidence: number;
  /** 0–1, fraction of ratings carrying real evidence (1 when there are no ratings). */
  ratio: number;
  missing: number;
  /** Extreme scores (1 or 5) with NO evidence — the most important to justify. */
  extremesMissing: number;
  /** True when coverage is good AND no extreme score is unjustified. */
  adequate: boolean;
}

function hasEvidence(r: RatingEvidence): boolean {
  return (r.comment?.trim().length ?? 0) >= MIN_EVIDENCE_CHARS;
}
function isExtreme(score: number): boolean {
  return score === 1 || score === 5;
}

/** Measure evidence coverage of a scorecard's ratings. Pure + deterministic. */
export function computeEvidenceCoverage(ratings: RatingEvidence[]): EvidenceCoverage {
  const total = ratings.length;
  if (total === 0) {
    return { total: 0, withEvidence: 0, ratio: 1, missing: 0, extremesMissing: 0, adequate: true };
  }
  let withEvidence = 0;
  let extremesMissing = 0;
  for (const r of ratings) {
    const evidenced = hasEvidence(r);
    if (evidenced) withEvidence += 1;
    if (isExtreme(r.score) && !evidenced) extremesMissing += 1;
  }
  const ratio = Math.round((withEvidence / total) * 100) / 100;
  return {
    total,
    withEvidence,
    ratio,
    missing: total - withEvidence,
    extremesMissing,
    adequate: ratio >= ADEQUATE_RATIO && extremesMissing === 0,
  };
}
