# ADR-0005: ApplicationEvent — the hiring-workflow event spine

Status: Accepted · 2026-06-21 · Foundation for the hiring-workflow program (interviews, scorecards, offers, notifications, candidate timeline).

## Context

Application status changes are currently recorded only as **freetext audit entries**
(`writeAuditLog(userId, email, "application_status_change", "application abc123: applied → screening")`)
— `entity`/`entityId` are null and the from/to is embedded in a human string. Consequences:
- There is **no real candidate status timeline** (the `application-status` renderer block is a
  `setTimeout` simulation), and no structured way to reconstruct one.
- The shipped Employer Responsiveness Score (ADR-0003) is **rate-only** — it can't compute accurate
  time-to-first-response / time-to-decision because there's no per-event timestamp linked to an
  application.
- The upcoming interview / scorecard / offer features each need a consistent place to record
  activity, and an in-app notification center needs a source of truth for "what happened".

`auditRepo.logProfileView` already demonstrates a structured, candidate-safe pattern
(`entity:"application", entityId, action`), but the AuditLog is the security/compliance trail and
overloading it with typed workflow data + candidate-visibility projection would muddy both.

## Decision

Introduce a dedicated **`ApplicationEvent`** model as the workflow timeline, separate from `AuditLog`:

```
ApplicationEvent {
  id, tenantId, applicationId,
  type,           // status_change | interview_scheduled | interview_confirmed | ... | offer_accepted ...
  fromStatus?, toStatus?,
  actorId?, actorType,   // recruiter | candidate | system
  visibility,            // "candidate" | "internal"
  metadata,              // JSON — NEVER candidate PII
  createdAt
}  @@index([tenantId, applicationId])  @@index([tenantId, type])
```

- **`eventRepo`** records events and reads them two ways: `listForApplication` (internal, full) and
  **`listCandidateVisible`** which projects to `{ type, toStatus, at }` only — never actor identity or
  internal metadata (mirrors `auditRepo.findProfileViews`). The candidate timeline = candidate-visible
  events for the candidate's own application ids (resolved by email+tenant per ADR-0001).
- **Status changes** write an `ApplicationEvent` (visibility:candidate) in the admin PATCH + bulk
  routes, alongside the existing candidate email. `writeAuditLog` stays for the compliance trail —
  the two logs have different jobs.
- **Responsiveness** gains time-to-first-response / time-to-decision computed from events, with the
  existing rate metric as the fallback when events are sparse (older applications predate events).
- Every later phase (interviews/scorecards/offers) emits typed events; the notification center reads
  them. `AuditLog` is NOT extended for workflow data.

## Consequences

- One typed spine powers the candidate timeline, accurate responsiveness timing, and notifications —
  no freetext parsing.
- Events are append-only and tenant-scoped; candidate-visible projection prevents internal/actor leakage.
- Historical applications (pre-event) simply have no events → timeline shows current status only and
  responsiveness falls back to the rate metric. Acceptable; events accrue going forward.
- Metadata must never carry candidate PII (it can surface in candidate-visible contexts via type);
  identity stays in the `Application` row, governed by Blind Hiring.
