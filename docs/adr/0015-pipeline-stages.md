# ADR-0015: Customizable pipeline stages

Status: Accepted · 2026-06-22 · Program B (recruiter power), slice B1. Foundation for the kanban board + custom funnels. Shipped in two halves; **B1a (this) is inert**.

## Context

`Application.status` is effectively a fixed 6-value enum (`applied|screening|interview|offer|hired|rejected`) referenced across offers status-sync, responsiveness (a public badge), analytics, candidate labels, and the event spine. Recruiters want to rename/insert/reorder stages, and the kanban board needs ordered columns — but a naive change would break all those consumers. This is the riskiest refactor, so it ships low-risk in two halves.

## Decision

**Keep `Application.status` (string) AND add `stageId` FK** — the single decision that makes this backward-compatible and reversible. `status` stays the source of truth until B1b; then it becomes a derived back-compat cache (`= stage.key`), so every existing `groupBy(status)`, email, and historical event keeps working unchanged.

- **`PipelineStage`** (per-tenant; optional per-job override via nullable `jobId`): `{ key, label, kind, order, color?, isActive, isTerminal }`. `@@unique([tenantId, jobId, key])`.
- **The `kind` semantic layer is the linchpin.** `kind ∈ {applied, in_process, offer, hired, rejected, custom}`. Every consumer reasons about `kind`, never the literal label — so a tenant can rename "Screening" → "Recruiter Chat" or insert "Take-home" without breaking offers/responsiveness/analytics. Pure `packages/shared/pipeline.ts` owns the contract: `DEFAULT_STAGES` (1:1 with today's 6), `isResponded/isPreOffer/isPreHire/isTerminal(kind)`, `LEGACY_STATUS_TO_KIND`, `KIND_DEFAULT_KEY`. (`packages/database` must not import shared — the backfill duplicates the seed.)
- **B1a (this slice — inert, flag off):** additive schema (`PipelineStage` + `Application.stageId`) + `pipeline.ts` + an idempotent backfill (`packages/database/backfill-pipeline-stages.ts`) that seeds the 6 default stages per tenant and sets `stageId` from `status`. **Zero behavior change** — no consumer reads `stageId` yet; a unit test proves the `kind` helpers classify the 6 default stages identically to today's hardcoded `PRE_OFFER`/`PRE_HIRE`/responded/terminal sets.
- **B1b (next, behind `custom_pipeline_stages`):** flip the 4 status-writers to set `stageId` + derive `status`; switch the 3 reasoners (offers, responsiveness, analytics) to `kind`; validate supplied stages against the tenant's in-route (keep the enum as the flag-off fallback — a security boundary); ship the per-tenant pipeline editor. Never store `stageId` in event `fromStatus/toStatus` (historical strings must survive renames). The editor forbids deleting the last stage of a required kind.

## Consequences

The kind layer + retained `status` lets every status-coupled consumer migrate independently in B1b instead of a risky big-bang. Unblocks the drag-drop kanban (a card move = a `{id, stageId}` PATCH, reusing the existing event/notification side-effects). Backfill must run once per environment (`npx tsx backfill-pipeline-stages.ts`).
