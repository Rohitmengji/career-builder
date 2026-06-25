# ADR-0013: EEO voluntary self-identification

Status: Accepted · 2026-06-25 · Program A (Trust & Compliance), slice A5. US EEO-1 reporting, built so leakage is structurally impossible.

## Context

Employers (esp. US federal contractors) must report applicant demographics in aggregate — but using demographics in an individual hiring decision is the core illegal act. The design must make leakage *impossible*, not merely discouraged.

## Decision — five isolation boundaries

- **(1) No ORM relation.** `EeoSelfId` has NO Prisma relation to/from `Application` (keyed by `applicationId` as a plain column). No recruiter query can ever `include` it.
- **(2) No individual read.** `eeoRepo` exposes ONLY `record()`, `listForAggregate()` (returns the 5 demographic columns WITHOUT id/applicationId — unlinkable), and `deleteForApplications()`. There is deliberately no `findByApplication`/`findById`/list-with-ids.
- **(3) Suppressed aggregate only.** Pure `packages/shared/eeo-aggregate.ts` copies the salary-benchmark k-anonymity precedent: small-cell suppression (k=`EEO_MIN_CELL`=5) **plus complementary suppression** (never leave exactly one cell hidden, since `total − shown` would reveal it). Never returns a raw sub-threshold count.
- **(4) Excluded from candidate-facing + recruiter surfaces.** Not in blind-hiring payloads, not in the data export by default. The admin report route is **admin-only** (super_admin/admin — stricter than recruiter) and returns only the suppressed aggregate; raw rows never leave the server.
- **(5) Never enters AI.** The matching AI receives only free-text + requirements; EEO is not on the application object it sees.

- **Capture** is a SEPARATE `POST /api/eeo` (a different request than apply), own-application only (email+tenant), closed-vocab zod (incl. `decline_to_state`), flag `eeo_self_id`. A voluntary, clearly-labeled form on `/applications`.
- **Erasure** — §17 deletion + the retention sweep hard-delete `EeoSelfId` for the affected applications (ADR-0011).

## Consequences

Aggregate diversity reporting is possible without any path to individual demographics in the hiring flow. The suppression guarantees are pure + unit-tested (mirroring the k-anon salary tests).

## Deferred

A richer admin EEO dashboard UI (the suppressed aggregate API ships now; charting is a follow-up). Reason×demographic cross-tabs (only ever inside the suppressed aggregator).
