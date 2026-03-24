/*
 * @career-builder/security — Advanced Rate Limiter
 *
 * Sliding window rate limiter with multiple tiers:
 *   - Per-IP rate limiting for all endpoints
 *   - Stricter limits for auth endpoints (brute-force prevention)
 *   - Per-tenant rate limiting (abuse prevention)
 *   - Exponential backoff for repeated violations
 *
 * In-memory implementation. For production at scale,
 * swap to Redis with the same interface.
 */

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

export interface RateLimitConfig {
  /** Max requests in the window */
  maxRequests: number;
  /** Window size in milliseconds */
  windowMs: number;
  /** Lockout time after exceeding limit (ms) */
  lockoutMs?: number;
  /** Enable exponential backoff on repeated violations */
  exponentialBackoff?: boolean;
}

interface RateLimitEntry {
  /** Timestamps of requests within the window */
  requests: number[];
  /** Number of times the limit has been exceeded */
  violations: number;
  /** Locked out until this timestamp */
  lockedUntil: number;
}

/* ================================================================== */
/*  Preset configurations                                              */
/* ================================================================== */

export const RATE_LIMITS = {
  /** Auth endpoints: 5 attempts per 60 seconds, 5-minute lockout */
  auth: {
    maxRequests: 5,
    windowMs: 60_000,
    lockoutMs: 300_000,
    exponentialBackoff: true,
  } satisfies RateLimitConfig,

  /** General API: 100 requests per 60 seconds */
  api: {
    maxRequests: 100,
    windowMs: 60_000,
    lockoutMs: 60_000,
  } satisfies RateLimitConfig,

  /** Public endpoints: 200 requests per 60 seconds */
  public: {
    maxRequests: 200,
    windowMs: 60_000,
  } satisfies RateLimitConfig,

  /** File upload: 10 per 5 minutes */
  upload: {
    maxRequests: 10,
    windowMs: 300_000,
    lockoutMs: 600_000,
  } satisfies RateLimitConfig,

  /** Webhook: 50 per minute */
  webhook: {
    maxRequests: 50,
    windowMs: 60_000,
  } satisfies RateLimitConfig,
} as const;

/* ================================================================== */
/*  Rate limiter class                                                 */
/* ================================================================== */

export class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private config: Required<RateLimitConfig>;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config: RateLimitConfig) {
    this.config = {
      maxRequests: config.maxRequests,
      windowMs: config.windowMs,
      lockoutMs: config.lockoutMs ?? config.windowMs,
      exponentialBackoff: config.exponentialBackoff ?? false,
    };

    // Periodic cleanup of stale entries (every 5 minutes)
    this.cleanupInterval = setInterval(() => this.cleanup(), 300_000);
    // Don't block Node.js exit
    if (this.cleanupInterval.unref) this.cleanupInterval.unref();
  }

  /**
   * Check if a request is allowed.
   * Returns { allowed, remaining, retryAfterMs, retryAfterSeconds }.
   */
  check(key: string): {
    allowed: boolean;
    remaining: number;
    retryAfterMs: number;
    retryAfterSeconds: number;
  } {
    const now = Date.now();
    let entry = this.store.get(key);

    if (!entry) {
      entry = { requests: [], violations: 0, lockedUntil: 0 };
      this.store.set(key, entry);
    }

    // Check lockout
    if (entry.lockedUntil > now) {
      const retryAfterMs = entry.lockedUntil - now;
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs,
        retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
      };
    }

    // Slide the window — remove expired timestamps
    const windowStart = now - this.config.windowMs;
    entry.requests = entry.requests.filter((ts) => ts > windowStart);

    // Check if under limit
    if (entry.requests.length >= this.config.maxRequests) {
      entry.violations += 1;

      // Calculate lockout duration
      let lockoutMs = this.config.lockoutMs;
      if (this.config.exponentialBackoff) {
        // Double lockout for each subsequent violation, cap at 1 hour
        lockoutMs = Math.min(lockoutMs * Math.pow(2, entry.violations - 1), 3_600_000);
      }
      entry.lockedUntil = now + lockoutMs;

      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: lockoutMs,
        retryAfterSeconds: Math.ceil(lockoutMs / 1000),
      };
    }

    // Record this request
    entry.requests.push(now);

    return {
      allowed: true,
      remaining: this.config.maxRequests - entry.requests.length,
      retryAfterMs: 0,
      retryAfterSeconds: 0,
    };
  }

  /** Record a failed attempt (e.g. bad password) without counting as a normal request. */
  recordFailure(key: string): void {
    const entry = this.store.get(key);
    if (entry) {
      entry.requests.push(Date.now());
    } else {
      this.store.set(key, { requests: [Date.now()], violations: 0, lockedUntil: 0 });
    }
  }

  /** Clear all rate limit data for a key (e.g. after successful login). */
  reset(key: string): void {
    this.store.delete(key);
  }

  /** Remove stale entries to prevent memory leaks. */
  private cleanup(): void {
    const now = Date.now();
    const maxAge = this.config.windowMs * 2;

    for (const [key, entry] of this.store) {
      const newest = entry.requests.length > 0 ? Math.max(...entry.requests) : 0;
      if (now - newest > maxAge && entry.lockedUntil < now) {
        this.store.delete(key);
      }
    }
  }

  /** Destroy the cleanup interval. */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

/* ================================================================== */
/*  Singleton instances (shared across route handlers)                 */
/* ================================================================== */

const globalForRateLimiter = globalThis as unknown as {
  __rateLimiters?: Map<string, RateLimiter>;
};

if (!globalForRateLimiter.__rateLimiters) {
  globalForRateLimiter.__rateLimiters = new Map();
}

/** Get or create a rate limiter for a named tier. */
export function getRateLimiter(name: keyof typeof RATE_LIMITS): RateLimiter {
  let limiter = globalForRateLimiter.__rateLimiters!.get(name);
  if (!limiter) {
    limiter = new RateLimiter(RATE_LIMITS[name]);
    globalForRateLimiter.__rateLimiters!.set(name, limiter);
  }
  return limiter;
}

/** Get client IP from request headers. */
export function getClientIp(request: Request): string {
  const headers = request.headers;
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "unknown"
  );
}
