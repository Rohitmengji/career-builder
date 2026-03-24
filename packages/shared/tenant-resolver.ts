/*
 * Multi-Tenant Resolver
 *
 * Resolves the current tenant from:
 *   1. Route parameter (/:slug/...) — current method
 *   2. Subdomain (acme.hirebase.dev) — future method
 *   3. Custom domain (careers.acme.com) — future method
 *   4. Default TENANT_ID env var — fallback
 *
 * Guarantees:
 *   - No cross-tenant data leakage
 *   - Per-tenant cache keys
 *   - Consistent resolution across SSR and API routes
 */

import { prisma } from "@career-builder/database/client";

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

export interface ResolvedTenant {
  id: string;
  name: string;
  domain: string | null;
  plan: string;
  isActive: boolean;
}

export type TenantSource = "route" | "subdomain" | "domain" | "env" | "header";

export interface TenantResolution {
  tenant: ResolvedTenant | null;
  source: TenantSource;
  cacheKey: string;
}

/* ================================================================== */
/*  In-memory tenant cache (per-process, short TTL)                    */
/* ================================================================== */

const CACHE_TTL = 60_000; // 1 minute
const tenantCache = new Map<string, { tenant: ResolvedTenant; expiresAt: number }>();

function getCached(key: string): ResolvedTenant | null {
  const entry = tenantCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    tenantCache.delete(key);
    return null;
  }
  return entry.tenant;
}

function setCache(key: string, tenant: ResolvedTenant): void {
  // Evict if too many entries
  if (tenantCache.size > 200) {
    const now = Date.now();
    for (const [k, v] of tenantCache) {
      if (now > v.expiresAt) tenantCache.delete(k);
    }
  }
  tenantCache.set(key, { tenant, expiresAt: Date.now() + CACHE_TTL });
}

/* ================================================================== */
/*  Resolution functions                                               */
/* ================================================================== */

/**
 * Resolve tenant from a route slug parameter.
 * Used in /[slug]/... pages.
 */
export async function resolveFromSlug(slug: string): Promise<TenantResolution> {
  const cacheKey = `tenant:slug:${slug}`;
  const cached = getCached(cacheKey);
  if (cached) return { tenant: cached, source: "route", cacheKey };

  try {
    const row = await prisma.tenant.findFirst({
      where: {
        OR: [
          { id: slug },
          { domain: slug },
        ],
      },
      select: {
        id: true,
        name: true,
        domain: true,
        plan: true,
        isActive: true,
      },
    });

    if (row && row.isActive) {
      const tenant: ResolvedTenant = row;
      setCache(cacheKey, tenant);
      return { tenant, source: "route", cacheKey };
    }
  } catch (error) {
    console.error(`[tenant-resolver] Error resolving slug "${slug}":`, error);
  }

  return { tenant: null, source: "route", cacheKey };
}

/**
 * Resolve tenant from a subdomain.
 * e.g., acme.hirebase.dev → tenant "acme"
 *
 * (Future: enable when subdomain routing is active)
 */
export async function resolveFromSubdomain(hostname: string): Promise<TenantResolution> {
  const cacheKey = `tenant:host:${hostname}`;
  const cached = getCached(cacheKey);
  if (cached) return { tenant: cached, source: "subdomain", cacheKey };

  // Extract subdomain from hostname
  // acme.hirebase.dev → acme
  const parts = hostname.split(".");
  if (parts.length < 3) {
    // No subdomain — fall through to default
    return { tenant: null, source: "subdomain", cacheKey };
  }

  const subdomain = parts[0]!;
  // Skip www, api, admin subdomains
  if (["www", "api", "admin", "app"].includes(subdomain)) {
    return { tenant: null, source: "subdomain", cacheKey };
  }

  return resolveFromSlug(subdomain);
}

/**
 * Resolve tenant from the X-Tenant-ID header.
 * Used for API-to-API calls.
 */
export async function resolveFromHeader(tenantId: string): Promise<TenantResolution> {
  const cacheKey = `tenant:header:${tenantId}`;
  const cached = getCached(cacheKey);
  if (cached) return { tenant: cached, source: "header", cacheKey };

  return resolveFromSlug(tenantId);
}

/**
 * Resolve tenant from the TENANT_ID env var (default/fallback).
 */
export async function resolveFromEnv(): Promise<TenantResolution> {
  const tenantId = process.env.TENANT_ID || "default";
  const cacheKey = `tenant:env:${tenantId}`;
  const cached = getCached(cacheKey);
  if (cached) return { tenant: cached, source: "env", cacheKey };

  return resolveFromSlug(tenantId);
}

/**
 * Universal tenant resolver — tries all sources in priority order.
 */
export async function resolveTenant(options: {
  slug?: string;
  hostname?: string;
  tenantHeader?: string;
}): Promise<TenantResolution> {
  // 1. Explicit slug from route params
  if (options.slug) {
    const result = await resolveFromSlug(options.slug);
    if (result.tenant) return result;
  }

  // 2. Subdomain
  if (options.hostname) {
    const result = await resolveFromSubdomain(options.hostname);
    if (result.tenant) return result;
  }

  // 3. API header
  if (options.tenantHeader) {
    const result = await resolveFromHeader(options.tenantHeader);
    if (result.tenant) return result;
  }

  // 4. Env fallback
  return resolveFromEnv();
}

/**
 * Generate a per-tenant cache key for ISR / data caching.
 * Prevents cross-tenant cache pollution.
 */
export function tenantCacheKey(tenantId: string, ...segments: string[]): string {
  return `t:${tenantId}:${segments.join(":")}`;
}

/**
 * Invalidate all cached entries for a tenant.
 */
export function invalidateTenantCache(tenantId: string): void {
  for (const key of tenantCache.keys()) {
    if (key.includes(tenantId)) {
      tenantCache.delete(key);
    }
  }
}
