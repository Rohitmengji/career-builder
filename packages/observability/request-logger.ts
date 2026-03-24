/*
 * @career-builder/observability — Request Logger Middleware
 *
 * Logs every HTTP request with:
 *   - Method, route, status code
 *   - Response time (ms)
 *   - Tenant ID, user ID
 *   - Correlation / request ID
 *   - Client IP (redacted in logs)
 *
 * Also records metrics for each request.
 * Use as a wrapper in API route handlers.
 */

import { NextResponse } from "next/server";
import { getLogger, type LogContext } from "./logger";
import { metrics, METRIC } from "./metrics";
import {
  createRequestContext,
  withRequestContext,
  type RequestContext,
  REQUEST_ID_HEADER,
} from "./correlation";
import { detectBot, isIpBlocked, blockIp } from "./bot-detection";
import { anomalyDetector, ANOMALY_METRIC } from "./anomaly";

const logger = getLogger("request");

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

export interface RequestLoggerConfig {
  /** Extract tenantId from the request */
  getTenantId?: (req: Request) => string | undefined;
  /** Extract userId from the request */
  getUserId?: (req: Request) => string | undefined;
  /** Enable bot detection on this route */
  enableBotDetection?: boolean;
  /** Skip logging for these path prefixes */
  skipPaths?: string[];
}

type RouteHandler = (req: Request, ctx?: unknown) => Promise<Response>;

/* ================================================================== */
/*  Client IP extraction                                               */
/* ================================================================== */

function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

/* ================================================================== */
/*  Request counter for anomaly detection                              */
/* ================================================================== */

let requestCountThisMinute = 0;
let errorCountThisMinute = 0;
let loginFailuresThisMinute = 0;
let latenciesThisMinute: number[] = [];

// Reset counters every minute and feed into anomaly detector
const anomalyInterval = setInterval(() => {
  const total = requestCountThisMinute;
  const errors = errorCountThisMinute;
  const errorRate = total > 0 ? (errors / total) * 100 : 0;
  const sorted = [...latenciesThisMinute].sort((a, b) => a - b);
  const p95 = sorted.length > 0 ? sorted[Math.ceil(sorted.length * 0.95) - 1] : 0;

  anomalyDetector.record(ANOMALY_METRIC.REQUEST_RATE, total);
  anomalyDetector.record(ANOMALY_METRIC.ERROR_RATE, errorRate);
  anomalyDetector.record(ANOMALY_METRIC.LATENCY_P95, p95);
  anomalyDetector.record(ANOMALY_METRIC.LOGIN_FAILURES, loginFailuresThisMinute);

  requestCountThisMinute = 0;
  errorCountThisMinute = 0;
  loginFailuresThisMinute = 0;
  latenciesThisMinute = [];
}, 60_000);
if (anomalyInterval.unref) anomalyInterval.unref();

/** Call this from auth routes when a login fails. */
export function recordLoginFailure(): void {
  loginFailuresThisMinute++;
}

/* ================================================================== */
/*  withRequestLogging — wraps a route handler                         */
/* ================================================================== */

/**
 * Wrap an API route handler with observability:
 *   - Structured request/response logging
 *   - Metrics collection
 *   - Correlation ID propagation
 *   - Bot detection (optional)
 *   - IP blocklist check
 *
 * Usage:
 * ```ts
 * export const GET = withRequestLogging(async (req) => {
 *   return NextResponse.json({ ok: true });
 * });
 * ```
 */
export function withRequestLogging(
  handler: RouteHandler,
  config: RequestLoggerConfig = {},
): RouteHandler {
  return async (req: Request, routeCtx?: unknown): Promise<Response> => {
    const url = new URL(req.url);
    const path = url.pathname;

    // Skip logging for static assets, health checks, etc.
    if (config.skipPaths?.some((prefix) => path.startsWith(prefix))) {
      return handler(req, routeCtx);
    }

    const clientIp = getClientIp(req);

    // ── IP blocklist check ───────────────────────────────────
    const blockCheck = isIpBlocked(clientIp);
    if (blockCheck.blocked) {
      metrics.increment(METRIC.HTTP_REQUESTS_TOTAL, { method: req.method, path, status: "403" });
      logger.warn("blocked_ip_request", { ip: clientIp, reason: blockCheck.reason, route: path });
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 },
      );
    }

    // ── Bot detection ────────────────────────────────────────
    if (config.enableBotDetection !== false) {
      const botResult = detectBot(req, clientIp);
      if (botResult.action === "block") {
        blockIp(clientIp, `Bot score: ${botResult.score} (${botResult.signals.join(", ")})`, 3_600_000, botResult.score);
        metrics.increment(METRIC.HTTP_REQUESTS_TOTAL, { method: req.method, path, status: "403" });
        return NextResponse.json(
          { error: "Access denied" },
          { status: 403 },
        );
      }
    }

    // ── Create request context ───────────────────────────────
    const reqCtx = createRequestContext(req, {
      tenantId: config.getTenantId?.(req),
      userId: config.getUserId?.(req),
    });

    // Track active requests
    metrics.gaugeInc(METRIC.HTTP_ACTIVE_REQUESTS, { path });

    return withRequestContext(reqCtx, async () => {
      const startTime = Date.now();
      requestCountThisMinute++;

      let status = 500;
      let response: Response;

      try {
        response = await handler(req, routeCtx);
        status = response.status;
      } catch (err) {
        status = 500;
        const errorMessage = err instanceof Error ? err.message : String(err);
        logger.error("unhandled_route_error", {
          ...toLogContext(reqCtx),
          error: errorMessage,
          statusCode: 500,
        });

        response = NextResponse.json(
          { error: "Internal server error" },
          { status: 500 },
        );
      }

      const duration = Date.now() - startTime;

      // ── Record metrics ─────────────────────────────────────
      metrics.increment(METRIC.HTTP_REQUESTS_TOTAL, {
        method: req.method,
        path: normalizePath(path),
        status: String(status),
      });
      metrics.observe(METRIC.HTTP_REQUEST_DURATION_MS, duration, {
        method: req.method,
        path: normalizePath(path),
      });
      metrics.gaugeDec(METRIC.HTTP_ACTIVE_REQUESTS, { path });

      if (status >= 500) {
        metrics.increment(METRIC.HTTP_ERRORS_TOTAL, {
          method: req.method,
          path: normalizePath(path),
        });
        errorCountThisMinute++;
      }

      latenciesThisMinute.push(duration);

      // ── Structured log entry ───────────────────────────────
      const logCtx: LogContext = {
        ...toLogContext(reqCtx),
        statusCode: status,
        duration,
      };

      if (status >= 500) {
        logger.error("http_request", logCtx);
      } else if (status >= 400) {
        logger.warn("http_request", logCtx);
      } else {
        logger.info("http_request", logCtx);
      }

      // ── Propagate request ID in response ───────────────────
      const headers = new Headers(response.headers);
      headers.set(REQUEST_ID_HEADER, reqCtx.requestId);
      headers.set("X-Response-Time", `${duration}ms`);

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    });
  };
}

/* ================================================================== */
/*  Helpers                                                            */
/* ================================================================== */

function toLogContext(ctx: RequestContext): LogContext {
  return {
    requestId: ctx.requestId,
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    route: ctx.route,
    method: ctx.method,
    ip: ctx.ip,
    userAgent: ctx.userAgent?.slice(0, 200),
  };
}

/** Normalize dynamic route segments for metric labels. */
function normalizePath(path: string): string {
  // Replace UUIDs, cuid, and numeric IDs with :id
  return path
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "/:id")
    .replace(/\/c[a-z0-9]{24,}/g, "/:id")
    .replace(/\/\d+/g, "/:id");
}
