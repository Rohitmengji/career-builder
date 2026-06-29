/*
 * @career-builder/observability/prometheus — render a MetricsSnapshot as Prometheus
 * text-exposition format (ADR-0025).
 *
 * WHAT: pure `toPrometheus(snapshot)` → the `# TYPE` + sample lines a Prometheus/
 *   OpenMetrics scraper expects, served by the token-gated /api/metrics endpoint.
 * WHY: the in-process MetricsCollector already aggregates counters/gauges/histograms;
 *   this exposes them in the one wire format every metrics backend (Prometheus, Grafana
 *   Agent, Datadog, OTel Collector) can scrape — no vendor SDK, no account.
 * HOW: counters → `counter`, gauges → `gauge`, histograms → `summary` (precomputed
 *   p50/p95/p99 quantiles + `_sum`/`_count`). Metric names and label keys are sanitized
 *   to the Prometheus charset; label values are escaped. Pure + deterministic.
 */

import type { MetricsSnapshot, MetricLabel } from "./metrics";

/** Coerce an arbitrary metric/label name to the Prometheus charset [a-zA-Z_:][a-zA-Z0-9_:]*. */
function sanitizeName(name: string): string {
  let s = name.replace(/[^a-zA-Z0-9_:]/g, "_");
  if (!/^[a-zA-Z_:]/.test(s)) s = `_${s}`;
  return s;
}

/** Escape a label value per the exposition format (backslash, quote, newline, CR). */
function escapeLabelValue(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r");
}

/** Render a label set as `{k="v",…}` (empty string when there are no labels). */
function fmtLabels(labels: MetricLabel): string {
  const keys = Object.keys(labels).filter((k) => labels[k] != null);
  if (keys.length === 0) return "";
  const inner = keys.map((k) => `${sanitizeName(k)}="${escapeLabelValue(String(labels[k]))}"`).join(",");
  return `{${inner}}`;
}

/** Format a sample value; map non-finite numbers to the exposition spellings. */
function num(n: number): string {
  if (Number.isNaN(n)) return "NaN";
  if (n === Infinity) return "+Inf";
  if (n === -Infinity) return "-Inf";
  return String(n);
}

/** Serialize a metrics snapshot to Prometheus text-exposition format. */
export function toPrometheus(snapshot: MetricsSnapshot): string {
  const lines: string[] = [];

  for (const [rawName, entries] of Object.entries(snapshot.counters)) {
    const name = sanitizeName(rawName);
    lines.push(`# TYPE ${name} counter`);
    for (const e of entries) lines.push(`${name}${fmtLabels(e.labels)} ${num(e.value)}`);
  }

  for (const [rawName, entries] of Object.entries(snapshot.gauges)) {
    const name = sanitizeName(rawName);
    lines.push(`# TYPE ${name} gauge`);
    for (const e of entries) lines.push(`${name}${fmtLabels(e.labels)} ${num(e.value)}`);
  }

  for (const [rawName, entries] of Object.entries(snapshot.histograms)) {
    const name = sanitizeName(rawName);
    lines.push(`# TYPE ${name} summary`);
    for (const e of entries) {
      lines.push(`${name}${fmtLabels({ ...e.labels, quantile: "0.5" })} ${num(e.p50)}`);
      lines.push(`${name}${fmtLabels({ ...e.labels, quantile: "0.95" })} ${num(e.p95)}`);
      lines.push(`${name}${fmtLabels({ ...e.labels, quantile: "0.99" })} ${num(e.p99)}`);
      lines.push(`${name}_sum${fmtLabels(e.labels)} ${num(e.sum)}`);
      lines.push(`${name}_count${fmtLabels(e.labels)} ${num(e.count)}`);
    }
  }

  // Process uptime as a standard gauge so the scrape always carries at least one sample.
  lines.push(`# TYPE process_uptime_seconds gauge`);
  lines.push(`process_uptime_seconds ${num(snapshot.uptime)}`);

  return `${lines.join("\n")}\n`;
}
