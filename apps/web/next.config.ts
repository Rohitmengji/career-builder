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
  ],

  // ── Performance optimizations ───────────────────────────────────
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24, // 24 hours
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
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
