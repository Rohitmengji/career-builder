/*
 * @career-builder/observability — Edge Integration Helpers
 *
 * Utilities for running behind CDN / reverse proxies (Cloudflare,
 * Vercel, AWS ALB, etc.) and in edge runtimes.
 *
 * Features:
 *   - Trusted client IP extraction (respects X-Forwarded-For depth)
 *   - Edge runtime detection
 *   - Geo / country header extraction
 *   - Request metadata normalization for both Node.js and Edge runtimes
 */

import { getLogger } from "./logger";

const logger = getLogger("edge");

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

export interface EdgeRequestMeta {
  /** Resolved client IP */
  clientIp: string;
  /** Country code (from CDN header), null if unavailable */
  country: string | null;
  /** City (from CDN header), null if unavailable */
  city: string | null;
  /** Whether the request arrived via a known CDN */
  viaCdn: boolean;
  /** CDN provider name if detected */
  cdnProvider: "cloudflare" | "vercel" | "aws" | "unknown";
  /** Whether we're running in an edge runtime */
  isEdgeRuntime: boolean;
  /** Request protocol (http or https) */
  protocol: string;
}

export interface TrustedProxyConfig {
  /**
   * How many proxy hops to trust in X-Forwarded-For.
   * - 1 = trust only the last proxy (default, safest)
   * - 2 = trust the last 2 entries (e.g., CDN → load balancer)
   * - 0 = don't trust X-Forwarded-For at all
   */
  trustedHopCount: number;
  /** Trust Cloudflare's CF-Connecting-IP header */
  trustCloudflare: boolean;
  /** Trust Vercel's x-vercel-ip header (also x-real-ip) */
  trustVercel: boolean;
}

/* ================================================================== */
/*  Defaults                                                           */
/* ================================================================== */

const DEFAULT_PROXY_CONFIG: TrustedProxyConfig = {
  trustedHopCount: 1,
  trustCloudflare: true,
  trustVercel: true,
};

let proxyConfig: TrustedProxyConfig = { ...DEFAULT_PROXY_CONFIG };

/**
 * Configure trusted proxy behavior. Call once during app init.
 */
export function configureTrustedProxy(config: Partial<TrustedProxyConfig>): void {
  proxyConfig = { ...DEFAULT_PROXY_CONFIG, ...config };
  logger.info("proxy_config_updated", { config: proxyConfig });
}

/* ================================================================== */
/*  Client IP Extraction                                               */
/* ================================================================== */

/**
 * Extract the real client IP from request headers, respecting proxy trust.
 *
 * Priority:
 *   1. CF-Connecting-IP (if Cloudflare trusted)
 *   2. X-Vercel-IP / X-Real-IP (if Vercel trusted)
 *   3. X-Forwarded-For (rightmost N entries based on trustedHopCount)
 *   4. Fallback to 127.0.0.1
 */
export function extractClientIp(headers: Headers | Record<string, string | undefined>): string {
  const get = (name: string): string | undefined => {
    if (headers instanceof Headers) return headers.get(name) ?? undefined;
    return headers[name];
  };

  // Cloudflare
  if (proxyConfig.trustCloudflare) {
    const cfIp = get("cf-connecting-ip");
    if (cfIp) return cfIp.trim();
  }

  // Vercel
  if (proxyConfig.trustVercel) {
    const vercelIp = get("x-vercel-ip") || get("x-real-ip");
    if (vercelIp) return vercelIp.trim();
  }

  // X-Forwarded-For
  const xff = get("x-forwarded-for");
  if (xff && proxyConfig.trustedHopCount > 0) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    // Take the Nth from the right (hop count from the right = proxy hops we trust)
    const index = Math.max(0, parts.length - proxyConfig.trustedHopCount);
    if (parts[index]) return parts[index];
  }

  return "127.0.0.1";
}

/* ================================================================== */
/*  Edge Runtime Detection                                             */
/* ================================================================== */

/**
 * Detect if we're running in an edge runtime (Vercel Edge, Cloudflare Workers).
 */
export function isEdgeRuntime(): boolean {
  // Vercel Edge Runtime sets this
  if (typeof globalThis !== "undefined" && (globalThis as Record<string, unknown>).EdgeRuntime) {
    return true;
  }
  // Cloudflare Workers have no `process`
  if (typeof process === "undefined") {
    return true;
  }
  // Next.js Edge functions set this env
  if (process.env.NEXT_RUNTIME === "edge") {
    return true;
  }
  return false;
}

/* ================================================================== */
/*  CDN Detection                                                      */
/* ================================================================== */

function detectCdn(headers: Headers | Record<string, string | undefined>): "cloudflare" | "vercel" | "aws" | "unknown" {
  const get = (name: string): string | undefined => {
    if (headers instanceof Headers) return headers.get(name) ?? undefined;
    return headers[name];
  };

  if (get("cf-ray")) return "cloudflare";
  if (get("x-vercel-id")) return "vercel";
  if (get("x-amzn-trace-id")) return "aws";
  return "unknown";
}

/* ================================================================== */
/*  Geo Extraction                                                     */
/* ================================================================== */

function extractGeo(headers: Headers | Record<string, string | undefined>): { country: string | null; city: string | null } {
  const get = (name: string): string | undefined => {
    if (headers instanceof Headers) return headers.get(name) ?? undefined;
    return headers[name];
  };

  // Cloudflare
  const cfCountry = get("cf-ipcountry");
  const cfCity = get("cf-ipcity"); // Available with Cloudflare Workers geo

  // Vercel
  const vercelCountry = get("x-vercel-ip-country");
  const vercelCity = get("x-vercel-ip-city");

  return {
    country: cfCountry || vercelCountry || null,
    city: cfCity || vercelCity || null,
  };
}

/* ================================================================== */
/*  Full Request Metadata                                              */
/* ================================================================== */

/**
 * Extract all edge-aware metadata from request headers.
 */
export function extractEdgeMeta(headers: Headers | Record<string, string | undefined>): EdgeRequestMeta {
  const get = (name: string): string | undefined => {
    if (headers instanceof Headers) return headers.get(name) ?? undefined;
    return headers[name];
  };

  const cdn = detectCdn(headers);
  const geo = extractGeo(headers);
  const proto = get("x-forwarded-proto") || "http";

  return {
    clientIp: extractClientIp(headers),
    country: geo.country,
    city: geo.city,
    viaCdn: cdn !== "unknown",
    cdnProvider: cdn,
    isEdgeRuntime: isEdgeRuntime(),
    protocol: proto,
  };
}
