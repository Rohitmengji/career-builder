# ADR-0016: Application tags + saved views

Status: Accepted · Program B (recruiter power), slice B2b. Completes the B2 kanban slice (the board shipped first).

## Context

Recruiters need to annotate/segment candidates beyond the fixed pipeline status (e.g. "referral", "strong-culture-fit") and re-run the same filtered lists without re-clicking. Neither existed.

## Decision

**Tags** — a per-tenant tag library plus a many-to-many join:
- `ApplicationTag { tenantId, label, color }` — `@@unique([tenantId, label])`; renaming/recolouring updates everywhere (the join references `tagId`, not a copied label).
- `ApplicationTagOnApplication { tenantId, applicationId, tagId, createdById? }` — `@@unique([applicationId, tagId])`. `tenantId` is carried on the join too: tag-links are the cross-tenant-sensitive surface, so they are unambiguously tenant-owned (defense-in-depth).
- Colour is a **closed palette** (`shared/tags.TAG_COLORS`), enforced by a zod enum and rendered via a hard-coded Tailwind class map — a stored colour can never become raw CSS.
- `tagRepo` (tenant-scoped CRUD + idempotent link add/remove + `listForApplications`). The per-application route verifies **both** the application and the tag belong to the caller's tenant before linking (a foreign id on either side → 404).
- Tag filtering on the list uses **AND** semantics (an application must carry all selected tags).

**Saved views** — `SavedView { tenantId, userId, name, filters }`, **private per user** (scoped by `tenantId + userId`). `filters` is JSON restricted to a whitelisted key set (`shared/saved-view.SAVED_VIEW_FILTER_KEYS`) at both write and read, so a view can never smuggle arbitrary query shape into the list endpoint.

Both behind default-off flags (`application_tags`, `saved_views`); routes 404 when off. Tags are **internal-only** — never candidate-visible, never sent to AI.

**Blind hiring**: tag labels are recruiter-authored free text, so a label could re-identify a candidate the redaction hid (same risk class as the search box, which is already disabled under blind hiring). Therefore per-application tag chips are **suppressed server-side when blind hiring is on** (default-deny — a redaction leak is Sev1); the tag *filter* still works because it matches by tag id, not label. The library/manage UI stays available (it is not tied to a candidate row). Roles: every route denies the `viewer` role, matching the applications + tags endpoints.

## Consequences

Recruiters segment and filter the pipeline by tag (list + kanban cards) and save named filter presets. Tag links and saved views cascade-delete with the application / tenant / user, so erasure (ADR-0011) leaves no orphans.

## Deferred

Team-shared saved views, tag-based automation/nurture (B4), and bulk tag actions on multi-select.
