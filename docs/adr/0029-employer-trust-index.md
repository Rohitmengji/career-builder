# ADR-0029: Cross-Tenant Employer Trust Index (k-anonymous)

Status: Accepted · Novel network-effect feature (research workflow's #3). The **second** deliberate cross-tenant aggregate, after salary-benchmark (ADR-0002). Builds on the responsiveness score (ADR-0003).

## Context

The platform already computes each tenant's **responsiveness** ("we don't ghost" rate). On its own that's an absolute number with no reference point. Because we're multi-tenant, we can give each employer a **privacy-safe benchmark vs the market** — a number that improves as the network grows and nudges employers to compete on candidate experience. No mainstream ATS offers a cross-employer benchmark (they're structurally anti-cross-customer-data).

## Decision

- **Pure `shared/trust-index.ts`** — `benchmarkMetric(own, market[], {minTenants, higherIsBetter})`: market median/p25/p75 + the tenant's percentile (ties get half-credit; direction-aware). **k-anonymity: SUPPRESSED unless ≥ `TRUST_MIN_TENANTS` (5) distinct tenants contribute** — null everything when below. Pure + unit-tested.
- **`trustIndexRepo`** (the 2nd deliberate cross-tenant aggregate) — `getMarketResponsivenessRates` computes each *other* tenant's responsiveness from **aggregate `groupBy` counts** (never raw rows, never a tenantId), returns an **anonymized `number[]` excluding the viewer**. Mirrors salary-benchmark's header/rules; does not import `shared` (layering) — the SLA cutoff + min-settled floor are passed in so the market uses the **same definitions** as the per-tenant badge (apples-to-apples).
- **`GET /api/admin/analytics/trust-index`** — recruiter+ (viewer denied), tenant-scoped for the OWN metric, flag-gated (`employer_trust_index`), `NO_STORE`. Returns the viewer's own rate + the k-anon market percentiles + the viewer's percentile — **never another tenant's value or identity**.
- **UI** — an "Employer trust index" card on `/analytics`: your responsiveness, market median (p25/p75 + contributing-employer count), and your percentile, with an explicit "market hidden until ≥5 employers contribute" state.

Flag `employer_trust_index`, default-off.

## Privacy

The single highest-risk surface (cross-tenant, no RLS). Safeguards (hardened over **four** rounds of heavy adversarial review):
- aggregate-count computation (no rows), no identity ever crosses, viewer excluded from the market;
- **quantiles** (median/p25/p75) shown only at ≥5 tenants AND **rounded to the nearest 5** (no single rate readable off a quantile);
- the **percentile rank** — a viewer-controlled oracle — is ranked against the *coarsened* market, **banded to quartiles**, AND only published at **≥10 contributors** (at k=5 one tenant is 20% = a full band and could localize an outlier; ≥10 keeps one tenant ≤10%, below the band);
- the contributor count is returned only as a **coarse band** (never the exact number — closes the temporal-differencing channel);
- the market **"responded" definition uses the same closed status allow-list** as the badge, and the viewer's **own** rate is computed over the **same all-time window** as the market (no recent-5000 vs all-time skew) — parity enforced, not assumed.

## Consequences

Employers see how their candidate-responsiveness compares to the anonymized market — a network-effect moat (better with scale) and a fairness/trust nudge no ATS provides.

## Deferred

More benchmarked metrics (time-to-decision, feedback rate), **epoch/snapshot smoothing** of the market (further reduces cross-request differencing beyond the count-banding already shipped), daily KV caching of the market, and an opt-in public "Trust Index" badge.
