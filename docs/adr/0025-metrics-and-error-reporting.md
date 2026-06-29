# ADR-0025: Persisted metrics & error reporting (observability egress)

Status: Accepted (partial — the no-account pieces). Program C, the observability slice.

## Context

`packages/observability` already collects rich telemetry in-process: a `MetricsCollector` (counters / gauges / histograms with p50/p95/p99), structured `logger`, request logging, anomaly/alerts, and a `sentry` shim. But nothing was **exposed** for an external system to consume — metrics had no scrape endpoint, and Sentry was a shim awaiting a DSN. C5's goal is to get that telemetry *out* to durable backends.

Two parts of C5 need no external account and are shipped here; the account-gated parts are env-wired and inert until configured.

## Decision

- **Prometheus scrape endpoint.** A pure `observability/prometheus.toPrometheus(snapshot)` renders the collector snapshot in text-exposition format — counters → `counter`, gauges → `gauge`, histograms → `summary` (precomputed quantiles + `_sum`/`_count`) — with metric/label-name sanitization and label-value escaping. `GET /api/metrics` (admin app) serves it, **token-gated** by `Authorization: Bearer $METRICS_TOKEN` (constant-time compare; **off → 404** when the token is unset, **wrong → 401**), never cached. Any Prometheus/Grafana/Datadog/OTel scraper can pull it; no vendor SDK. Unit-tested serializer.
- **Error reporting** stays the existing `observability/sentry` shim: when `SENTRY_DSN` is set it lazy-imports `@sentry/nextjs` and reports with tenant/route context; otherwise it degrades to structured logging. No code change needed — only the DSN + `npm i @sentry/nextjs` at deploy.

## Consequences

Operational telemetry is now externally consumable with zero new infrastructure: a scraper can be pointed at `/api/metrics` immediately, and error reporting activates the moment a DSN is configured. Metrics carry operational counts only (no candidate PII); the token keeps internal traffic shape private.

## Limitations / Deferred

- **Per-instance metrics.** The collector is in-process, so on a multi-instance/serverless deploy each instance exposes its own counts — point the scraper at each instance or front it with a push-gateway/aggregator. A durable cross-instance metrics store (or pushing to a hosted backend) is the account-gated remainder.
- **Log shipping** (Logpush/Loki) and the Sentry account/DSN are deployment configuration, tracked with the other external-infra items (C2/C3).
