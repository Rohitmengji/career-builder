# ADR-0033: Ghosting-Risk Nudges

Status: Accepted · On-thesis Trust-Layer feature. Builds on the Employer Responsiveness Score (ADR-0003) and complements the cross-tenant Employer Trust Index (ADR-0029).

## Context

The "we don't ghost" promise is the platform's signature wedge — but so far it is only ever *measured after the fact*: the public responsiveness badge (ADR-0003) and the cross-tenant trust index (ADR-0029) both report the share of applicants who heard back, looking backwards. Nothing helps a recruiter *avoid* ghosting in the first place. An application silently crossing the 14-day SLA is exactly the failure the badge later penalizes — and it's entirely preventable with a timely nudge.

## Decision

A recruiter-facing **proactive** nudge that surfaces the applications about to be ghosted, using the *exact same definitions* as the badge (apples-to-apples).

- **Pure `shared/ghosting-risk`** — `computeGhostingRisk(pending, now)` + `classifyGhostingRisk`. An application "awaiting response" is still in the initial `applied` state (once a human moves it to screening/interview/offer/hired/rejected the candidate has been answered — the ADR-0003 definition, reused via `GHOST_SLA_DAYS`). Classification: past the SLA → `overdue`; within `GHOST_WARN_DAYS` (4) of it → `at_risk`; otherwise `ok`. Returns counts + the actionable (at-risk/overdue) items, most-overdue first. `now` is passed in — pure + deterministic + unit-tested.
- **`applicationRepo.findPendingForGhostingRisk(tenantId, jobIds?, cap)`** — `status:"applied"`, tenant-scoped + hiring-team-scoped (`jobIds` undefined = all, `[]` = none → no rows), selecting only what the nudge shows (id, name, submittedAt, job title), oldest-first, bounded.
- **`GET /api/admin/analytics/ghosting-risk`** — recruiter+ (not viewer), tenant-scoped, hiring-team-scoped via `visibleJobIds`, **blind-hiring-aware** (the candidate name is redacted under blind hiring; the nudge itself — counts, days waiting, role — is identity-free). Read-only, `no-store`, flag-gated.
- **UI** — a "Ghosting risk" card on the analytics page: overdue + at-risk counts and the most-overdue applicants, or a green "you're keeping the promise" state when clear.

Flag `ghosting_risk_nudges`, default-off.

## Consequences

The responsiveness wedge becomes *actionable*, not just measurable: recruiters see who needs a reply before the promise breaks, which should directly lift the very responsiveness rate the badge and trust index report. Advisory only; reuses the established SLA definition so the nudge and the public score never disagree. Tenant- + team-isolated and blind-safe.

## Deferred

A scheduled digest (email/notification via the C1 cron) of at-risk applicants, and extending "awaiting response" to later-stage stalls (e.g. an application stuck in `screening` for weeks) once decision-time event data makes that unambiguous — out of scope for v1, which mirrors the badge's initial-response definition exactly.
