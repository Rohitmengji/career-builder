# ADR-0019: Nurture sequences (consent-gated re-engagement campaigns)

Status: Accepted · Program B (recruiter power), slice B4. Built on C1 cron (ADR-0021), B3 talent pools (ADR-0018), and A2 consent (ADR-0011).

## Context

B3 added one-off pool re-engagement. Recruiters also want **scheduled, multi-step** nurture (e.g. day 0 / day 7 / day 30) — automatically, without spam, and only to candidates who opted in. The plan slated this for a durable queue (C2); it's achievable now on the shipped C1 cron + a DB-backed send log.

## Decision

- **Models** — `EmailCampaign` (draft|active|paused), `CampaignStep` (offsetDays + subject + body), `CampaignEnrollment` (by lowercased candidate email, `@@unique(campaignId,email)`), `CampaignSend` (`@@unique(enrollmentId,stepIndex)` — the idempotency key). Children cascade tenant → campaign → *.
- **Pure `shared/nurture.ts`** — `nextDueStep` delivers steps **sequentially** (never skips ahead) and **one per run** (anti-spam); `allStepsSent` marks an enrollment done. Unit-tested.
- **`campaignRepo`** — tenant-scoped CRUD + idempotent `enroll`/`recordSend` (P2002 → false) + dispatch queries.
- **`nurture-dispatch` cron task** (C1, hourly) — for each active campaign's active enrollments: compute `nextDueStep`; **consent-gate** (marketing consent, ADR-0011, default-deny); **record the send first** (idempotent dedupe), then email via `emailService`. Per-campaign failure isolation; capped per run; KV mutex (C1).
- **Routes** — `/api/admin/campaigns` (CRUD + status), `[id]/steps`, `[id]/enroll` (audience **from a talent pool**, reusing B3). Recruiter+, flag `nurture_email`, `viewer` denied.
- **GDPR §17** — `deleteCandidateData` now deletes `CampaignEnrollment` by email (PII), cascading sends.

### Deliberate tradeoffs

- **At-most-once delivery**: the send is recorded *before* emailing, so an email-provider failure means a *missed* step, never a *duplicate*. For marketing nurture, a missed step is far preferable to spam.
- **Consent at send time, not enroll time**: enrollment is just a record; consent is re-checked on every send, so a withdrawal (A2) stops future steps immediately.

## Consequences

Recruiters run automated, scheduled, consent-respecting nurture sequences over talent pools — completing the talent-CRM story (pools → sequences) entirely on already-shipped infra, no Redis required.

## Deferred

A durable queue (C2) for very large sends, per-step open/click analytics, branching sequences, and audience sources beyond talent pools (saved views, CSV).
