# ADR-0020: Requisition approval (job-publish gate)

Status: Accepted · Program B (recruiter power), slice B6a. Hiring teams (B6b) are a follow-up.

## Context

Organizations gate job postings behind headcount sign-off — a recruiter shouldn't be able to publish a role to the world without an approver authorizing the hire. There was no approval step before publish.

## Decision

- **`Requisition { tenantId, jobId?, title, department?, headcount, justification?, status, createdById?, approverId?, decisionNote?, decidedAt? }`** — one per job (`@@unique(jobId)`).
- **Pure `shared/requisition.ts`** — the state machine: `draft → pending_approval → approved | rejected`, `rejected → draft`; `approved` is terminal. The **only** path to `approved` is via `pending_approval` (jump-to-approved is structurally unrepresentable). Mirrors `shared/offer.ts`. `allowsPublish(status)` is true only for `approved`.
- **`requisitionRepo`** — tenant-scoped CRUD + an **atomic CAS `transition`** (`updateMany WHERE status === fromStatus`) so a concurrent/stale approve applies at most once (→ 409).
- **`/api/admin/requisitions`** — GET (recruiter+), POST (recruiter+; cross-tenant job link rejected; duplicate-per-job → 409), PATCH (edit DRAFT only, or drive an action), DELETE. The route validates `canTransition` + RBAC, then the CAS. **RBAC**: submit/reopen = recruiter+; **approve/reject = manager+** (`APPROVE_ROLES`, excludes recruiter).
- **Publish gate (all paths)** — when `req_approval` is on, a job reaches `published` only with an `approved` requisition (`findByJob`, tenant-scoped). The gate covers **every** publish path, not just one: the PATCH `action: "publish"` branch and the PUT `isPublished:false→true` transition both require approval (else 409), and POST create forces `isPublished:false` (a brand-new job can't yet have an approved req — it must publish through the gated action). When the flag is **off**, publishing is byte-for-byte unchanged.

Behind the default-off `req_approval` flag; routes 404 when off. Every requisitions route denies `viewer`.

## Consequences

A job can't go live without an approved requisition (when enabled). The approval workflow + RBAC reuse the proven offer-approval shape. No change to publishing when the flag is off.

## Deferred

- **Hiring teams (B6b)** — scope application visibility to the team on a job.
- Configurable separation-of-duties (block self-approval), multi-step / multi-approver chains, and auto-creating a requisition when a job is drafted.
