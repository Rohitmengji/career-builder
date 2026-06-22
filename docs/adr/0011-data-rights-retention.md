# ADR-0011: Candidate data rights (export / erasure / consent) + retention

Status: Accepted · 2026-06-22 · Program A (Trust & Compliance), slices A2 (this) + A3 (retention). GDPR §15/§17 + consent.

## Context

A hiring product processes sensitive personal data, so candidates need real data-subject rights: a copy of their data (§15), erasure (§17), and a consent record. The hard part is reconciling "right to be forgotten" with the obligation to **retain** adverse-action + audit records (EEOC; defending a discrimination claim needs *why* a decision was made, just not *who*).

## Decision

- **Export (§15)** — `GET /api/profile/export` (own email+tenant, flag `data_export`). A pure **whitelisting** assembler `packages/shared/data-export.ts` `buildCandidateExport` constructs the payload by explicitly *picking* allowed fields, so internal recruiter data (notes, ratings, scorecards, adverse-action `freeText`), other people's data, and EEO can never ship — even if a caller passes a raw row containing them (unit-tested with `.not.toContain`).
- **Erasure (§17) = anonymize-in-place** — `dataRightsRepo.deleteCandidateData(tenantId, email, now)`. The reconciliation: destroy the person↔PII link, keep the non-identifying records. In one `$transaction`: anonymize the candidate's applications (null name/phone/résumé/cover/linkedin + `email → irreversible sha256 pseudonym` + `anonymizedAt`); null `AdverseAction.candidateMessage` but **KEEP** the record (retention); hard-delete `Notification` by `(recipientType=candidate, recipientId=email)` (no FK — the email IS the key); pseudonymize `Consent.subjectEmail` (keep the evidence trail, de-identified); hard-delete the `Candidate`; write a **PII-free** `candidate_data_erased` AuditLog. `ApplicationEvent` (PII-free by ADR-0005) and `AuditLog` are kept.
- **Legal hold precedence** — `Application.legalHold` (+`legalHoldReason`). If ANY of the candidate's applications is on hold, the whole erasure is **deferred** (no partial erasure), per GDPR §17(3)(e). Precedence: `legalHold > adverse-action retention > erasure/purge`.
- **Consent** — append-only `Consent` ledger (versioned; withdrawal is a new `granted=false` row). Captured at apply (`privacy_policy` + `data_processing`, best-effort, flag `consent_capture`), with `policyVersion` + IP.
- **UI** — a "Privacy & your data" section on the candidate profile (download JSON + delete account with confirm).

## A3 — Data retention (next slice)

Per-tenant `Tenant.settings.retention` policy; a `retention-sweep` cron task (on the C1 foundation) finds terminal applications past their window with `anonymizedAt IS NULL` and `legalHold=false` and runs the **same anonymizer** (`anonymizedApplicationData`) — one "forget" code path.

## Consequences

Candidates can export + erase their data; erasure is legally sound (keeps adverse-action/audit, defers under hold). The shared anonymizer is reused by retention (A3).

## Deferred

Physical résumé-blob deletion during erasure (the DB references + extracted text are nulled now; the orphaned blob is cleaned by C3 object-storage, which owns the storage key/driver). Explicit per-field consent checkboxes on the apply form (A2 records consent at apply with the current policy version). EEO self-ID erasure is handled in A5's orchestrator hook.
