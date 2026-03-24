/*
 * @career-builder/observability — Metrics Collection
 *
 * In-memory metrics collector that tracks:
 *   - Counters (request count, error count, etc.)
 *   - Histograms (response time distribution)
 *   - Gauges (current active connections, etc.)
 *
 * Exposes a snapshot for /api/metrics endpoint.
 * In production, push to Datadog / Prometheus / CloudWatch.
 */

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

export interface MetricLabel {
  [key: string]: string;
}

interface CounterEntry {
  value: number;
  labels: MetricLabel;
}

interface HistogramEntry {
  values: number[];
  labels: MetricLabel;
  sum: number;
  count: number;
  min: number;
  max: number;
}

interface GaugeEntry {
  value: number;
  labels: MetricLabel;
}

export interface MetricsSnapshot {
  timestamp: string;
  uptime: number;
  counters: Record<string, { value: number; labels: MetricLabel }[]>;
  histograms: Record<
    string,
    {
      count: number;
      sum: number;
      avg: number;
      min: number;
      max: number;
      p50: number;
      p95: number;
      p99: number;
      labels: MetricLabel;
    }[]
  >;
  gauges: Record<string, { value: number; labels: MetricLabel }[]>;
}

/* ================================================================== */
/*  Histogram percentile calculation                                   */
/* ================================================================== */

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

/* ================================================================== */
/*  Metrics Collector                                                  */
/* ================================================================== */

const MAX_HISTOGRAM_VALUES = 10_000; // Keep last 10K values per metric

export class MetricsCollector {
  private counters = new Map<string, CounterEntry[]>();
  private histograms = new Map<string, HistogramEntry[]>();
  private gauges = new Map<string, GaugeEntry[]>();
  private startTime = Date.now();

  /* ── Counters ─────────────────────────────────────────────────── */

  /** Increment a counter. */
  increment(name: string, labels: MetricLabel = {}, amount = 1): void {
    let entries = this.counters.get(name);
    if (!entries) {
      entries = [];
      this.counters.set(name, entries);
    }

    const labelKey = JSON.stringify(labels);
    const existing = entries.find((e) => JSON.stringify(e.labels) === labelKey);
    if (existing) {
      existing.value += amount;
    } else {
      entries.push({ value: amount, labels });
    }
  }

  /* ── Histograms (for latency, sizes, etc.) ────────────────────── */

  /** Record a value in a histogram. */
  observe(name: string, value: number, labels: MetricLabel = {}): void {
    let entries = this.histograms.get(name);
    if (!entries) {
      entries = [];
      this.histograms.set(name, entries);
    }

    const labelKey = JSON.stringify(labels);
    let existing = entries.find((e) => JSON.stringify(e.labels) === labelKey);
    if (!existing) {
      existing = { values: [], labels, sum: 0, count: 0, min: Infinity, max: -Infinity };
      entries.push(existing);
    }

    existing.values.push(value);
    existing.sum += value;
    existing.count += 1;
    existing.min = Math.min(existing.min, value);
    existing.max = Math.max(existing.max, value);

    // Cap stored values to prevent memory leaks
    if (existing.values.length > MAX_HISTOGRAM_VALUES) {
      existing.values = existing.values.slice(-MAX_HISTOGRAM_VALUES);
    }
  }

  /* ── Gauges (current values) ──────────────────────────────────── */

  /** Set a gauge value. */
  gauge(name: string, value: number, labels: MetricLabel = {}): void {
    let entries = this.gauges.get(name);
    if (!entries) {
      entries = [];
      this.gauges.set(name, entries);
    }

    const labelKey = JSON.stringify(labels);
    const existing = entries.find((e) => JSON.stringify(e.labels) === labelKey);
    if (existing) {
      existing.value = value;
    } else {
      entries.push({ value, labels });
    }
  }

  /** Increment a gauge. */
  gaugeInc(name: string, labels: MetricLabel = {}, amount = 1): void {
    let entries = this.gauges.get(name);
    if (!entries) {
      entries = [];
      this.gauges.set(name, entries);
    }
    const labelKey = JSON.stringify(labels);
    const existing = entries.find((e) => JSON.stringify(e.labels) === labelKey);
    if (existing) {
      existing.value += amount;
    } else {
      entries.push({ value: amount, labels });
    }
  }

  /** Decrement a gauge. */
  gaugeDec(name: string, labels: MetricLabel = {}, amount = 1): void {
    this.gaugeInc(name, labels, -amount);
  }

  /* ── Snapshot ─────────────────────────────────────────────────── */

  /** Get a full snapshot of all metrics. */
  snapshot(): MetricsSnapshot {
    const counters: MetricsSnapshot["counters"] = {};
    for (const [name, entries] of this.counters) {
      counters[name] = entries.map((e) => ({ value: e.value, labels: e.labels }));
    }

    const histograms: MetricsSnapshot["histograms"] = {};
    for (const [name, entries] of this.histograms) {
      histograms[name] = entries.map((e) => {
        const sorted = [...e.values].sort((a, b) => a - b);
        return {
          count: e.count,
          sum: e.sum,
          avg: e.count > 0 ? Math.round((e.sum / e.count) * 100) / 100 : 0,
          min: e.min === Infinity ? 0 : e.min,
          max: e.max === -Infinity ? 0 : e.max,
          p50: percentile(sorted, 50),
          p95: percentile(sorted, 95),
          p99: percentile(sorted, 99),
          labels: e.labels,
        };
      });
    }

    const gauges: MetricsSnapshot["gauges"] = {};
    for (const [name, entries] of this.gauges) {
      gauges[name] = entries.map((e) => ({ value: e.value, labels: e.labels }));
    }

    return {
      timestamp: new Date().toISOString(),
      uptime: Math.round((Date.now() - this.startTime) / 1000),
      counters,
      histograms,
      gauges,
    };
  }

  /** Reset all metrics. */
  reset(): void {
    this.counters.clear();
    this.histograms.clear();
    this.gauges.clear();
    this.startTime = Date.now();
  }
}

/* ================================================================== */
/*  Singleton                                                          */
/* ================================================================== */

const globalForMetrics = globalThis as unknown as {
  __cbMetrics?: MetricsCollector;
};

if (!globalForMetrics.__cbMetrics) {
  globalForMetrics.__cbMetrics = new MetricsCollector();
}

export const metrics: MetricsCollector = globalForMetrics.__cbMetrics!;

/* ================================================================== */
/*  Pre-defined metric names                                           */
/* ================================================================== */

export const METRIC = {
  // Request metrics
  HTTP_REQUESTS_TOTAL: "http_requests_total",
  HTTP_REQUEST_DURATION_MS: "http_request_duration_ms",
  HTTP_ERRORS_TOTAL: "http_errors_total",
  HTTP_ACTIVE_REQUESTS: "http_active_requests",

  // Business metrics
  JOB_SEARCHES: "job_searches_total",
  JOB_VIEWS: "job_views_total",
  APPLICATIONS_SUBMITTED: "applications_submitted_total",
  PAGE_SAVES: "page_saves_total",
  LOGINS_TOTAL: "logins_total",
  LOGIN_FAILURES: "login_failures_total",

  // Rate limiting
  RATE_LIMIT_HITS: "rate_limit_hits_total",
  BOT_DETECTIONS: "bot_detections_total",

  // Performance
  DB_QUERY_DURATION_MS: "db_query_duration_ms",
  RENDER_DURATION_MS: "render_duration_ms",
} as const;

/* ================================================================== */
/*  Metrics History (time-series snapshots)                            */
/* ================================================================== */

export interface TimestampedSnapshot {
  timestamp: string;
  epoch: number;
  counters: Record<string, number>;
  histogramAvgs: Record<string, number>;
  histogramP95s: Record<string, number>;
  gauges: Record<string, number>;
}

const MAX_HISTORY_POINTS = 1440; // 24h at 1-minute intervals

export class MetricsHistory {
  private snapshots: TimestampedSnapshot[] = [];
  private interval: ReturnType<typeof setInterval> | null = null;

  /** Start auto-capturing snapshots every `intervalMs` (default: 60s). */
  startCapture(collector: MetricsCollector, intervalMs = 60_000): void {
    if (this.interval) return;
    this.interval = setInterval(() => this.capture(collector), intervalMs);
    if (this.interval.unref) this.interval.unref();
    // Capture immediately
    this.capture(collector);
  }

  /** Take a snapshot of current metrics and store it. */
  capture(collector: MetricsCollector): void {
    const full = collector.snapshot();
    const ts: TimestampedSnapshot = {
      timestamp: full.timestamp,
      epoch: Date.now(),
      counters: {},
      histogramAvgs: {},
      histogramP95s: {},
      gauges: {},
    };

    // Flatten counters (sum all label variants per metric)
    for (const [name, entries] of Object.entries(full.counters)) {
      ts.counters[name] = entries.reduce((sum, e) => sum + e.value, 0);
    }

    // Flatten histograms
    for (const [name, entries] of Object.entries(full.histograms)) {
      if (entries.length > 0) {
        ts.histogramAvgs[name] = entries[0].avg;
        ts.histogramP95s[name] = entries[0].p95;
      }
    }

    // Flatten gauges
    for (const [name, entries] of Object.entries(full.gauges)) {
      ts.gauges[name] = entries.reduce((sum, e) => sum + e.value, 0);
    }

    this.snapshots.push(ts);

    // Trim to max
    if (this.snapshots.length > MAX_HISTORY_POINTS) {
      this.snapshots = this.snapshots.slice(-MAX_HISTORY_POINTS);
    }
  }

  /** Query history within a time range (epoch ms). */
  query(startEpoch: number, endEpoch: number): TimestampedSnapshot[] {
    return this.snapshots.filter(
      (s) => s.epoch >= startEpoch && s.epoch <= endEpoch,
    );
  }

  /** Get the last N data points. */
  recent(count = 60): TimestampedSnapshot[] {
    return this.snapshots.slice(-count);
  }

  /** Get all stored history. */
  all(): TimestampedSnapshot[] {
    return [...this.snapshots];
  }

  /** Stop capturing. */
  stopCapture(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}

/* ── History singleton ─────────────────────────────────────────── */

const globalForHistory = globalThis as unknown as {
  __cbMetricsHistory?: MetricsHistory;
};

if (!globalForHistory.__cbMetricsHistory) {
  globalForHistory.__cbMetricsHistory = new MetricsHistory();
  // Auto-start capturing every 60 seconds
  globalForHistory.__cbMetricsHistory.startCapture(metrics, 60_000);
}

export const metricsHistory: MetricsHistory = globalForHistory.__cbMetricsHistory!;
