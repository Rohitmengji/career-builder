# ADR-0021: Vercel Cron foundation

Status: Accepted · 2026-06-22 · Program C (platform/infra), slice C1. Enabler for deferred scheduled work.

## Context

Several features were deferred for lack of scheduled-job infrastructure: offer-expiry
sweeps (ADR-0008), interview T-24h/T-1h reminders (ADR-0006), and the upcoming GDPR
data-retention purge (ADR-0011). Both `vercel.json` files had empty `crons`, and the
in-process `packages/shared/job-queue.ts` is volatile (lost on cold start). We need one
reliable, secret-guarded scheduled entrypoint.

## Decision

- **One dispatcher route** `apps/admin/app/api/cron/[task]/route.ts` (the admin app owns
  recruiter/system data). `GET /api/cron/<task>` looks the task up in a registry and runs
  it. Real tasks register here in their owning slices (`retention-sweep`, `offer-expiry`,
  `interview-reminders`); C1 ships only a trivial `health` task.
- **Auth** `apps/admin/lib/cron.ts` `assertCron(req)` — Vercel Cron sends
  `Authorization: Bearer $CRON_SECRET`. Verified with a length check + `timingSafeEqual`.
  **Fail closed**: if `CRON_SECRET` is unset, every request is denied.
- **Idempotency**: a per-task KV mutex (`getKV().incr("cron:<task>:lock", 290s)`) skips a
  duplicate/overlapping invocation; the lock is released in `finally`. Fail-open (KV down →
  run anyway) because every task MUST also be DB-state-authoritative + idempotent — the
  mutex is an optimization, not the correctness boundary.
- **Reachability**: the admin middleware rate-limits `/api/*` and CSRF-checks only
  mutations, so a `GET` cron request passes through to `assertCron` (no session cookie
  needed). `vercel.json` schedules `/api/cron/health` daily; task schedules are added with
  their slices.

## Consequences

Scheduled work is now possible and uniform. Each new task is a registry entry + a
`vercel.json` schedule + (its own) idempotent logic. `CRON_SECRET` must be set in the
admin Vercel project for any cron to run.

## Deferred

Durable queue (C2) for retried/long async work; the volatile in-process job-queue's
consumers migrate there or to cron-driven retries.
