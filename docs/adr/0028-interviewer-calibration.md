# ADR-0028: Interviewer Calibration Engine (rater psychometrics)

Status: Accepted · Novel fairness feature (research workflow's #2, score 86). Builds on ADR-0007 scorecards.

## Context

Structured scorecards capture 1–5 ratings, but interviewers differ systematically: some are lenient, some harsh. Two equally-qualified candidates can get different outcomes purely from *which* interviewer drew them — an unfairness no mainstream ATS surfaces. We have the raw signal (per-criterion ratings per interviewer per application) to measure and correct it.

## Decision

- **Pure `packages/shared/rater-calibration.ts`** — `computeRaterCalibration(rows)`:
  - a rater's score for an application = mean of their 1–5 ratings;
  - for each application scored by **≥2 raters**, deviation = rater score − application mean (controls for candidate quality — raters compared on the *same* candidates);
  - **leniency** = mean deviation across a rater's comparable applications (>0 lenient, <0 harsh); `sampleSize` = comparable applications;
  - **min-sample suppression** (`MIN_CALIBRATION_SAMPLE = 3`): leniency withheld below it (a tendency from 1–2 points is noise, and naming a colleague on thin data is unfair);
  - `panelAgreement` = mean within-application score spread. Pure + deterministic + unit-tested (6).
- **`scorecardRepo.getCalibrationRows`** — tenant-scoped, bounded; one row per scorecard with ≥1 rating: `{interviewerId, interviewerName, applicationId, score}`. **No candidate PII.**
- **`GET /api/admin/analytics/calibration`** — **manager+ only** (leniency is a sensitive per-evaluator signal — not for all recruiters), tenant-scoped, flag-gated (`rater_calibration`), read-only, `NO_STORE`.
- **UI** — an "Interviewer calibration" card on `/analytics`: a diverging leniency bar + label (lenient / harsh / balanced / not-enough-data) per interviewer, framed as a **fairness check, not a performance score**. Renders nothing for non-managers / flag-off.

Flag `rater_calibration`, default-off.

## Consequences

Hiring managers can see and correct systematic rater bias before it skews decisions — proactive fairness no ATS offers. Internal-only; about evaluators, never candidates; thin data suppressed to avoid unfairly labelling people.

## Deferred

Per-criterion calibration (not just overall), trend over time, an AI-written calibration summary, and self-serve "your calibration" for individual interviewers.
