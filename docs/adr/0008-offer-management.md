# ADR-0008: Offer management

Status: Accepted · 2026-06-22 · Phase 3 of the hiring-workflow program (builds on the ADR-0005 event spine; mirrors ADR-0006 interviews + ADR-0007 scorecards).

## Context

An "offer" today is only the string `Application.status === "offer"` — there is no
offer entity, no compensation/start-date/expiry, no approval, and no candidate
self-service. That's the last missing pillar of the recruiter hiring loop.

## Decision (full approval workflow, candidate self-service, lazy expiry)

- **`Offer` model** — tenant-scoped, cascade off `Application` (no `candidateId` FK,
  ADR-0001 — candidate↔offer resolves by application email + tenant). Money mirrors
  `Job` (`salaryAmount Int?` + `salaryCurrency` + `salaryPeriod`). String status
  (SQLite has no enums). `createdBy` (Cascade) + optional `approver` (SetNull) Users;
  lifecycle stamps `approvedAt`/`sentAt`/`respondedAt`; `terms` (candidate-visible) vs
  `notes` (internal); `decisionNote` (candidate-authored).
- **Pure `packages/shared/offer.ts`** — the state machine is the single source of
  truth. 8 statuses; **approval is mandatory** (no edge reaches `sent` without passing
  `approved`, so "send without approval" is unrepresentable):
  ```
  draft            → pending_approval | rescinded
  pending_approval → approved | draft (request_changes) | rescinded
  approved         → sent | draft (request_changes) | rescinded
  sent             → accepted | declined | expired | rescinded
  accepted/declined/expired/rescinded → ∅ (terminal)
  ```
  `canTransition`, `isExpired` (true only for a `sent` offer past `expiresAt`; still
  acceptable AT the deadline; null = never), `effectiveStatus` (collapses an un-swept
  past-expiry `sent` → `expired` for display), `isReadyForApproval`. RBAC stays in the
  route. `packages/database` must NOT import this (layering).
- **Admin API** `/api/admin/offers` (recruiter+; CSRF; flag-gated). Approve / rescind /
  request_changes require the stricter `APPROVE_ROLES` (super_admin, admin,
  hiring_manager — excludes recruiter; separation of duties, reusing the jobs
  write-gate precedent). `createdById` is always the caller (never client-supplied).
  Every transition is an **atomic compare-and-swap** (`updateMany` guarded by the
  expected current status) so concurrent actions can't double-apply.
- **Candidate API** (web) `/api/offers` + `/api/offers/[id]` — own-only (email+tenant
  in the WHERE). Accept/decline is idempotent: a KV `incr` fast-path dedupe in front
  of an authoritative DB CAS that only transitions a still-`sent`, not-yet-expired
  offer. The candidate page links from the offer email (already authenticated — no
  token in URL).
- **Application-status sync** (in the route, mirroring the applications-PATCH
  3-write pattern): `send` → `Application.status = "offer"` (never regresses a more
  advanced status) + `offer_extended` + `status_change` events; `accept` → `"hired"`;
  **`decline` does NOT change the application status** — the recruiter triages
  (declining ≠ candidate rejected; reversible; avoids presumptuous auto-reject).
- **Privacy** — recruiter offer lists redact applicant identity (Blind Hiring);
  candidates see only their own offer (comp/terms shown — it's theirs). Candidate
  events use the existing non-identifying projection; offer event metadata carries no
  PII / no approver identity / no internal notes.
- **Emails** — `offerExtended` (to candidate, accept/decline deep link + formatted
  comp/start/expiry); `offerDecision` (internal, to the tenant admin on accept/decline).
- Flag-gated `offer_management` (default off, dev on).

## Expiry — lazy (authoritative), cron deferred

No cron infrastructure exists (both `vercel.json` have empty `crons`; `job-queue.ts`
is volatile). `expiresAt` is authoritative: it's **re-checked server-side at
accept/decline** (a lapsed offer is rejected, folded into the CAS WHERE so there's no
TOCTOU window) and shown as `expired` on read via `effectiveStatus`. Correctness does
not need a sweep — a cron always lags the candidate's click. This matches the ADR-0006
decision to defer cron.

## Deferred

A Vercel Cron `/api/cron/offer-expiry` (secret-guarded + KV-deduped) to *persist*
`sent → expired` and emit `offer_expired` events for offers nobody ever opens — fully
spec'd, not built. Expiry-reminder emails (T-24h). Counter-offers / negotiation
threads. PDF offer letters / e-signature. Multiple simultaneous live offers (v1
soft-warns on create when an active offer already exists). In-app notification center
(Phase 4).

## Consequences

The recruiter loop is complete end-to-end: draft → approve → send → candidate
accept/decline, with comp/expiry, separation-of-duties approval, candidate
transparency (timeline + email), and tenant isolation — all on the shared event spine.
