/*
 * @career-builder/observability — Edge-Safe Rate Limiter
 *
 * A lightweight rate limiter that works in Next.js Edge Middleware.
 * NO Node.js built-in imports (no node:crypto, no node:async_hooks).
 *
 * For the full-featured rate limiter (with metrics, logging, user-based
 * limits), use `rate-limiter.ts` from route handlers instead.
 */

/* ================================================================== */
/*  Route rules (duplicated from rate-limiter.ts to avoid Node imports) */
/* ================================================================== */

interface RouteRateLimitConfig {
  maxRequests: number;
  windowMs: number;
  message?: string;
}

const ROUTE_LIMITS: Record<string, RouteRateLimitConfig> = {
  "/api/auth": { maxRequests: 30, windowMs: 60_000, message: "Too many auth requests. Please wait." },
  "/api/jobs/apply": { maxRequests: 3, windowMs: 60_000, message: "Too many applications. Please slow down." },
  "/api/media": { maxRequests: 10, windowMs: 300_000, message: "Too many uploads. Please wait." },
  "/api/jobs": { maxRequests: 60, windowMs: 60_000 },
  "/api/pages": { maxRequests: 30, windowMs: 60_000 },
  "/api/admin": { maxRequests: 60, windowMs: 60_000 },
  "/api/subscription": { maxRequests: 30, windowMs: 60_000 },
  "/api/stripe/webhook": { maxRequests: 100, windowMs: 60_000 },  // Stripe sends bursts; verified by signature, not IP
  "/api/stripe": { maxRequests: 10, windowMs: 60_000 },
  "/api/ready": { maxRequests: 60, windowMs: 60_000 },  // Health probes
  "/api/health": { maxRequests: 30, windowMs: 60_000 }, // Monitoring
  "/api": { maxRequests: 100, windowMs: 60_000 },
};

/* ================================================================== */
/*  Sliding window store                                               */
/* ================================================================== */

interface SlidingWindowEntry {
  timestamps: number[];
}

const store = new Map<string, SlidingWindowEntry>();

// Periodic cleanup (safe for edge — setTimeout is available)
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    const newest = entry.timestamps.length > 0 ? Math.max(...entry.timestamps) : 0;
    if (now - newest > 600_000) store.delete(key);
  }
}, 120_000);
if (typeof cleanupInterval === "object" && cleanupInterval && "unref" in cleanupInterval) {
  (cleanupInterval as NodeJS.Timeout).unref();
}

/* ================================================================== */
/*  Core logic                                                         */
/* ================================================================== */

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

function checkLimit(
  key: string,
  config: RouteRateLimitConfig,
): { allowed: boolean; remaining: number; retryAfterMs: number } {
  const now = Date.now();
  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  const windowStart = now - config.windowMs;
  entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

  if (entry.timestamps.length >= config.maxRequests) {
    const oldest = entry.timestamps[0];
    const retryAfterMs = oldest + config.windowMs - now;
    return { allowed: false, remaining: 0, retryAfterMs: Math.max(0, retryAfterMs) };
  }

  entry.timestamps.push(now);
  return { allowed: true, remaining: config.maxRequests - entry.timestamps.length, retryAfterMs: 0 };
}

/* ================================================================== */
/*  Public API                                                         */
/* ================================================================== */

export interface MiddlewareRateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  message: string;
}

/**
 * Edge-safe rate limit check for Next.js middleware.
 *
 * Does NOT import any Node.js modules.
 */
export function checkMiddlewareRateLimit(
  pathname: string,
  clientIp: string,
): MiddlewareRateLimitResult {
  const config = matchRoute(pathname);
  const ipKey = `ip:${clientIp}:${pathname}`;
  const result = checkLimit(ipKey, config);

  if (!result.allowed) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil(result.retryAfterMs / 1000),
      message: config.message || "Too many requests",
    };
  }

  return { allowed: true, remaining: result.remaining, retryAfterSeconds: 0, message: "" };
}

/**
 * Edge-safe client IP extraction.
 *
 * Supports Cloudflare, Vercel, and X-Forwarded-For headers.
 * Does NOT import any Node.js modules.
 */
export function extractClientIpEdge(headers: Headers): string {
  // Cloudflare
  const cfIp = headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  // Vercel
  const vercelIp = headers.get("x-vercel-ip") || headers.get("x-real-ip");
  if (vercelIp) return vercelIp.trim();

  // X-Forwarded-For (trust rightmost = 1 hop)
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length > 0) return parts[Math.max(0, parts.length - 1)];
  }

  return "127.0.0.1";
}
