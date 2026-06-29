/*
 * Tests for observability/prometheus — Prometheus text-exposition serializer.
 * Pinned: counter/gauge/summary TYPE lines + samples; label formatting + escaping;
 * metric/label name sanitization; histogram → summary (quantiles + _sum/_count);
 * non-finite value spellings; always emits process_uptime_seconds.
 */
import { describe, it, expect } from "vitest";
import { toPrometheus } from "./prometheus";
import type { MetricsSnapshot } from "./metrics";

function snap(partial: Partial<MetricsSnapshot>): MetricsSnapshot {
  return {
    timestamp: "2026-01-01T00:00:00.000Z",
    uptime: 42,
    counters: {},
    histograms: {},
    gauges: {},
    ...partial,
  };
}

describe("toPrometheus", () => {
  it("renders counters with TYPE and labelled samples", () => {
    const out = toPrometheus(snap({ counters: { http_requests: [{ value: 7, labels: { route: "/jobs", method: "GET" } }] } }));
    expect(out).toContain("# TYPE http_requests counter");
    expect(out).toContain('http_requests{route="/jobs",method="GET"} 7');
  });

  it("renders gauges and a label-less sample has no braces", () => {
    const out = toPrometheus(snap({ gauges: { active_conns: [{ value: 3, labels: {} }] } }));
    expect(out).toContain("# TYPE active_conns gauge");
    expect(out).toContain("active_conns 3");
    expect(out).not.toContain("active_conns{}");
  });

  it("renders histograms as a summary (quantiles + _sum/_count)", () => {
    const out = toPrometheus(snap({
      histograms: {
        latency_ms: [{ count: 10, sum: 100, avg: 10, min: 1, max: 50, p50: 8, p95: 40, p99: 49, labels: { route: "/x" } }],
      },
    }));
    expect(out).toContain("# TYPE latency_ms summary");
    expect(out).toContain('latency_ms{route="/x",quantile="0.5"} 8');
    expect(out).toContain('latency_ms{route="/x",quantile="0.95"} 40');
    expect(out).toContain('latency_ms{route="/x",quantile="0.99"} 49');
    expect(out).toContain('latency_ms_sum{route="/x"} 100');
    expect(out).toContain('latency_ms_count{route="/x"} 10');
  });

  it("sanitizes metric + label names to the Prometheus charset", () => {
    const out = toPrometheus(snap({ counters: { "api.calls-total": [{ value: 1, labels: { "x-tenant": "a" } }] } }));
    expect(out).toContain("# TYPE api_calls_total counter");
    expect(out).toContain('api_calls_total{x_tenant="a"} 1');
  });

  it("escapes quotes, backslashes, newlines and carriage returns in label values", () => {
    const out = toPrometheus(snap({ counters: { c: [{ value: 1, labels: { path: 'a"b\\c\nd\re' } }] } }));
    expect(out).toContain('path="a\\"b\\\\c\\nd\\re"');
    expect(out).not.toMatch(/\r/); // no raw CR byte survives in the output
  });

  it("maps non-finite values to exposition spellings", () => {
    const out = toPrometheus(snap({ gauges: { g: [{ value: Infinity, labels: {} }, { value: NaN, labels: {} }] } }));
    expect(out).toContain("g +Inf");
    expect(out).toContain("g NaN");
  });

  it("always emits process_uptime_seconds", () => {
    expect(toPrometheus(snap({}))).toContain("process_uptime_seconds 42");
  });
});
