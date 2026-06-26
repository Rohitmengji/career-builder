# ADR-0015: Customizable pipeline stages

Status: Accepted · 2026-06-26 · Program B (recruiter power), slice B1. Shipped in two halves: **B1a** (#46, inert foundation) + **B1b** (this — activation, behind `custom_pipeline_stages`).

## Context

`Application.status` is effectively a fixed 6-value enum (`applied|screening|interview|offer|hired|rejected`) that offers status-sync, the **public** responsiveness badge, and analytics all read. Recruiters want to rename / insert / reorder stages — but a naive change would break all those readers. This is the riskiest refactor in the roadmap, so it shipped low-risk.

## Decision

**Keep `Application.status` as the canonical 6-value field the reasoners read — UNTOUCHED.** Custom stages are an additive display/assignment layer; the readers never change.

- **B1a (#46):** additive `PipelineStage` (per-tenant; `key`, `label`, `kind`, `order`, `color`, `isActive`, `isTerminal`) + `Application.stageId` FK + pure `shared/pipeline.ts` `kind` semantics + an idempotent backfill seeding the 6 default stages per tenant. Inert (flag off, nothing read `stageId`).
- **B1b (this):**
  - `shared/pipeline.statusForStage(stage)` — derives the canonical status to persist: a default stage keeps its exact key (`screening` stays `screening`); a custom stage collapses to its `kind`'s canonical status (`in_process`/`custom` → `interview`). So `status` is **always** one of the 6 — reasoners stay valid.
  - `stageRepo` (tenant-scoped CRUD) + `/api/admin/pipeline-stages` (GET list / POST add / PATCH reorder|update; manager+, CSRF, flag). The editor (`/pipeline`) forbids deactivating the last active stage of a required `kind` (applied/offer/hired/rejected), and key generation is collision-iterative + P2002-guarded.
  - The applications PATCH accepts `stageId` (flag-gated): resolve the stage **tenant-scoped** (`findByIdScoped` → cross-tenant = 400), persist `stageId` + the derived `status` via `applicationRepo.setStage`, then run the existing status-change side-effects (audit + candidate-visible event + email) with the **canonical** status. Events/timeline never store a `stageId` — only status strings.
  - The applications status dropdown renders the tenant's stages when present (value = `stageId`); otherwise the standard 6 statuses. Flag **off ⇒ byte-identical** to before.

**Trade-off (documented):** custom mid-funnel stages collapse to `interview` for analytics/responsiveness (those metrics can't yet distinguish "Take-home" from "Onsite"). Richer per-stage timing is B5's job (reads the event spine). This deliberate simplification is what lets the reasoners stay untouched.

## Consequences

Tenants get custom stages + assignment without any risk to the public responsiveness badge / offers / analytics. Unblocks the drag-drop kanban board (B2 — a card move is a `{id, stageId}` PATCH, reusing the same side-effects).

## Verification

Adversarial review (2 lenses, each finding verified) confirmed flag-off safety + reasoner isolation + tenant scoping; found + fixed 1 medium (non-iterative stage-key collision → 500; now iterative + P2002→409). `pipeline.ts` no-regression tests prove the `kind` helpers match the legacy sets; 410 unit tests green.
