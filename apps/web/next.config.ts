/*
 * Next.js config for the public career site (apps/web).
 *
 * WHAT: Build/runtime config — workspace transpilation, image optimizer policy,
 *       compression, and the response-header (security + cache) policy.
 * WHY:  This is the public, unauthenticated surface, so the defaults lean hard
 *       toward security: security headers are sourced from packages/security
 *       (single source of truth, shared with apps/admin via getSecurityHeaders),
 *       and the image optimizer is locked down so it can't be abused as an open
 *       proxy.
 * HOW:  - getSecurityHeaders({ isAdmin: false }) yields the web variant of the
 *         baseline headers; toNextHeaders() adapts them to Next's header shape.
 *       - transpilePackages: this monorepo ships internal @career-builder/*
 *         packages as TS source (not pre-built), so Next must transpile them.
 *       - headers(): order matters — broad "/(.*)" rules apply site-wide, then
 *         more specific source patterns add per-path Cache-Control. API routes
 *         get no-store, mirroring the NO_STORE invariant used on admin handlers.
 */
import type { NextConfig } from "next";
import { getSecurityHeaders, toNextHeaders } from "@career-builder/security/headers";

const secHeaders = getSecurityHeaders({ isAdmin: false });
const nextSecurityHeaders = toNextHeaders(secHeaders);

const nextConfig: NextConfig = {
  reactCompiler: true,
  transpilePackages: [
    "@career-builder/ai-client",
    "@career-builder/tenant-config",
    "@career-builder/database",
    "@career-builder/security",
    "@career-builder/observability",
    "@career-builder/shared",
    "@career-builder/ui",
  ],

  // ── Performance optimizations ───────────────────────────────────
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24, // 24 hours
    // Lock the Next image optimizer to an allowlist in production to avoid
    // acting as an open image proxy (SSRF-adjacent / bandwidth abuse). Set
    // IMAGE_REMOTE_HOSTS to a comma-separated list of allowed hostnames
    // (wildcards like `*.cloudinary.com` are supported). Falls back to the
    // permissive default only when unset, so existing tenant logos keep working
    // until the allowlist is configured.
    remotePatterns: (process.env.IMAGE_REMOTE_HOSTS || "")
      .split(",")
      .map((h) => h.trim())
      .filter(Boolean)
      .map((hostname) => ({ protocol: "https" as const, hostname }))
      .concat(
        process.env.IMAGE_REMOTE_HOSTS
          ? []
          : [{ protocol: "https" as const, hostname: "**" }],
      ),
  },

  // ── Compression ─────────────────────────────────────────────────
  compress: true,

  // ── Production source maps (for error tracking) ─────────────────
  productionBrowserSourceMaps: false,

  // ── Powered by header (remove for security) ─────────────────────
  poweredByHeader: false,

  // ── Security + cache headers ────────────────────────────────────
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          ...nextSecurityHeaders,
          // Strict Transport Security
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
      {
        // Static assets — long cache
        source: "/_next/static/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // API routes — no cache by default
        source: "/api/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
