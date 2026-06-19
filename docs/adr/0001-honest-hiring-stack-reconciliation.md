# ADR 0001 — "Honest Hiring" brief: reconciliation with the real stack

**Status:** Accepted · **Date:** 2026-06-19
**Context:** The engineering brief (v1.0) for "The Honest Hiring Platform" lists
assumptions in its Section 2 and instructs: *reconcile against the actual repo
before writing code.* This ADR records the deltas and the decisions they force.

## Decisions

### 1. Database is SQLite (dev) / Turso·libSQL (prod) — NOT PostgreSQL
The brief (§3.1.2) mandates **PostgreSQL Row-Level Security** as a second,
DB-enforced isolation layer. **SQLite/Turso has no RLS**, so that specific
control is impossible. We achieve the brief's *intent* ("two independent
layers, don't rely on app code alone") with what the stack supports:

- **Layer 1 — repository scoping:** every tenant-scoped read/write goes through
  repositories that filter by `tenantId`; mutations use `updateMany`/`deleteMany`
  with `{ id, tenantId }` so a foreign id is silently dropped, not mutated.
- **Layer 2 — `@career-builder/database/tenant-guard`:** `tenantWhere()` /
  `assertTenantOwned()` helpers + a **deliberate cross-tenant CI test** that must
  FAIL the build if isolation regresses (`tenant-guard.test.ts`).
- A global Prisma `$extends` interceptor was evaluated and deferred (update/
  delete use unique-where types that can't take an injected `tenantId`; a global
  hook breaks legitimate admin cross-tenant reads). Escape hatch = raw `prisma`.

**Consequence:** treat "RLS" in the brief as "tenant-guard + deliberate-leak
test." If we ever migrate to Postgres, add real RLS as Layer 2.

### 2. No `TenantConfig` model — config lives in `Tenant.settings` (JSON)
There is no `TenantConfig` table. Per-tenant config is a JSON blob on
`Tenant.settings` (alongside `branding`/`theme`), already used for
`featureFlags` and `email`. **Blind-hiring config therefore needs NO migration**
— it is `Tenant.settings.blindHiring = { enabled, fields }`.

### 3. Candidate has `resumeUrl` only — NO extracted resume text
`Candidate`/`Application` store `resumeUrl` (+ `headline`/`bio`/`coverLetter`),
not parsed resume text. **Feature #1 (match scoring) has a real dependency:** it
needs text to score. Decision deferred to that increment — v1 options: score
against `headline + bio + coverLetter + structured fields`, add an optional
"paste experience" field, or add sandboxed PDF parsing (§3.2). Not a blocker
for Feature #4.

### 4. `AuditLog` is reused for the candidate-visible view log
`AuditLog` has `action, entity, entityId, details, ipAddress, userId, tenantId,
createdAt` — sufficient. A profile view is logged as
`action="candidate_profile_view", entity="application", entityId=<applicationId>`.
The candidate-facing "who viewed me" reads only those rows (tight filter), so the
internal staff audit log is never exposed wholesale.

### 5. No candidate↔application FK; no candidate-detail page in admin
`Application` is email-based (no `candidateId` FK). The candidate's "who viewed
me" joins by `email + tenantId` → their application ids → matching audit rows.
Admin is list-based (no candidate-detail page), so a recruiter "profile view" is
logged when a recruiter opens an individual candidate's detail interaction
(the per-application comments fetch) — the closest existing per-candidate signal.

### Confirmed-correct assumptions
Row-level tenancy with `tenantId` on every row ✓ · `callAi()` AI client exists
(`@career-builder/ai-client`) ✓ · GrapesJS + per-tenant token theming ✓ ·
`Job.requirements`/`niceToHave`/`salaryMin`/`salaryMax`, `Application`,
`Candidate`, `AnalyticsEvent` ✓ · per-tenant feature flags
(`@career-builder/shared/feature-flags`) ✓ · zod at the server boundary ✓.
