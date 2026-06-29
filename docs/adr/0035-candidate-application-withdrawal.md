# ADR-0035: Candidate-initiated application withdrawal

Status: Accepted · Candidate-control / transparency feature, alongside candidate data rights (ADR-0011) and the Decision Ledger (ADR-0027).

## Context

Candidates can apply, see their status, view their data, and accept/decline offers — but they cannot gracefully step away from a process they're no longer interested in. Without a withdraw action they either ghost the employer (ironic, given the platform's "we don't ghost" thesis) or email asking to be removed. Giving candidates a clean, self-service exit is a small but meaningful piece of candidate control.

## Decision

- **Pure `shared/application-status`** — `WITHDRAWABLE_STATUSES` (`applied`, `screening`, `interview`) + `isWithdrawable(status)`. Withdrawal is allowed only while the application is **in play and pre-offer**: once an offer is out the candidate uses accept/decline (ADR-0008), and a terminal application (`hired`/`rejected`/`withdrawn`) can't be withdrawn. Unit-tested.
- **`applicationRepo.withdrawByIdIfActive(id, tenantId)`** — atomic CAS `updateMany` with the withdrawable statuses folded into the WHERE (no TOCTOU), returning the affected count. The status list mirrors `WITHDRAWABLE_STATUSES` (the repo can't import `shared`).
- **`POST /api/applications/[id]/withdraw`** (web) — `getCandidateSession`, **own-only** (`app.email == session.email`, tenant, ADR-0001), `isWithdrawable` pre-check then the atomic CAS (0 → 409). Emits a candidate-visible `application_withdrawn` event with `actorType:"candidate"` (so it does **not** fan out a self-notification). CSRF via the web same-origin middleware (no token), exactly like the offer accept/decline route. Flag-gated.
- **`withdrawn` as a candidate-initiated terminal status** — the responsiveness (ADR-0003) and ghosting-risk (ADR-0033) engines already treat any non-`applied`, non-responded status as **neither responded nor ghosted**, which is exactly right: a candidate who left voluntarily is not an employer failure. Surfaced in the candidate timeline and the recruiter list (a display-only status — recruiters can't *set* it from the dropdown, and the admin PATCH enum is unchanged).
- **Write-path integrity (so the new terminal status is honored by every mutator, not just the reader engines):**
  - Admin status/stage change (`PATCH /api/admin/applications`) is **refused with 409** when the application is already `withdrawn` (`isRecruiterLocked`) — a recruiter can't silently re-activate a candidate's withdrawal. Annotations (rating/notes) remain allowed; `hired`/`rejected` stay recruiter-editable as before.
  - Bulk status/reject **excludes** withdrawn rows from the mutation *and* all side effects (events, ledger seals, emails), backstopped by a `status notIn ["withdrawn"]` guard in `bulkUpdateStatus`.
  - Offer **send/accept** now advance the application via an **atomic, status-guarded CAS** (`advanceStatusIfIn`, source set `PRE_OFFER`/`PRE_HIRE`) instead of a stale-snapshot blind write — so a concurrent withdrawal can't be clobbered (the advance, candidate event, and ledger seal are all skipped when the app already left the valid source state).
- **UI** — a "Withdraw application" action on each in-play application on the candidate `/applications` page, with a confirm.

Flag `candidate_withdrawal`, default-off.

## Consequences

Candidates get a respectful, self-service exit; recruiters get an accurate signal (withdrawn ≠ rejected ≠ ghosted) instead of a stale open application. No schema change (status is a string), no migration. Tenant-isolated, own-only, flag-gated; the new status is inert for every existing engine because they already classify unknown/terminal statuses safely.

## Deferred

Auto-declining an open offer if a candidate withdraws at the offer stage (currently they use the offer flow instead), an optional withdrawal reason surfaced to the recruiter, and a recruiter-side "candidate withdrew" notification — out of scope for v1.
