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

/** Read a single cookie value from a raw Cookie header. */
function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return null;
}

/**
 * Validate CSRF on a mutating request.
 *
 * Layered defense:
 *   1. Same-origin enforcement via Origin / Referer (host must match), with a
 *      Sec-Fetch-Site fallback so requests WITHOUT an Origin header are no
 *      longer waved through (the previous gap).
 *   2. Double-submit token: the X-CSRF-Token header must equal the CSRF cookie,
 *      compared in constant time. Previously the code accepted the mere
 *      PRESENCE of the header without comparing it to anything.
 *
 * A request must satisfy a same-origin signal AND a matching token (when the
 * cookie is set). When no Origin/Referer/Sec-Fetch-Site signal exists at all,
 * the double-submit token is the sole gate.
 */
export function validateCsrf(
  request: Request,
  options: { cookieName?: string } = {},
): { valid: boolean; error?: string } {
  const cookieName = options.cookieName || "cb_csrf";
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const host = request.headers.get("host");
  const secFetchSite = request.headers.get("sec-fetch-site");

  // ── 1. Same-origin signal ────────────────────────────────────────
  let sameOriginVerified = false;
  if (origin) {
    try {
      if (host && new URL(origin).host !== host) {
        return { valid: false, error: "CSRF: Origin mismatch" };
      }
      sameOriginVerified = true;
    } catch {
      return { valid: false, error: "CSRF: Invalid origin" };
    }
  } else if (referer) {
    try {
      if (host && new URL(referer).host !== host) {
        return { valid: false, error: "CSRF: Referer mismatch" };
      }
      sameOriginVerified = true;
    } catch {
      return { valid: false, error: "CSRF: Invalid referer" };
    }
  } else if (secFetchSite) {
    // Modern browsers always send Sec-Fetch-Site. cross-site is the attack.
    if (secFetchSite === "cross-site") {
      return { valid: false, error: "CSRF: cross-site request blocked" };
    }
    sameOriginVerified = secFetchSite === "same-origin" || secFetchSite === "same-site";
  }

  // ── 2. Double-submit token (constant-time) ───────────────────────
  const headerToken = request.headers.get("x-csrf-token");
  const cookieToken = readCookie(request, cookieName);
  const tokenValid =
    !!headerToken && !!cookieToken && timingSafeEqual(headerToken, cookieToken);

  if (tokenValid) return { valid: true };

  // A verified same-origin Origin/Referer alone is acceptable (these headers
  // cannot be forged by a cross-site attacker), even without a token.
  if (sameOriginVerified && (origin || referer)) return { valid: true };

  return {
    valid: false,
    error: "CSRF: missing same-origin signal or valid double-submit token",
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
