# ADR-0002: Salary Truth — k-anonymized market benchmarks (on-the-fly, no new table)

Status: Accepted · 2026-06-19 · Supersedes the "SalaryBenchmark table" idea in the brief's Section 2.

## Context

Honest Hiring Wave 1 #2 ("Salary Truth") gives candidates honest pay context: how a role's
posted range compares to the market, and — crucially — a market range *even when the employer
hides the salary*. The brief mandates **k-anonymity (default k=5) on any cross-tenant aggregate**.

Reconciliation against the real repo (the brief's #1 rule — repo wins where stricter/simpler):

- DB is **SQLite (dev) / Turso·libSQL (prod)**, `provider="sqlite"`. Adding a table means editing
  `schema.prisma`, regenerating `turso-schema.sql`, passing the CI **DDL-parity** gate, and the
  PR **migration-safety** gate. A precomputed `SalaryBenchmark` table would also need a refresh job.
- Salary already lives on `Job` as four columns: `salaryMin Int?`, `salaryMax Int?`,
  `salaryCurrency String`, `salaryPeriod String`. Published jobs are **public** (they render on each
  tenant's public career site), so aggregating their posted ranges is aggregating public data.
- Every other read path is strictly tenant-scoped (no Postgres RLS — see [tenant-isolation]). A
  market benchmark is the **one deliberate cross-tenant aggregate**, so it must be aggregate-only.

## Decision

1. **On-the-fly aggregation, NO new table.** Compute the benchmark at render time from existing
   published-`Job` rows. No schema change → no migration, no turso-parity burden, always fresh.
2. **The cross-tenant query is isolated and justified** in one clearly-named module
   (`packages/database/repositories/salaryBenchmarkRepo.ts`). It uses the raw `prisma` client
   *without* a tenant filter — the documented escape hatch — and returns **only aggregate stats**,
   never individual rows.
3. **k-anonymity is enforced in a pure, unit-tested module** (`packages/shared/salary-benchmark.ts`).
   The privacy controls were hardened after an adversarial review:
   - Include only published jobs with **both** `salaryMin` and `salaryMax`, matching the current
     job's **currency and period** (never mix currencies), in the same **role family**
     (`experienceLevel` + `department`, exact match for v1), **excluding the current job**.
   - Suppress (return `{ available: false }`) unless ALL hold: **≥ 5 contributing jobs**, **≥ 3
     distinct tenants**, and **no single tenant contributes > 50%** of the pool. The tenant floor
     plus the dominance cap defeat the asymmetric-contribution attack (e.g. 4 jobs from one company
     + 1 from another, where the dominant contributor could back out the rest).
   - **Round** published market percentiles (p25/p50/p75) with a **period-aware** step (yearly
     5,000 / monthly 500 / hourly 1) so no exact competitor figure is recoverable and hourly wages
     don't collapse to $0.
   - The exact sample size and exact percentile are **server-only** — never rendered (the UI shows a
     coarse qualitative band), since at the floor they enable small-sample positional inference.
4. **What candidates see:** the market median range (p25–p75) for the role family and a coarse band
   ("Above / Around / Below market") for where the posting sits — never an exact percentile, sample
   count, individual salary, or contributing tenant. Requires a **posted salary** (the web Job type
   only carries the currency inside the salary object, so a salary-less job's market currency is
   unknown; showing the market for hidden-pay jobs is deferred until currency is exposed for them).
5. **Flag-gated** `salary_benchmarks` (default **off**, dev override on). Computed in the job
   detail server component; no new public API route (nothing to abuse, no per-request AI/cost).

## Consequences

- In a single-tenant deploy (or sparse data), the benchmark **correctly stays hidden** until ≥2
  tenants and ≥5 comparable jobs exist — by design, not a bug.
- Role-family matching is exact on `experienceLevel`+`department` for v1; cross-tenant title/dept
  normalization and location bands are future improvements (more matches without losing k-anonymity).
- A per-tenant opt-out of contributing to the pool can be added later via `Tenant.settings`; v1
  relies on the fact that contributed data is already public + aggregated + k-anonymized + rounded.
