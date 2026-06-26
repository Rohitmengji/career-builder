# ADR-0018: Talent pool / CRM with consent-gated re-engagement

Status: Accepted · Program B (recruiter power), slice B3.

## Context

Recruiters lose touch with strong candidates who weren't right for one role but are worth keeping warm for the next. There was no way to group/track those people or reach back out — and reaching out is marketing contact, which must respect consent.

## Decision

- **`TalentPool { tenantId, name, description }`** — per-tenant named buckets (`@@unique([tenantId, name])`).
- **`TalentPoolMember { tenantId, poolId, candidateEmail, candidateName?, note? }`** — membership keyed by **lowercased candidate email** (the person, per ADR-0001 — a candidate may have many applications). `candidateName` is a denormalized display snapshot. `@@unique([poolId, candidateEmail])` makes add idempotent.
- **`talentPoolRepo`** — tenant-scoped CRUD + members. Adding is done **by application id**: the route resolves the email/name from the tenant-scoped application (`applicationRepo.findByIdScoped`) — the client never supplies the email.
- **Consent-gated re-engage** — `POST /api/admin/talent-pools/[id]/reengage` sends only to members with **marketing** consent (ADR-0011 ledger). The gate is the pure, default-deny `shared/talent-pool.partitionReengageRecipients` (no consent record ⇒ skipped); non-consented members are silently skipped and counted. Subject is one-lined (no header injection); body is HTML-escaped. Immediate send, capped at 500 recipients (durable queueing is B4).
- **Blind hiring** — the members list **redacts identity** (name → `Candidate ####`, email → null) when blind hiring is on, so a pool can't de-anonymize a hidden candidate; re-engage still works because the send happens **server-side** (the recruiter never sees recipient emails).
- **GDPR §17 erasure** — `dataRightsRepo.deleteCandidateData` now hard-deletes the candidate's pool memberships (email + name are PII), inside the erasure transaction, scoped by tenant + lowercased email.

### Retention boundary (deliberate)

A3 **retention** (ADR-0011) anonymizes old terminal *applications*; it deliberately does **not** dissolve talent-pool membership or the consent ledger. Those are separate, intentionally-created records on their own legal bases (a recruiter's CRM action; a candidate's marketing opt-in), and a candidate may still have other active applications. Only the candidate's explicit **§17 "forget me"** removes pool membership + pseudonymizes consent. Re-engagement stays safe under this boundary because it is consent-gated — an anonymized candidate who never opted in is never emailed. (Auto-purging memberships for fully-exited candidates is a possible future configurable enhancement.)

Behind the default-off `talent_pool` flag; routes 404 when off. Every route denies the `viewer` role.

## Consequences

Recruiters build a candidate CRM and re-engage past talent without spamming — outreach reaches only candidates who opted in. Membership cascades with the pool / tenant and is purged on candidate erasure.

## Deferred

Scheduled, multi-step nurture sequences + a durable send queue (B4), pool membership from sources other than an application (e.g. CSV import), and tag-based auto-pooling.
