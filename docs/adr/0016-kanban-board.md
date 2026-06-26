# ADR-0016: Kanban pipeline board

Status: Accepted · 2026-06-26 · Program B (recruiter power), slice B2. The visible payoff of the ADR-0015 pipeline stages.

## Context

Recruiters expect a drag-drop board to move candidates through the pipeline (Greenhouse/Lever parity). B1b made stages real; this surfaces them visually.

## Decision

- A **dedicated page** `/applications/board` (not bolted onto the already-large list page — lower risk). Columns are the tenant's active `PipelineStage`s when `custom_pipeline_stages` is on, otherwise the 6 canonical statuses.
- **Cards** come from the existing `GET /api/admin/applications?perPage=100`, which already redacts identity under Blind Hiring — so the board is blind-hiring-safe with no new code.
- **Moving a card** = native HTML5 drag-and-drop (no new dependency) → the **same** `PATCH /api/admin/applications {id, stageId|status}` the list view uses (reviewed in B1b). So the status_change event, candidate email, and tenant-scoping all come for free; no new backend surface or data model. Optimistic update, reload-to-resync (a stage move also changes the derived status).
- A "Board view" / "List view" link pair connects the two.

## Consequences

A real kanban with zero new backend risk — it's a read + the already-reviewed move PATCH. Works with or without custom stages.

## Deferred (B2b)

Candidate **tags** + **saved filter views** (separate models/UI). Per-column pagination / lazy-load for very large pipelines (the board currently shows up to 100). Drag-drop reordering within a column.
