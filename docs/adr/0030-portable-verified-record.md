# ADR-0030: Portable Verified Application Record

Status: Accepted · Novel candidate-ownership feature (research workflow's #4). The 3rd deliberate cross-tenant read — but of the **candidate's own** data (by email, ADR-0001), candidate-initiated + consent-gated. Builds on the consent ledger (ADR-0011).

## Context

A candidate's hiring history is locked in each employer's silo — ATS vendors are structurally anti-portability (data lock-in is their moat). Because candidate ownership here is by email, a candidate can aggregate *their own* footprint across tenants and choose to reveal it, turning their track record into a portable asset they control.

## Decision

v1 = the safest form of the idea: **candidate-owned data, counts only, consent-gated, revocable.**

- **Pure `shared/portable-record.computeFootprint`** — reduces the candidate's own `{tenantId, status}` rows to a **counts-only** `VerifiedFootprint` (`employers`, `applications`, `reachedInterview`, `offers`, `hired`). The `tenantId` is used solely to count distinct employers and never leaves the server. Unit-tested.
- **`portableRepo.getOwnApplicationsAcrossTenants(email)`** — the 3rd deliberate cross-tenant read, but matches the candidate's **exact lowercased email** only **and excludes GDPR-anonymized rows** (`anonymizedAt: null`) so a "forgotten" candidate contributes zero counts even if a stale grant survived erasure; returns only `{tenantId, status}` for the counts engine. Server-only.
- **Consent fail-closed** — `consentRepo` now orders by `[createdAt desc, id desc]` so a same-millisecond revoke beats a grant (the "latest wins" gate can't fail open). This hardens *every* consent gate (portable share, marketing re-engage, nurture).
- **Candidate grant** `POST /api/profile/portable-share { share }` — own-session only (`getCurrentCandidate`); writes an append-only `portable_profile_share` consent row (granted true/false → fully revocable, latest wins) scoped to the candidate's **session tenant** (the employer they're sharing with). Flag-gated.
- **Recruiter redemption** `GET /api/admin/applications/[id]/portable-record` — surfaces the footprint **only** when: flag on; recruiter+ (viewer denied); the application is the recruiter's tenant (`findByIdScoped`) AND team-accessible (`canAccessJob`, ADR-0020); AND a **current** `portable_profile_share` grant exists for (this tenant, the application's candidate email) — a revocation fails closed. Returns counts only.
- **UI** — a candidate opt-in toggle on `/applications`; a recruiter "Verified record" chip on the application row (on-demand).

Flag `portable_record`, default-off.

## Privacy

The recruiter learns "this candidate has reached interviews/offers/hires across **N** employers" — **never which employers**, never per-application detail, never another candidate, never recruiter-side data. It's the candidate's own data, revealed by the candidate's own consent, to an employer they chose to apply to.

## Deferred

The **token** variant (a candidate mints a signed, time-boxed token to share *before* applying, with an employer not yet holding their data — the original research framing), per-employer share management UI, and richer verified artifacts (skills, decision-ledger digests) in the bundle.
