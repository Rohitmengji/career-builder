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

## B6b: Hiring teams (application-visibility scoping)

When the `hiring_teams` flag is on, non-admin roles (recruiter / hiring_manager / viewer) may only read or mutate applications for jobs they are a **hiring-team member** of; super_admin/admin stay org-wide. Off → visibility unchanged.

- **`HiringTeamMember { tenantId, jobId, userId, role }`** (`@@unique(jobId,userId)`) + `hiringTeamRepo` (tenant-scoped; `listJobIdsForUser` is the allow-list).
- **Single enforcement helper** `apps/admin/lib/hiringTeams.ts` — `visibleJobIds(session)` (`null` = unrestricted; `[]` = **no access**, yields zero rows) and `canAccessJob(session, jobId)`. Because a missed call site is a leak, the rule lives in **one** place and is applied at **every** application-access path: the list GET (jobIds filter), application PATCH/DELETE, bulk, the per-application sub-routes (comments, resume, scorecards, tags), interviews + offers (incl. their entity-id PATCH paths, re-resolved to the application's job), talent-pool add-by-application, and the dashboard **recent-applications** widget (identity-bearing).
- **`/api/admin/jobs/[id]/team`** (manager+) manages membership; `HiringTeamDialog` (admin-only UI) assigns users. Tenant-isolated (job + user verified tenant-owned).

**Boundaries (deliberate):** aggregate analytics (counts / funnel / sources — non-PII numbers) stay org-wide; only the identity-bearing recent-applications widget is scoped. Comment **delete** is author-only. Candidate-facing web routes use candidate auth and are unaffected.

## Deferred

- Configurable separation-of-duties (block self-approval), multi-step / multi-approver requisition chains, auto-creating a requisition when a job is drafted, and team-scoping aggregate analytics.
