/*
 * @career-builder/security — Next.js Middleware Helpers
 *
 * Re-usable building blocks for apps/admin/middleware.ts and apps/web/middleware.ts.
 * Not an actual Next.js middleware itself (that must live in the app's root).
 *
 * Provides:
 *   - Security header injection
 *   - Rate-limit check helper
 *   - CSRF validation for mutations
 *   - Tenant context injection
 */

import { getSecurityHeaders, type SecurityHeaderConfig } from "./headers";
import { getRateLimiter, getClientIp, type RateLimitConfig } from "./rate-limit";
import { extractTenantId, isValidTenantId } from "./tenant";
import { timingSafeEqual } from "./crypto";

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

export interface MiddlewareConfig {
  securityHeaders?: SecurityHeaderConfig;
  rateLimitPreset?: "auth" | "api" | "public" | "upload" | "webhook";
  enableCsrf?: boolean;
  requireTenant?: boolean;
}

export interface MiddlewareResult {
  allowed: boolean;
  headers: Record<string, string>;
  status?: number;
  body?: string;
}

/* ================================================================== */
/*  Mutation methods (need CSRF check)                                 */
/* ================================================================== */

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/* ================================================================== */
/*  Combined security check                                            */
/* ================================================================== */

/**
 * Run all security checks for a request.
 * Returns headers to apply + whether the request is allowed.
 *
 * Use this in a Next.js middleware:
 * ```ts
 * import { checkRequest } from '@career-builder/security/middleware';
 *
 * export function middleware(request) {
 *   const result = checkRequest(request, { ... });
 *   if (!result.allowed) {
 *     return new NextResponse(result.body, { status: result.status, headers: result.headers });
 *   }
 *   const response = NextResponse.next();
 *   for (const [k, v] of Object.entries(result.headers)) response.headers.set(k, v);
 *   return response;
 * }
 * ```
 */
export function checkRequest(
  request: Request,
  config: MiddlewareConfig = {},
): MiddlewareResult {
  // 1. Security headers
  const secHeaders = getSecurityHeaders(config.securityHeaders || {});

  // 2. Rate limiting
  if (config.rateLimitPreset) {
    const limiter = getRateLimiter(config.rateLimitPreset);
    const clientIp = getClientIp(request) || "unknown";
    const url = new URL(request.url);
    const key = `${clientIp}:${url.pathname}`;
    const result = limiter.check(key);

    secHeaders["X-RateLimit-Remaining"] = String(result.remaining);

    if (!result.allowed) {
      return {
        allowed: false,
        headers: secHeaders,
        status: 429,
        body: JSON.stringify({
          error: "Too many requests",
          retryAfter: result.retryAfterSeconds,
        }),
      };
    }
  }

  // 3. CSRF check for mutations
  if (config.enableCsrf && MUTATION_METHODS.has(request.method)) {
    const csrfResult = validateCsrf(request);
    if (!csrfResult.valid) {
      return {
        allowed: false,
        headers: secHeaders,
        status: 403,
        body: JSON.stringify({ error: csrfResult.error }),
      };
    }
  }

  // 4. Tenant context
  if (config.requireTenant) {
    const tenantId = extractTenantId(request);
    if (!tenantId) {
      return {
        allowed: false,
        headers: secHeaders,
        status: 400,
        body: JSON.stringify({ error: "Tenant context required" }),
      };
    }
  }

  return { allowed: true, headers: secHeaders };
}

/* ================================================================== */
/*  CSRF Validation                                                    */
/* ================================================================== */

/**
 * Validate CSRF token in a request.
 * Checks both custom header (X-CSRF-Token) and Origin/Referer.
 */
export function validateCsrf(
  request: Request,
): { valid: boolean; error?: string } {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const host = request.headers.get("host");

  // Check Origin header (strongest protection)
  if (origin) {
    try {
      const originHost = new URL(origin).host;
      if (host && originHost !== host) {
        return {
          valid: false,
          error: "CSRF: Origin mismatch",
        };
      }
      return { valid: true };
    } catch {
      return { valid: false, error: "CSRF: Invalid origin" };
    }
  }

  // Fallback: check Referer
  if (referer) {
    try {
      const refererHost = new URL(referer).host;
      if (host && refererHost !== host) {
        return {
          valid: false,
          error: "CSRF: Referer mismatch",
        };
      }
      return { valid: true };
    } catch {
      return { valid: false, error: "CSRF: Invalid referer" };
    }
  }

  // No Origin or Referer — check for custom header
  const csrfToken = request.headers.get("x-csrf-token");
  if (csrfToken) {
    // If a token is present, the request came from JS (custom headers
    // can't be set by forms), which is a mild CSRF indicator.
    return { valid: true };
  }

  // No indicators at all — reject for safety on mutations
  return {
    valid: false,
    error: "CSRF: Missing Origin, Referer, or X-CSRF-Token header",
  };
}

/* ================================================================== */
/*  Cookie helpers                                                     */
/* ================================================================== */

/**
 * Generate a secure Set-Cookie string.
 * Applies best-practice security attributes.
 */
export function secureCookie(
  name: string,
  value: string,
  options: {
    maxAge?: number;
    path?: string;
    domain?: string;
    sameSite?: "Strict" | "Lax" | "None";
    httpOnly?: boolean;
    secure?: boolean;
  } = {},
): string {
  const parts = [`${name}=${encodeURIComponent(value)}`];

  parts.push(`Path=${options.path || "/"}`);

  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${options.maxAge}`);
  }

  if (options.domain) {
    parts.push(`Domain=${options.domain}`);
  }

  parts.push(`SameSite=${options.sameSite || "Lax"}`);

  // httpOnly defaults to true (prevents JS access to cookies)
  if (options.httpOnly !== false) {
    parts.push("HttpOnly");
  }

  // Secure defaults to true in production
  const isProduction = process.env.NODE_ENV === "production";
  if (options.secure !== false && (options.secure || isProduction)) {
    parts.push("Secure");
  }

  return parts.join("; ");
}
