import type { NextConfig } from "next";
import { getSecurityHeaders, toNextHeaders } from "@career-builder/security/headers";

const secHeaders = getSecurityHeaders({ isAdmin: true });

// Patch CSP to allow geo-pricing API calls (client-side IP detection)
const GEO_CONNECT_SOURCES = "https://api.country.is https://ipwho.is https://ipapi.co";
if (secHeaders["Content-Security-Policy"]) {
  secHeaders["Content-Security-Policy"] = secHeaders["Content-Security-Policy"].replace(
    /connect-src ([^;]+)/,
    `connect-src $1 ${GEO_CONNECT_SOURCES}`,
  );
}

const nextSecurityHeaders = toNextHeaders(secHeaders);

// CORS origin: resolve safely across environments
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
