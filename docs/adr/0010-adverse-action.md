# ADR-0010: Rejection reasons / adverse-action records

Status: Accepted · 2026-06-22 · Program A (Trust & Compliance), slice A1. The on-thesis "Honest Hiring" wedge + a US-EEOC/EU-GDPR foundation.

## Context

Rejection today is just `status === "rejected"` + a freetext note — no structured reason, no audit of who/why, and nothing the candidate ever sees (the "ghosting factory" problem this product exists to fix). A structured adverse-action record also feeds the rejection-funnel analytics (B5) and EEO reporting (A5).

## Decision

- **`AdverseAction`** (one per application, `@@unique([applicationId])`): `kind` (rejection | offer_declined | offer_rescinded), `category` (a **closed vocabulary** — so it can never structurally contain another candidate's identity), `freeText` (INTERNAL rationale, never shown), `stage` (status at decision, for the funnel), `sharedWithCandidate` + `candidateMessage` (curated, candidate-safe), `decidedBy`, `decidedAt`. Tenant-scoped, cascade off Application.
- **The two-text-field split is load-bearing.** `freeText` is internal-only; `candidateMessage` is the ONLY thing a candidate can ever see, and only on explicit opt-in. The pure `packages/shared/adverse-action.ts` owns the closed vocab + `candidateProjection` (returns null unless `sharedWithCandidate`; never emits `freeText`; falls back to a safe generic label per category).
- **Double-gated disclosure.** A candidate sees a reason only when the `adverse_action_disclosure` flag is on AND the recruiter set `sharedWithCandidate` per record. The recruiter's intent is persisted as-is; display is gated by the flag at read time (toggling the flag on later surfaces already-opted-in reasons). The repo's `findCandidateVisible` filters `sharedWithCandidate=true` and selects only non-identifying columns (never `freeText`/`decidedBy`) — defense in depth.
- **Wiring.** Recorded on the applications PATCH `status==="rejected"` branch (4th write beside updateStatus + audit + event), reusing `emailService.sendStatusUpdate`'s message slot for the curated copy. The `RejectionReasonDialog` opens on a single-app reject; the reason is **optional** (reject always proceeds). Recording is best-effort (a failure never blocks the status change).
- Funnel: `adverseActionRepo.aggregateByCategory` returns **counts only** (never row-joins identity/EEO).

## Consequences

Candidates can finally learn why they weren't moved forward (when the employer opts in), and every rejection is structured + audited for analytics/compliance — without ever leaking internal notes or another candidate's information.

## Deferred

Offer decline/rescind adverse-action capture (the `kind` field is ready; the offers UI reason-capture is a follow-up). Bulk-reject reason capture (single-app only in A1). The EEO reason×demographic cross-tab lives only inside the suppressed EEO aggregator (A5).
