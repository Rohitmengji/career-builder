# ADR-0027: Decision Ledger — sealed, candidate-owned decision receipt

Status: Accepted · The flagship Candidate-Trust-Layer capstone (research-selected: novelty 10/10, on-thesis 10/10). Builds on the ADR-0005 event spine, ADR-0010 adverse-action, ADR-0007/0012 scorecards.

## Context

Candidates experience hiring as a black box — across every mainstream ATS the most a candidate gets is a status label + a templated rejection email. The signals that drove the decision live in recruiter-owned, mutable, internal-only models with no candidate-visible projection and no integrity guarantee. This product already inverted that (append-only candidate-visible event spine, closed-vocab adverse-action, identity-stripped projections), so it can do what incumbents structurally cannot: show the candidate a composed, ordered, **tamper-evident** account of their decision.

## Decision

- **Pure `packages/shared/decision-ledger.ts`** — `composeLedger` builds an ordered, candidate-safe entry list in a FIXED order (screening → status sequence → curated reason); `canonicalize` is the single definition of the hashed bytes (**semantic content only, no timestamps**); `seal` = SHA-256 hex; `verify` = timing-safe compare → `verified | modified | unsealed`. `entriesFromRaw` is the **one** app-layer bridge (applies `candidateProjection`) both the writer and reader call — byte-identity by construction. Unit-tested (12).
- **What is sealed:** the status sequence + screening pass/fail + the **curated, candidate-safe reason** (closed-vocab category + curated message, only when `sharedWithCandidate` — **never** `freeText`, never identity, never another candidate). **Not sealed:** interview feedback (A4) — it's released by a deliberate *later* action, so hashing it would false-positive as "modified".
- **`decisionLedgerRepo`** (DB; no migration) — `buildInput` (candidate-visible statuses + parsed screening + raw adverse fields), `storeSeal`/`getSeal` on the **terminal event's `metadata`** (namespaced `decisionLedger`), tenant-scoped.
- **Seal at decision (every terminal path)** — admin applications `PATCH` + `bulk`, **and the offer-acceptance hire paths** (candidate self-accept `/api/offers/[id]` + admin offers accept): on a terminal transition with the flag on, after the terminal event persists + any adverse upsert, compute + store the seal. Best-effort (a failure leaves it "unsealed", never blocks the decision).
- **Stable boundary** — the seal stores `boundaryAt` (the sealed terminal event's timestamp); the reader caps the status sequence at it, so a later reopen / re-decision can never retroactively false-flag a sealed receipt as "modified".
- **Reader** `GET /api/profile/decision-ledger` — candidate **own-only** (by lowercased email + tenant, like `/profile/views`); a requested `applicationId` must be the caller's own. Re-derives + verifies live. **Disclosure gate:** verification runs over the FULL content (stable), but the curated reason is stripped from the *display* payload when `adverse_action_disclosure` is off — matching `/api/applications`, without coupling integrity to a mutable flag. Flag-gated, `no-store`.
- **UI** — `DecisionLedgerPanel` on the candidate `/applications` card (collapsible "View decision receipt"): ordered entries + a **verified / modified-after-your-decision / not-sealed** badge + a copyable receipt digest.

Flag `decision_ledger`, default-off, per-tenant opt-in.

## Integrity model (honest framing)

This is **modified-after-decision detection** (integrity), not blockchain non-repudiation — the employer controls the server. The digest is over the candidate-safe semantic content, so editing the curated reason or the status sequence after sealing surfaces a "modified" badge to the candidate.

## Consequences

Candidates get a composed, tamper-evident receipt of their decision — the strongest expression of the trust wedge, and a capability no mainstream ATS ships. Reason disclosure is governed by the recruiter's per-record `sharedWithCandidate` intent (the curated message is, by definition, what they marked shareable).

## Deferred

Sealing other terminal kinds (offer_declined/rescinded), a per-tenant "Trust & transparency" setting screen, recruiter-side byte-identical preview, and surfacing live (unsealed) feedback inside the panel.
