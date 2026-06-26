# ADR-0017: Hiring-velocity analytics

Status: Accepted · 2026-06-26 · Program B (recruiter power), slice B5. Leverages the ADR-0005 event spine.

## Context

The analytics page tracked top-of-funnel (views → applies) but nothing about how fast the team moves candidates. The `ApplicationEvent` spine already timestamps every `status_change`, so velocity metrics are computable without new tracking.

## Decision

- **Pure `packages/shared/hiring-metrics.ts`** `computeHiringMetrics(timelines)` — from each application's `submittedAt` ("applied" anchor) + its `status_change` events, computes **median** time-to-first-response, time-to-hire, and time-to-decision, each with a sample size (for thin-data suppression). Medians (robust to outliers); pre-apply clock-skew events ignored. Unit-tested.
- **`analyticsRepo.getApplicationTimelines(tenantId)`** assembles `{submittedAt, events[]}` per application (tenant-scoped, bounded).
- **`GET /api/admin/analytics/hiring`** (recruiter+, flag `advanced_analytics`, read-only) returns the computed metrics.
- A "Hiring velocity" card on the analytics page (renders nothing when the flag is off).

## Consequences

Recruiters see how fast they respond, hire, and decide — the operational complement to the candidate-facing responsiveness badge — with zero new event tracking.

## Deferred

Per-stage time-in-stage breakdown, source effectiveness by hire, offer-acceptance rate, and CSV export of the velocity report.
