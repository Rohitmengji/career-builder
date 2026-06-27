/*
 * Interviewer Calibration (ADR-0028) — pure rater psychometrics. No DB, no I/O.
 *
 * NOVEL (no mainstream ATS): measures each interviewer's systematic LENIENCY/HARSHNESS
 * relative to the rest of the panel, so a team can correct rater bias before it skews
 * hiring. On-thesis (fairness): two candidates should get the same bar regardless of
 * which interviewer drew them.
 *
 * METHOD (transparent, defensible):
 *  - A rater's score for an application = the mean of their per-criterion 1-5 ratings.
 *  - For each application scored by >=2 raters, compute the application mean; each
 *    rater's DEVIATION = their score - that application mean (controls for candidate
 *    quality — we compare raters on the SAME candidates).
 *  - A rater's LENIENCY = mean deviation across their comparable applications
 *    (>0 lenient, <0 harsh). sampleSize = # comparable applications.
 *  - MIN-SAMPLE SUPPRESSION: leniency is withheld (suppressed=true) below MIN_SAMPLE —
 *    a tendency from 1-2 data points is noise, and naming a colleague on thin data is
 *    unfair. Panel agreement = mean within-application score spread (lower = agree).
 *
 * Internal-only (about staff evaluators, not candidates); no candidate PII.
 */

export interface CalibrationRow {
  interviewerId: string;
  interviewerName: string;
  applicationId: string;
  /** Mean of this interviewer's per-criterion 1-5 ratings for this application. */
  score: number;
}

export type RaterLabel = "lenient" | "harsh" | "balanced" | "insufficient_data";

export interface RaterCalibration {
  interviewerId: string;
  interviewerName: string;
  /** Mean of all this rater's application scores (display). */
  meanScore: number | null;
  /** Total applications this rater scored. */
  scored: number;
  /** Applications scored by >=2 raters (the comparable set leniency is computed on). */
  sampleSize: number;
  /** Mean deviation vs the panel on shared candidates (null when suppressed). */
  leniency: number | null;
  label: RaterLabel;
  suppressed: boolean;
}

export interface CalibrationResult {
  raters: RaterCalibration[];
  /** Mean within-application score spread across multi-rater apps (null if none). */
  panelAgreement: number | null;
  comparableApplications: number;
}

export const MIN_CALIBRATION_SAMPLE = 3;
/** |leniency| below this is "balanced" (≈ a sixth of a point on the 1-5 scale). */
const BALANCED_BAND = 0.3;

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

/**
 * Compute per-rater calibration from scorecard rows. Pure + deterministic. `minSample`
 * gates leniency disclosure (default MIN_CALIBRATION_SAMPLE).
 */
export function computeRaterCalibration(rows: CalibrationRow[], opts: { minSample?: number } = {}): CalibrationResult {
  const minSample = opts.minSample ?? MIN_CALIBRATION_SAMPLE;

  // Group by application to find multi-rater (comparable) applications.
  const byApp = new Map<string, CalibrationRow[]>();
  for (const r of rows) {
    const list = byApp.get(r.applicationId) ?? [];
    list.push(r);
    byApp.set(r.applicationId, list);
  }

  // Per-rater accumulators.
  const allScores = new Map<string, number[]>();     // every score (for meanScore + scored count)
  const deviations = new Map<string, number[]>();    // deviations on comparable apps (for leniency)
  const names = new Map<string, string>();
  const spreads: number[] = [];                      // per-app score spread (panel agreement)
  let comparableApplications = 0;

  for (const r of rows) {
    names.set(r.interviewerId, r.interviewerName);
    (allScores.get(r.interviewerId) ?? allScores.set(r.interviewerId, []).get(r.interviewerId)!).push(r.score);
  }

  for (const [, appRows] of byApp) {
    // Distinct raters on this application (a rater appears once per app by schema).
    if (appRows.length < 2) continue;
    comparableApplications += 1;
    const appMean = mean(appRows.map((x) => x.score));
    const scores = appRows.map((x) => x.score);
    spreads.push(Math.max(...scores) - Math.min(...scores));
    for (const x of appRows) {
      (deviations.get(x.interviewerId) ?? deviations.set(x.interviewerId, []).get(x.interviewerId)!).push(x.score - appMean);
    }
  }

  const raters: RaterCalibration[] = Array.from(allScores.keys()).map((id) => {
    const scores = allScores.get(id)!;
    const devs = deviations.get(id) ?? [];
    const sampleSize = devs.length;
    const suppressed = sampleSize < minSample;
    const leniency = suppressed ? null : round2(mean(devs));
    let label: RaterLabel;
    if (suppressed) label = "insufficient_data";
    else if (Math.abs(leniency!) < BALANCED_BAND) label = "balanced";
    else label = leniency! > 0 ? "lenient" : "harsh";
    return {
      interviewerId: id,
      interviewerName: names.get(id) ?? "Unknown",
      meanScore: scores.length ? round2(mean(scores)) : null,
      scored: scores.length,
      sampleSize,
      leniency,
      label,
      suppressed,
    };
  });

  // Stable, useful ordering: most-extreme leniency first, suppressed last.
  raters.sort((a, b) => {
    if (a.suppressed !== b.suppressed) return a.suppressed ? 1 : -1;
    return Math.abs(b.leniency ?? 0) - Math.abs(a.leniency ?? 0);
  });

  return {
    raters,
    panelAgreement: spreads.length ? round2(mean(spreads)) : null,
    comparableApplications,
  };
}
