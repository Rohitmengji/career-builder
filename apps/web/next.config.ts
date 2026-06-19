import type { NextConfig } from "next";
import { getSecurityHeaders, toNextHeaders } from "@career-builder/security/headers";

const secHeaders = getSecurityHeaders({ isAdmin: false });
const nextSecurityHeaders = toNextHeaders(secHeaders);

const nextConfig: NextConfig = {
  reactCompiler: true,
  transpilePackages: [
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
