# ADR-0009: In-app notification center

Status: Accepted · 2026-06-22 · Phase 4 (final) of the hiring-workflow program — fed by the ADR-0005 event spine.

## Context

The workflow now emits rich `ApplicationEvent`s (status changes, interviews,
scorecards, offers), but the only push channel is email. Recruiters and candidates
need an at-a-glance, in-app "what just happened" surface. This is the natural
consumer of the event spine and the last planned phase.

## Decision

- **`Notification` model** — tenant-scoped, recipient-polymorphic:
  `{ recipientType "user"|"candidate", recipientId, type, title, body?, link?,
  applicationId?, readAt?, createdAt }`. `recipientId` is a **User id** for a
  recruiter, or the **lowercased application email** for a candidate (no
  `candidateId` FK, ADR-0001). No FK relations — kept decoupled.
- **`notificationRepo`** — every read/write scoped by
  `(tenantId, recipientType, recipientId)`; candidate ids normalized to lowercase
  so a case-variant email can't see a different set. `markRead`/`markAllRead` only
  touch the caller's own unread rows. Lists are bounded (cap 30).
- **Fan-out from the event spine** — `eventRepo.record()` turns a candidate-visible
  event into a **candidate** notification when `actorType !== "candidate"` (don't
  notify someone about their own action). Best-effort: wrapped in try/catch so a
  notification failure never blocks event recording. Not flag-gated at the DB layer
  (writes history regardless; the API/UI gate exposure incl. per-tenant flag), so
  enabling the feature surfaces recent activity immediately.
- **Recruiter notifications** — the offers `submit_for_approval` action notifies the
  tenant's approvers (`APPROVE_ROLES`). **No candidate identity in the body**
  (respects Blind Hiring — recruiter surface): "An offer for {jobTitle} is awaiting
  your approval."
- **APIs** — candidate `GET/PATCH /api/notifications` (own by email+tenant; CSRF via
  web middleware) + recruiter `GET/PATCH /api/admin/notifications` (own by
  userId+tenant; PATCH CSRF-guarded). PATCH marks one (`{id}`) or all read.
- **UI** — `NotificationBell` (bell + unread badge + dropdown, 60s poll) in the
  candidate `SiteHeader` and on the admin dashboard.
- Flag-gated `notifications` (default off, dev on); when off, GET returns an empty
  feed so the always-mounted bell stays quiet.

## Consequences

- The event spine now powers email AND in-app notifications with no new write paths
  in the feature routes (candidate notifications are derived centrally in
  `eventRepo.record`). Recipient-scoped + tenant-isolated; recruiter notifications
  are Blind-Hiring-safe.

## Deferred

A shared admin chrome (the bell currently mounts on the dashboard only — there is no
app-wide admin nav). Richer recruiter triggers (assigned-interview, scorecard-due).
Per-notification deep links beyond `/applications`. Real-time push (currently a 60s
poll). Email digest of unread notifications.
