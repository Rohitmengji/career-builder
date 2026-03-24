/*
 * @career-builder/observability — Anomaly Detection
 *
 * Statistical anomaly detection for:
 *   - Traffic spikes (sudden increase in request volume)
 *   - Error rate spikes (% of 5xx responses)
 *   - Latency spikes (p95 response time)
 *   - Failed login bursts (brute force indicator)
 *   - Unusual geographic patterns
 *
 * Uses sliding window statistics + z-score for detection.
 * Feeds into the alerting system when anomalies are detected.
 */

import { getLogger } from "./logger";
import { alertManager } from "./alerts";

const logger = getLogger("anomaly");

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

export interface AnomalyConfig {
  /** Number of data points to maintain in the window */
  windowSize: number;
  /** Z-score threshold for anomaly (default: 2.5) */
  zScoreThreshold: number;
  /** Minimum data points before detection activates */
  minDataPoints: number;
  /** Cooldown between anomaly alerts (ms) */
  cooldownMs: number;
}

interface TimeSeriesWindow {
  values: number[];
  lastAnomalyAt: number;
}

/* ================================================================== */
/*  Statistical helpers                                                */
/* ================================================================== */

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const squaredDiffs = values.map((v) => Math.pow(v - avg, 2));
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / (values.length - 1));
}

function zScore(value: number, values: number[]): number {
  const avg = mean(values);
  const sd = stdDev(values);
  if (sd === 0) return 0;
  return (value - avg) / sd;
}

/* ================================================================== */
/*  Anomaly Detector                                                   */
/* ================================================================== */

const DEFAULT_CONFIG: AnomalyConfig = {
  windowSize: 60, // 60 data points (e.g. 1 per minute = 1 hour window)
  zScoreThreshold: 2.5,
  minDataPoints: 10,
  cooldownMs: 300_000, // 5 min between alerts
};

export class AnomalyDetector {
  private windows = new Map<string, TimeSeriesWindow>();
  private config: AnomalyConfig;

  constructor(config: Partial<AnomalyConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Record a data point and check for anomaly.
   * Returns true if the value is anomalous.
   */
  record(metricName: string, value: number): { isAnomaly: boolean; zScore: number } {
    let window = this.windows.get(metricName);
    if (!window) {
      window = { values: [], lastAnomalyAt: 0 };
      this.windows.set(metricName, window);
    }

    // Add value to window
    window.values.push(value);

    // Trim window
    if (window.values.length > this.config.windowSize) {
      window.values = window.values.slice(-this.config.windowSize);
    }

    // Not enough data yet
    if (window.values.length < this.config.minDataPoints) {
      return { isAnomaly: false, zScore: 0 };
    }

    // Calculate z-score using all values except the latest
    const historical = window.values.slice(0, -1);
    const z = zScore(value, historical);

    const isAnomaly = Math.abs(z) > this.config.zScoreThreshold;

    if (isAnomaly) {
      const now = Date.now();
      if (now - window.lastAnomalyAt > this.config.cooldownMs) {
        window.lastAnomalyAt = now;
        logger.warn("anomaly_detected", {
          metric: metricName,
          value,
          zScore: Math.round(z * 100) / 100,
          mean: Math.round(mean(historical) * 100) / 100,
          stdDev: Math.round(stdDev(historical) * 100) / 100,
        });
      }
    }

    return { isAnomaly, zScore: Math.round(z * 100) / 100 };
  }

  /** Get current statistics for a metric. */
  getStats(metricName: string): {
    mean: number;
    stdDev: number;
    count: number;
    latest: number;
  } | null {
    const window = this.windows.get(metricName);
    if (!window || window.values.length === 0) return null;
    return {
      mean: Math.round(mean(window.values) * 100) / 100,
      stdDev: Math.round(stdDev(window.values) * 100) / 100,
      count: window.values.length,
      latest: window.values[window.values.length - 1],
    };
  }

  /** Reset a metric's window. */
  reset(metricName: string): void {
    this.windows.delete(metricName);
  }
}

/* ================================================================== */
/*  Pre-configured detectors                                           */
/* ================================================================== */

const globalForAnomaly = globalThis as unknown as {
  __cbAnomaly?: AnomalyDetector;
};

if (!globalForAnomaly.__cbAnomaly) {
  globalForAnomaly.__cbAnomaly = new AnomalyDetector();
}

export const anomalyDetector: AnomalyDetector = globalForAnomaly.__cbAnomaly!;

/* ================================================================== */
/*  Pre-defined anomaly metric names                                   */
/* ================================================================== */

export const ANOMALY_METRIC = {
  REQUEST_RATE: "anomaly:request_rate",
  ERROR_RATE: "anomaly:error_rate",
  LATENCY_P95: "anomaly:latency_p95",
  LOGIN_FAILURES: "anomaly:login_failures",
  APPLICATION_RATE: "anomaly:application_rate",
} as const;

/* ================================================================== */
/*  Periodic anomaly aggregation                                       */
/* ================================================================== */

/**
 * Call this every N seconds from a setInterval to feed aggregated
 * metrics into the anomaly detector and trigger alerts.
 */
export function runAnomalyCheck(stats: {
  requestsPerMinute: number;
  errorRatePercent: number;
  p95LatencyMs: number;
  loginFailuresPerMinute: number;
}): void {
  const checks = [
    { metric: ANOMALY_METRIC.REQUEST_RATE, value: stats.requestsPerMinute, label: "Request rate" },
    { metric: ANOMALY_METRIC.ERROR_RATE, value: stats.errorRatePercent, label: "Error rate" },
    { metric: ANOMALY_METRIC.LATENCY_P95, value: stats.p95LatencyMs, label: "P95 latency" },
    {
      metric: ANOMALY_METRIC.LOGIN_FAILURES,
      value: stats.loginFailuresPerMinute,
      label: "Login failures",
    },
  ];

  for (const check of checks) {
    const result = anomalyDetector.record(check.metric, check.value);
    if (result.isAnomaly) {
      alertManager.fire(
        result.zScore > 4 ? "critical" : "warning",
        `Anomaly: ${check.label}`,
        `${check.label} is ${check.value} (z-score: ${result.zScore}). This is significantly outside normal range.`,
        { metric: check.metric, value: check.value, zScore: result.zScore },
        "anomaly-detector",
      );
    }
  }
}
