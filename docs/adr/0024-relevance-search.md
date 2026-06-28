# ADR-0024: Relevance-ranked job search

Status: Accepted · Program C (platform), the search slice. Supersedes the originally-planned FTS5/external-index design (see Deferred).

## Context

Public job search runs through `jobRepo.search` — a tenant-scoped Prisma query that filters with `LIKE '%q%'` on title/description/tags/department and orders results by `postedAt desc`. Two real limitations:

1. **No relevance.** Results come back newest-first; a title-exact match can sit below an unrelated newer posting that merely mentions the term in its description.
2. **Whole-string matching.** The `OR` uses the *entire* query as one substring, so a multi-word query like "senior engineer remote" only matches a row that contains that exact phrase — scattered-word matches are missed.

The originally-planned fix (C4) was an SQLite/Turso **FTS5 virtual table + sync triggers**. That was rejected for now: this repo's DB-safety model regenerates `prisma/turso-schema.sql` purely from `schema.prisma` and **parity-verifies it in CI** (the guard that prevents the schema-drift outage class). FTS5 virtual tables and triggers cannot be expressed in `schema.prisma`, so they would require a **parallel, unverified raw-SQL migration channel** — exactly the drift risk the parity guard exists to prevent. A hosted index (Algolia/Meilisearch) would need an external account, like the other blocked Program-C infra (C2/C3/C5).

## Decision

Ship **relevance ranking in the app layer**, with zero schema change, zero new migration path, and the legacy search as the flag-off fallback.

- **Pure `shared/search-rank`** — `rankByRelevance(items, query, toFields, toRecency?)` + `scoreFields` + `queryTerms`. Tokenized, multi-term scoring: per term the strongest field match wins (whole-field-exact 4× > exact-word 3× > word-prefix 2× > substring 1×, scaled by a per-field weight), and the row total is scaled by **term coverage** so a row matching more of the query ranks above one matching less. Non-matches are dropped; ties break by recency then stably by input order. Deterministic, no I/O — the single source of relevance truth. Unit-tested.
- **`jobRepo.searchAllForRanking(filters, cap=1000)`** — a tenant-scoped prefilter that returns up to `cap` rows matching **any query term** (broader recall than `search`'s whole-string LIKE), with the same hard filters and tenant scope, **plus the true DB match `total`** (a `count` over the same WHERE). The pure engine then ranks + paginates in the app, but pagination `total`/`totalPages` use the true count so they stay accurate (and consistent with the flag-off path's accuracy) even if the candidate set is `cap`-truncated. The query-term cap (16) is kept in sync with `MAX_QUERY_TERMS` in the engine so the candidate set is always a superset of what the engine scores, and so a pathologically long query can't drive unbounded scoring cost.
- **`dbProvider.search` wiring** — when a query is present **and** the `search_relevance` flag is on, it runs prefilter → rank → app-paginate; otherwise the legacy `jobRepo.search` path runs **byte-identical** to before. Facets stay tenant-wide (over the full published set) in both paths, so the filter UI counts don't shift under search.

Flag `search_relevance`, default-off (dev-on).

## Consequences

Searchers get results ordered by how well they match — title-exact first, multi-word queries that previously returned nothing now rank by coverage — with no infrastructure, no external account, and no risk to the parity-verified schema model. Tenant isolation is unchanged (the prefilter is tenant-scoped exactly like `search`). Flag-off is a no-op.

## Deferred

- **True inverted-index search (FTS5 or hosted).** Worth it at large per-tenant job/candidate volumes, where the `cap`-bounded prefilter + in-app rank would start truncating or cost too much. The current cap (1000 candidates, recency-selected) means that for a single tenant with **more than 1000** query-matching published jobs, ranking covers only the most-recent 1000 (the reported `total` is still the true count); at realistic per-tenant volumes the cap never engages. FTS5 needs an accepted parallel raw-SQL migration channel (with sync triggers); a hosted index needs an external account. Either is a deliberate infra decision, tracked with C2/C3/C5.
- **Recruiter candidate search ranking.** The same engine can rank `applicationRepo.findByTenant`'s `q` results (résumé text / name), tenant-scoped and blind-hiring-aware; out of scope for this slice.
- **Query-filtered facets** (counts reflecting the active search), if product wants them.
