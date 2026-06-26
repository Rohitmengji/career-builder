/*
 * Next.js build/runtime config for the admin app (recruiter app + GrapesJS editor).
 *
 * WHAT: Configures security headers, CORS, package transpilation, image/perf
 *       settings, and enables the React Compiler for the admin surface.
 * WHY:  The admin app is the privileged write surface, so its hardening lives
 *       here at the framework edge. Security headers (incl. CSP) are sourced
 *       from the shared @career-builder/security package so admin and web stay
 *       consistent rather than hand-rolling per-app policy.
 * HOW:  - getSecurityHeaders({ isAdmin: true }) yields the admin baseline; we
 *         then surgically widen only connect-src (third-party geo/telemetry).
 *       - Workspace packages are listed in transpilePackages because they ship
 *         as TS source (not pre-built) and Next must compile them.
 *       - headers() applies the security set globally, adds HSTS, sets CORS on
 *         /api/*, and marks immutable static assets. NOTE: Cache-Control here is
 *         for _next/static only; app/API responses set NO_STORE themselves
 *         (see auth/session helpers) — do not add caching to dynamic routes here.
 */
import type { NextConfig } from "next";
import { getSecurityHeaders, toNextHeaders } from "@career-builder/security/headers";

const secHeaders = getSecurityHeaders({ isAdmin: true });

// Patch CSP to allow geo-pricing API calls and GrapesJS telemetry.
// We append these origins to the EXISTING connect-src directive via regex
// (capturing its current value and re-emitting it) rather than redefining the
// directive, so the shared security baseline stays the source of truth and we
// only additively widen it. Guarded because the header may be absent in some envs.
const EXTRA_CONNECT_SOURCES = "https://api.country.is https://ipwho.is https://ipapi.co https://app.grapesjs.com";
if (secHeaders["Content-Security-Policy"]) {
  secHeaders["Content-Security-Policy"] = secHeaders["Content-Security-Policy"].replace(
    /connect-src ([^;]+)/,
    `connect-src $1 ${EXTRA_CONNECT_SOURCES}`,
  );
}

const nextSecurityHeaders = toNextHeaders(secHeaders);

// CORS origin: resolve safely across environments.
// Precedence is intentional: explicit config wins, then Vercel's auto-injected
// deploy URL (lacks a scheme, so prefix https://), then a localhost dev default.
// Trailing slash is stripped so it matches the Origin header format exactly.
function getCorsOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit?.trim()) return explicit.trim().replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
const CORS_ORIGIN = getCorsOrigin();

const nextConfig: NextConfig = {
  reactCompiler: true,
  transpilePackages: [
    "@career-builder/tenant-config",
    "@career-builder/database",
    "@career-builder/security",
    "@career-builder/observability",
    "@career-builder/shared",
    "@career-builder/ui",
    "@career-builder/ai-client",
  ],

  // ── Performance ─────────────────────────────────────────────────
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60, // 1 hour
  },

  compress: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,

  // ── Headers ─────────────────────────────────────────────────────
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          ...nextSecurityHeaders,
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: CORS_ORIGIN },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,PUT,PATCH,DELETE,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type,X-CSRF-Token,X-Tenant-ID" },
        ],
      },
      {
        source: "/_next/static/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
