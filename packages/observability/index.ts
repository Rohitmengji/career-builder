/*
 * @career-builder/observability
 *
 * Production SaaS observability, rate limiting, and bot protection.
 *
 * Modules:
 *   logger           — Structured JSON logging with PII redaction
 *   correlation       — Request ID propagation via AsyncLocalStorage
 *   metrics           — Counters, histograms, gauges (Prometheus-style)
 *   alerts            — Slack / email / console alerting with cooldowns
 *   bot-detection     — Multi-signal bot scoring + IP blocklist
 *   anomaly           — Z-score anomaly detection on traffic patterns
 *   request-logger    — Route handler wrapper (logs + metrics + bot check)
 *   performance       — Timer utilities for DB queries, renders, etc.
 *   api-protection    — Payload limits, timeout, JSON depth analysis
 *   rate-limiter      — Route-based sliding window rate limiting
 */

// ── Logger ───────────────────────────────────────────────────
export { Logger, getLogger, logger } from "./logger";
export type { LogLevel, LogContext, LogEntry, LoggerConfig } from "./logger";

// ── Correlation IDs ──────────────────────────────────────────
export {
  getRequestContext,
  getRequestId,
  generateRequestId,
  withRequestContext,
  createRequestContext,
  REQUEST_ID_HEADER,
} from "./correlation";
export type { RequestContext } from "./correlation";

// ── Metrics ──────────────────────────────────────────────────
export { MetricsCollector, metrics, METRIC, MetricsHistory, metricsHistory } from "./metrics";
export type { MetricLabel, MetricsSnapshot, TimestampedSnapshot } from "./metrics";

// ── Alerts ───────────────────────────────────────────────────
export {
  AlertManager,
  alertManager,
  ConsoleAlertChannel,
  SlackAlertChannel,
  EmailAlertChannel,
  DatabaseAlertChannel,
} from "./alerts";
export type { Alert, AlertSeverity, AlertChannel, AlertRuleConfig } from "./alerts";

// ── Bot Detection ────────────────────────────────────────────
export {
  detectBot,
  blockIp,
  unblockIp,
  isIpBlocked,
  getBlockedIps,
} from "./bot-detection";
export type { BotDetectionResult, BotDetectionConfig } from "./bot-detection";

// ── Anomaly Detection ────────────────────────────────────────
export {
  AnomalyDetector,
  anomalyDetector,
  runAnomalyCheck,
  ANOMALY_METRIC,
} from "./anomaly";

// ── Request Logging ──────────────────────────────────────────
export { withRequestLogging, recordLoginFailure } from "./request-logger";
export type { RequestLoggerConfig } from "./request-logger";

// ── Performance ──────────────────────────────────────────────
export { timer, stopwatch, timedDbQuery, timedRender, checkBudget, getBudgetViolations, resetBudgetViolations } from "./performance";
export type { PerformanceBudget } from "./performance";

// ── API Protection ───────────────────────────────────────────
export { validateRequestBody, withTimeout } from "./api-protection";
export type { ApiProtectionConfig } from "./api-protection";

// ── Rate Limiter ─────────────────────────────────────────────
export { checkRouteRateLimit, ROUTE_LIMITS } from "./rate-limiter";
export type { RouteRateLimitConfig, RateLimitResult } from "./rate-limiter";

// ── Rate Limiter (Edge-safe, for middleware) ─────────────────
export { checkMiddlewareRateLimit, extractClientIpEdge } from "./rate-limiter-edge";
export type { MiddlewareRateLimitResult } from "./rate-limiter-edge";

// ── Sentry (optional) ───────────────────────────────────────
export { captureError, captureMessage, initSentry } from "./sentry";

// ── Persistence (log sinks) ─────────────────────────────────
export {
  FileLogSink,
  ExternalLogSink,
  attachFileSink,
  attachExternalSink,
  shouldSample,
} from "./persistence";
export type { FileSinkConfig, ExternalSinkConfig, SamplingConfig } from "./persistence";

// ── Distributed Tracing ─────────────────────────────────────
export {
  startSpan,
  withSpan,
  getTrace,
  getCurrentTrace,
  SpanHandle,
} from "./tracing";
export type { Span, SpanEvent } from "./tracing";

// ── Edge Integration ────────────────────────────────────────
export {
  extractClientIp,
  extractEdgeMeta,
  isEdgeRuntime,
  configureTrustedProxy,
} from "./edge";
export type { EdgeRequestMeta, TrustedProxyConfig } from "./edge";
