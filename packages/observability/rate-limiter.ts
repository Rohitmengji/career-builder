/*
 * @career-builder/observability — Route-Based Rate Limiter
 *
 * Enhanced rate limiting that works alongside the security package's
 * RateLimiter but adds:
 *   - Per-route configurations
 *   - User-based limits (in addition to IP)
 *   - Sliding window with burst detection
 *   - Integration with metrics + alerts
 *
 * Route rules:
 *   /api/auth/*     → strict  (5/min per IP)
 *   /api/apply      → strict  (3/min per IP)
 *   /api/jobs       → moderate (60/min per IP)
 *   /api/pages      → moderate (30/min per IP)
 *   /api/media      → upload  (10/5min per IP)
 *   /api/*          → default (100/min per IP)
 */

import { NextResponse } from "next/server";
import { getLogger } from "./logger";
import { metrics, METRIC } from "./metrics";
import { getRequestId } from "./correlation";

const logger = getLogger("rate-limiter");

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

export interface RouteRateLimitConfig {
  /** Max requests per window */
  maxRequests: number;
  /** Window size in ms */
  windowMs: number;
  /** Optional: per-user limit (in addition to per-IP) */
  maxRequestsPerUser?: number;
  /** Message to include in 429 response */
  message?: string;
}

interface SlidingWindowEntry {
  timestamps: number[];
  violations: number;
}

/* ================================================================== */
/*  Route rules                                                        */
/* ================================================================== */

export const ROUTE_LIMITS: Record<string, RouteRateLimitConfig> = {
  "/api/auth": {
    maxRequests: 30,
    windowMs: 60_000,
    message: "Too many auth requests. Please wait.",
  },
  "/api/jobs/apply": {
    maxRequests: 3,
    windowMs: 60_000,
    message: "Too many applications. Please slow down.",
  },
  "/api/media": {
    maxRequests: 10,
    windowMs: 300_000,
    message: "Too many uploads. Please wait.",
  },
  "/api/jobs": {
    maxRequests: 60,
    windowMs: 60_000,
  },
  "/api/pages": {
    maxRequests: 30,
    windowMs: 60_000,
  },
  "/api/admin": {
    maxRequests: 60,
    windowMs: 60_000,
  },
  // Default for any /api/* route
  "/api": {
    maxRequests: 100,
    windowMs: 60_000,
  },
};

/* ================================================================== */
/*  Sliding window store                                               */
/* ================================================================== */

const store = new Map<string, SlidingWindowEntry>();

// Periodic cleanup
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    const newest = entry.timestamps.length > 0 ? Math.max(...entry.timestamps) : 0;
    if (now - newest > 600_000) store.delete(key); // Remove entries older than 10 min
  }
}, 120_000);
if (cleanupInterval.unref) cleanupInterval.unref();

/* ================================================================== */
/*  Rate limit check                                                   */
/* ================================================================== */

function getEntry(key: string): SlidingWindowEntry {
  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [], violations: 0 };
    store.set(key, entry);
  }
  return entry;
}

function checkLimit(
  key: string,
  config: RouteRateLimitConfig,
): { allowed: boolean; remaining: number; retryAfterMs: number } {
  const now = Date.now();
  const entry = getEntry(key);
  const windowStart = now - config.windowMs;

  // Slide window
  entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

  if (entry.timestamps.length >= config.maxRequests) {
    entry.violations++;
    const oldest = entry.timestamps[0];
    const retryAfterMs = oldest + config.windowMs - now;

    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.max(0, retryAfterMs),
    };
  }

  entry.timestamps.push(now);
  return {
    allowed: true,
    remaining: config.maxRequests - entry.timestamps.length,
    retryAfterMs: 0,
  };
}

/** Find the matching route rule for a path. Longest prefix match. */
function matchRoute(path: string): RouteRateLimitConfig {
  let bestMatch = "";
  let bestConfig = ROUTE_LIMITS["/api"]!;

  for (const [prefix, config] of Object.entries(ROUTE_LIMITS)) {
    if (path.startsWith(prefix) && prefix.length > bestMatch.length) {
      bestMatch = prefix;
      bestConfig = config;
    }
  }

  return bestConfig;
}

/* ================================================================== */
/*  Public API                                                         */
/* ================================================================== */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
  /** Pre-built 429 response (if not allowed) */
  response?: Response;
}

/**
 * Check rate limit for an API request.
 *
 * Usage in a route handler:
 * ```ts
 * const limit = checkRouteRateLimit(req, clientIp, userId);
 * if (!limit.allowed) return limit.response!;
 * ```
 */
export function checkRouteRateLimit(
  request: Request,
  clientIp: string,
  userId?: string,
): RateLimitResult {
  const url = new URL(request.url);
  const path = url.pathname;
  const config = matchRoute(path);

  // IP-based limit
  const ipKey = `ip:${clientIp}:${path}`;
  const ipResult = checkLimit(ipKey, config);

  if (!ipResult.allowed) {
    metrics.increment(METRIC.RATE_LIMIT_HITS, {
      path,
      type: "ip",
    });
    logger.warn("rate_limit_exceeded", {
      ip: clientIp,
      route: path,
      type: "ip",
      requestId: getRequestId(),
    });

    const retryAfterSeconds = Math.ceil(ipResult.retryAfterMs / 1000);
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: ipResult.retryAfterMs,
      response: new Response(
        JSON.stringify({
          error: config.message || "Too many requests",
          retryAfter: retryAfterSeconds,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(retryAfterSeconds),
            "X-RateLimit-Remaining": "0",
          },
        },
      ),
    };
  }

  // User-based limit (if user is authenticated)
  if (userId && config.maxRequestsPerUser) {
    const userKey = `user:${userId}:${path}`;
    const userConfig = { ...config, maxRequests: config.maxRequestsPerUser };
    const userResult = checkLimit(userKey, userConfig);

    if (!userResult.allowed) {
      metrics.increment(METRIC.RATE_LIMIT_HITS, { path, type: "user" });
      logger.warn("rate_limit_exceeded", {
        userId,
        route: path,
        type: "user",
        requestId: getRequestId(),
      });

      const retryAfterSeconds = Math.ceil(userResult.retryAfterMs / 1000);
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: userResult.retryAfterMs,
        response: new Response(
          JSON.stringify({
            error: config.message || "Too many requests",
            retryAfter: retryAfterSeconds,
          }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": String(retryAfterSeconds),
              "X-RateLimit-Remaining": "0",
            },
          },
        ),
      };
    }
  }

  return {
    allowed: true,
    remaining: ipResult.remaining,
    retryAfterMs: 0,
  };
}

/**
 * Middleware-compatible rate limit check.
 *
 * Unlike `checkRouteRateLimit`, this does NOT construct a `Response`
 * object, so it can be called from Next.js Edge Middleware which uses
 * `NextResponse`. Returns a plain result; the caller builds its own
 * response.
 */
export function checkMiddlewareRateLimit(
  pathname: string,
  clientIp: string,
): { allowed: boolean; remaining: number; retryAfterSeconds: number; message: string } {
  const config = matchRoute(pathname);
  const ipKey = `ip:${clientIp}:${pathname}`;
  const result = checkLimit(ipKey, config);

  if (!result.allowed) {
    metrics.increment(METRIC.RATE_LIMIT_HITS, { path: pathname, type: "middleware" });
    logger.warn("middleware_rate_limit", { ip: clientIp, route: pathname });
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil(result.retryAfterMs / 1000),
      message: config.message || "Too many requests",
    };
  }

  return {
    allowed: true,
    remaining: result.remaining,
    retryAfterSeconds: 0,
    message: "",
  };
}
