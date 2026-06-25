# ADR-0012: Candidate-visible interview feedback

Status: Accepted · 2026-06-25 · Program A (Trust & Compliance), slice A4. On-thesis transparency built on the ADR-0007 scorecard engine.

## Context

Scorecards (ADR-0007) are recruiter-internal. Candidates get no insight into how an interview went — a transparency gap the "Honest Hiring" thesis should close, carefully (raw scores/comments/identities must not leak).

## Decision

- **Recruiter releases deliberately, per application.** `Application.feedbackReleasedAt` is set by an explicit recruiter action (a PATCH on the scorecards route, recruiter+, CSRF, flag `interview_feedback`) — typically post-decision. Un-release clears it.
- **Anonymized projection.** Reuse `aggregateScorecards`; a new pure `candidateFeedbackProjection(agg)` returns ONLY per-criterion averages + the overall average + an interviewer count. It deliberately omits interviewer identity, recommendation labels (too blunt to surface raw), and all free-text comments. Unit-tested with `.not.toContain` leak assertions.
- **Candidate read is own-only + released-only.** `GET /api/applications/[id]/feedback` verifies the application belongs to the candidate (email+tenant, ADR-0001) and that `feedbackReleasedAt` is set; otherwise 404 / `{feedback:null}`. `/api/applications` exposes a `feedbackReleased` boolean (flag-gated) so the candidate page renders an "Your interview feedback" block that fetches the detail.
- Flag-gated `interview_feedback` (default off, dev on).

## Consequences

Candidates can see a constructive, anonymized summary of how they were evaluated when the employer chooses to share it — transparency without exposing interviewers or internal deliberation.

## Deferred

Qualitative written feedback to candidates (only quantitative averages for now). Per-tenant default-on policy (release is per-application today).
