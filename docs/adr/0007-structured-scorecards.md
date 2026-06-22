# ADR-0007: Structured interview scorecards

Status: Accepted · 2026-06-22 · Phase 2 of the hiring-workflow program.

## Context

Evaluation today is a single `Application.rating` (1–5) + freetext comments — no
per-interviewer, criteria-based feedback, no aggregated decision view. That's
weak for quality-of-hire and for fairness (no structured, comparable signal).

## Decision

- **Per-job rubric:** `Job.scorecardCriteria` — JSON string[] of criterion labels
  (same shape/handling as `requirements`; edited as one-per-line in the job form).
- **Models:** `Scorecard { applicationId, interviewId?, interviewerId,
  recommendation (strong_yes|yes|no|strong_no), overallNotes?, submittedAt }` +
  `ScorecardRating { scorecardId, criterion, score 1–5, comment? }`. Tenant-scoped,
  cascade off Application. One scorecard per interviewer per application
  (enforced) — re-submitting replaces theirs.
- **Pure `shared/scorecard.ts`:** aggregate across interviewers — average score
  per criterion + overall, recommendation distribution, and a "needs more
  feedback" flag below a minimum count. Unit-tested.
- **Admin only** (recruiter+): submit a scorecard + see the aggregated decision
  panel on the application. Scorecards are **internal** — never candidate-visible;
  a `scorecard_submitted` ApplicationEvent (visibility:internal) feeds the
  recruiter timeline/notifications.
- **Fairness:** criteria-based scoring; the scoring view respects Blind Hiring
  (the applicant's identity is redacted there, so evaluation is skills-first).
- Flag-gated `interview_scorecards` (default off, dev on).

## Consequences

- Comparable, criteria-based evaluation + an at-a-glance decision view, without
  exposing anything to the candidate. Builds on the event spine (ADR-0005) and
  links optionally to interviews (ADR-0006).
- Criterion labels are stored per scorecard rating (denormalized) so renaming a
  job's rubric later doesn't orphan historical ratings.
