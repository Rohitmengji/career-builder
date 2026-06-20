# ADR-0003: Employer Responsiveness Score (Candidate Promise — slice 1)

Status: Accepted · 2026-06-20 · First slice of the "Candidate Trust Layer".

## Context

Every ATS is built for the employer; none hold the employer accountable to the
candidate. The #1 candidate complaint is being ghosted — applying into a black
hole, never hearing back. The "Candidate Trust Layer" makes the process
transparent and the employer accountable. Slice 1 ships the marketable,
first-in-market artifact: a **public Employer Responsiveness Score** badge.

Reconciliation against the real repo (build rule #1):
- `Application` has `status` (String: applied/screening/interview/offer/hired/
  rejected) + `submittedAt`. Candidate↔application is email-based (ADR-0001).
- Status changes already email the candidate (`emailService.sendStatusUpdate`),
  incl. rejection — so respectful *closure on action* already exists. The unmet
  problem is **inaction**: applications left at "applied" forever.
- Status changes are audited but **unstructured** (`entityId` null; app identified
  only by `id.slice(-6)` in a freetext string) — not reliable for accurate
  time-to-response. So v1 does NOT depend on event history.

## Decision

1. **Measure inaction from the `Application` table alone** — read-only, no
   migration, no event backfill. Pure, unit-tested engine
   (`packages/shared/responsiveness.ts`):
   - **responded** = status moved past "applied" (a human acted).
   - **ghosted** = still "applied" AND older than the SLA window (`GHOST_SLA_DAYS`
     = 14): had ample time to be actioned, wasn't.
   - **pending** = still "applied" within the window — EXCLUDED from the rate so a
     burst of fresh applications can't tank a score.
   - `responseRate = responded / (responded + ghosted)`; `ghostRate` = complement.
   - **Suppress** (no badge) below `MIN_SETTLED` = 10 settled applications, so a
     tiny/noisy/gameable sample shows nothing. Unknown statuses ignored;
     unparseable dates skipped.
2. **Tenant-scoped, not cross-tenant.** Unlike Salary Truth, this reads only the
   tenant's OWN applications — no cross-tenant aggregation, no k-anonymity needed.
3. **Public badge, opt-in.** Flag `responsiveness_badge` (default off; dev on).
   Computed in the job-detail server component (per-request memoized via React
   `cache`); no public API route. Renders nothing when suppressed. Opt-in means
   responsive employers turn it on as a recruiting advantage — a "we don't ghost"
   signal no ATS offers; the engine itself never lies.

## On counting rejections (reviewed decision)

An adversarial review raised: counting "rejected" as a response lets an employer
auto-reject everyone and show 100% — a dishonest "responsive" claim. We keep
rejections counting, but fix the *claim*, because excluding them is worse:

- A **timely rejection is closure, not ghosting** — it's exactly the candidate
  experience we want to reward. Most applicants are legitimately rejected, so
  excluding rejections would make a fast, courteous employer score *lower* than a
  ghoster. That inverts the metric's purpose.
- The real defect was an over-claim. The badge now states only **"X% of
  applicants get an answer (not ghosted)"** — never "engaged/considered". A fast
  "no" is honestly an answer.
- Detecting rubber-stamp/instant rejections needs decision-time data, which
  arrives in **slice 2** (structured status events → time-to-decision); that's
  where an "engagement"/speed dimension belongs, not v1.
- The displayed sample is the **N most recent** settled applicants (cap
  disclosed in the badge copy), avoiding an undisclosed-scope claim.

## Consequences

- Honest-by-construction: a thin or poor sample simply shows no badge.
- v1 reports response/ghost RATE only (reliable from current status). **Accurate
  time-to-first-response / time-to-decision** and the **real candidate status
  timeline** are slice 2 — they require structured status events
  (`auditRepo.logStatusChange` writing `entity`/`entityId`/from→to), which we'll
  add then so history accrues going forward.
- Later Trust-Layer slices (compliance/fairness report, proof-of-skills apply,
  portable profile) layer on the same spine and reuse shipped pieces (Blind
  Hiring, the matching engine, candidate accounts).
