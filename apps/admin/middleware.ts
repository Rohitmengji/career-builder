/*
 * Admin app — Next.js middleware
 *
 * Runs on every request at the edge. Provides:
 *   - Global rate limiting (pre-route handler)
 *   - CSRF validation for mutations
 *   - Security headers (defense-in-depth)
 *   - Request ID injection (correlation)
 *   - Response timing header
 *
 * Heavy observability (metrics, bot detection, anomaly) lives in
 * route handlers via `withRequestLogging()` because Edge middleware
 * can't use Node.js APIs like AsyncLocalStorage.
 */

import { NextResponse, type NextRequest } from "next/server";
import { checkMiddlewareRateLimit, extractClientIpEdge } from "@career-builder/observability/rate-limiter-edge";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function middleware(request: NextRequest) {
  const start = Date.now();
  const response = NextResponse.next();

  // ── Request ID (correlation) ───────────────────────────────────
  const incomingId = request.headers.get("x-request-id");
  const requestId =
    incomingId ||
    `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  response.headers.set("x-request-id", requestId);
  // Forward to route handler so it can read it
  request.headers.set("x-request-id", requestId);

  // ── Global rate limiting on API routes ─────────────────────────
  if (request.nextUrl.pathname.startsWith("/api/")) {
    const clientIp = extractClientIpEdge(request.headers);

    const limit = checkMiddlewareRateLimit(request.nextUrl.pathname, clientIp);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: limit.message, retryAfter: limit.retryAfterSeconds },
        {
          status: 429,
          headers: {
            "Retry-After": String(limit.retryAfterSeconds),
            "X-RateLimit-Remaining": "0",
            "x-request-id": requestId,
          },
        },
      );
    }

    // Pass rate-limit headers through to the response
    response.headers.set("X-RateLimit-Remaining", String(limit.remaining));
  }

  // ── CSRF check on mutations to /api/* ──────────────────────────
  if (
    request.nextUrl.pathname.startsWith("/api/") &&
    MUTATION_METHODS.has(request.method)
  ) {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    const referer = request.headers.get("referer");
    const secFetchSite = request.headers.get("sec-fetch-site");
    const isDev = process.env.NODE_ENV !== "production";

    let rejected: string | null = null;

    if (origin) {
      try {
        const originHost = new URL(origin).host;
        if (host && originHost !== host) {
          const originHostname = new URL(origin).hostname;
          const hostHostname = host.split(":")[0];
          if (!(isDev && originHostname === "localhost" && hostHostname === "localhost")) {
            rejected = "CSRF: Origin mismatch";
          }
        }
      } catch {
        rejected = "CSRF: Invalid origin";
      }
    } else if (secFetchSite) {
      // No Origin header — fall back to the Fetch Metadata signal that modern
      // browsers always send. cross-site is the CSRF attack vector.
      if (secFetchSite === "cross-site") rejected = "CSRF: cross-site request blocked";
    } else if (referer) {
      try {
        if (host && new URL(referer).host !== host) rejected = "CSRF: Referer mismatch";
      } catch {
        rejected = "CSRF: Invalid referer";
      }
    } else if (!isDev) {
      // No Origin, Sec-Fetch-Site, or Referer on a state-changing request in
      // production is suspicious. The route-level double-submit token is the
      // backstop, but reject here too. (Allowed in dev for curl/tests.)
      rejected = "CSRF: missing Origin/Sec-Fetch-Site/Referer";
    }

    if (rejected) {
      return NextResponse.json({ error: rejected }, { status: 403 });
    }
  }

  // ── Security headers (defense-in-depth alongside next.config) ──
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // ── Timing header ──────────────────────────────────────────────
  response.headers.set("X-Response-Time", `${Date.now() - start}ms`);

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
