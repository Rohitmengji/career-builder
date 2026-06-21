# ADR-0006: Interview scheduling

Status: Accepted · 2026-06-21 · Phase 1 of the hiring-workflow program (builds on the ADR-0005 event spine).

## Context

No interview model exists. Recruiters can move an application to the `interview`
status but can't record when/with whom/how. Candidates get a generic "we'll reach
out" email and no detail. Needed: a real interview entity, candidate-facing
detail + confirmation, calendar (ICS) invites, and timeline events.

## Decision (Phase 1 — lean, end-to-end)

- **`Interview` model** (one scheduled time per interview): `applicationId`, `jobId?`,
  `round`, `type` (phone|video|onsite), `status` (scheduled|confirmed|cancelled|
  completed|no_show), `interviewerId?` (User), `scheduledAt` (UTC), `durationMins`,
  `timezone` (IANA), `location?`, `meetingUrl?`, `notes?` (internal). Tenant-scoped,
  cascade off Application.
- **Times stored in UTC** + an explicit IANA `timezone` carried for display; never
  compare wall-clock strings.
- **Pure `shared/ics.ts`** generates an RFC-5545 VEVENT (escaping, CRLF, UID, UTC
  stamps) — unit-tested, framework-agnostic. Served to candidates as a download.
- **Recruiter** schedules / cancels / completes (recruiter+); **candidate** views
  their own interviews and **confirms** attendance (candidate-auth, email-linked
  per ADR-0001). Each transition writes a candidate-visible `ApplicationEvent`
  (`interview_scheduled`/`confirmed`/`cancelled`) → shows on the candidate timeline.
- **Email** (per-tenant sender): interview invitation (with ICS) + cancellation.
- **Blind Hiring:** interviewer `notes` are internal; the interview carries no new
  candidate PII; recruiter views of the applicant stay redacted as usual.
- Flag-gated `interview_scheduling` (default off, dev on).

## Deferred (documented, follow-ups)

- **Phase 1b — multi-slot self-booking:** recruiter proposes N slots, candidate
  picks one (adds an `InterviewSlot` model + selection flow + KV double-booking
  guard). Phase 1 ships single-time + candidate confirm, which is the 80% case.
- **Phase 1c — reminders:** T-24h/T-1h reminders need real scheduling. The
  in-process `job-queue.ts` is volatile → use **Vercel Cron** → a secret-guarded
  `/api/cron/interview-reminders` with KV dedupe.

## Consequences

- End-to-end interview scheduling ships now; the event spine makes every step
  visible to the candidate. Slot self-booking + reminders layer on without
  reworking the model (slots reference an Interview).
