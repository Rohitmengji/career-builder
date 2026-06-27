# ADR-0031: Evidence-Coverage Gate for scorecards

Status: Accepted · Novel fairness nudge (research idea). Complements the AI Scorecard Bias Linter (ADR-0026) and Interviewer Calibration (ADR-0028); builds on scorecards (ADR-0007).

## Context

Structured-interview research is clear: scores are far less biased when each rating is backed by a concrete, job-related justification. The bias linter (ADR-0026) checks the *language* of comments; nothing yet checks *coverage* — whether ratings (especially extreme 1/5 scores, the most halo/horn-prone) have any evidence at all.

## Decision

- **Pure `shared/evidence-coverage.computeEvidenceCoverage`** — reduces a scorecard's ratings to `{total, withEvidence, ratio, missing, extremesMissing, adequate}`. Evidence = a comment of ≥ `MIN_EVIDENCE_CHARS` (15); `extremesMissing` counts score-1/5 ratings with no evidence; `adequate` = ratio ≥ 0.6 **and** no unjustified extreme. Empty ratings are trivially adequate. Pure + unit-tested.
- **Computed in the scorecards `GET` serialize** — `coverage` is `null` when the `evidence_coverage` flag is off (no behavior change); no new route, no new storage, no migration. Reuses the route's existing tenant + hiring-team + recruiter+ scope.
- **UI** — a per-scorecard chip in `ScorecardsDialog`: "✓/⚠ Evidence: N/M criteria" + "K extreme scores unjustified". **Advisory** — never blocks submit or any decision; carries no candidate PII (it measures the recruiter's own evaluation).

Flag `evidence_coverage`, default-off.

## Consequences

Interviewers get a gentle, immediate nudge toward evidence-based scoring — especially on the extreme scores that most need justification — strengthening the fairness story alongside the bias linter and calibration. Zero risk surface: pure, internal, advisory, single-tenant.

## Deferred

An optional per-tenant **require-evidence-on-submit** mode (block a scorecard until extreme scores are justified), and per-criterion evidence prompts in the submission form.
