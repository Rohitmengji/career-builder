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
import { parseHostTenant } from "./tenant-host";

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

const TENANT_SELECT = {
  id: true,
  name: true,
  domain: true,
  plan: true,
  isActive: true,
} as const;

/**
 * Resolve tenant from a route slug — matched against the tenant **id** only.
 *
 * (Previously this OR-matched id *or* domain, which let a bare slug fuzzily
 * match a domain column. Custom domains now resolve via resolveFromDomain, so
 * the slug path is unambiguous: slug === tenant id.)
 */
export async function resolveFromSlug(slug: string): Promise<TenantResolution> {
  const cacheKey = `tenant:slug:${slug}`;
  const cached = getCached(cacheKey);
  if (cached) return { tenant: cached, source: "route", cacheKey };

  try {
    const row = await prisma.tenant.findFirst({
      where: { id: slug },
      select: TENANT_SELECT,
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
 * Resolve tenant from a custom domain by EXACT host match (Tenant.domain).
 * e.g. careers.acme.com → the tenant that registered that domain.
 */
export async function resolveFromDomain(host: string): Promise<TenantResolution> {
  const normalized = host.split(":")[0]!.trim().toLowerCase();
  const cacheKey = `tenant:domain:${normalized}`;
  const cached = getCached(cacheKey);
  if (cached) return { tenant: cached, source: "domain", cacheKey };

  try {
    const row = await prisma.tenant.findFirst({
      where: { domain: normalized },
      select: TENANT_SELECT,
    });

    if (row && row.isActive) {
      const tenant: ResolvedTenant = row;
      setCache(cacheKey, tenant);
      return { tenant, source: "domain", cacheKey };
    }
  } catch (error) {
    console.error(`[tenant-resolver] Error resolving domain "${normalized}":`, error);
  }

  return { tenant: null, source: "domain", cacheKey };
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

  // Edge-safe pure parsing (shared with web middleware): handles localhost
  // dev subdomains, reserved labels (www/api/admin/app), and the platform
  // root domain. Returns null for apex/custom-domain hosts.
  const { candidate } = parseHostTenant(hostname);
  if (!candidate) {
    return { tenant: null, source: "subdomain", cacheKey };
  }

  // Delegate the DB lookup to the slug resolver, but report THIS source so
  // downstream mismatch telemetry (Phase 3) attributes resolution correctly.
  const result = await resolveFromSlug(candidate);
  return { ...result, source: "subdomain" };
}

/**
 * Resolve a tenant from a request host: custom domain (exact match) first,
 * then platform subdomain. This is the canonical host → tenant entry point for
 * the Node request layer (wired in Phase 4).
 */
export async function resolveFromHost(host: string): Promise<TenantResolution> {
  const { isCustomDomain, candidate } = parseHostTenant(host);

  // A host that isn't a platform subdomain can only be a custom domain.
  if (isCustomDomain || !candidate) {
    const byDomain = await resolveFromDomain(host);
    if (byDomain.tenant) return byDomain;
  }

  if (candidate) {
    const bySub = await resolveFromSubdomain(host);
    if (bySub.tenant) return bySub;
  }

  return { tenant: null, source: candidate ? "subdomain" : "domain", cacheKey: `tenant:host:${host}` };
}

/**
 * Resolve tenant from the X-Tenant-ID header.
 * Used for API-to-API calls.
 */
export async function resolveFromHeader(tenantId: string): Promise<TenantResolution> {
  const cacheKey = `tenant:header:${tenantId}`;
  const cached = getCached(cacheKey);
  if (cached) return { tenant: cached, source: "header", cacheKey };

  const result = await resolveFromSlug(tenantId);
  return { ...result, source: "header" };
}

/**
 * Resolve tenant from the TENANT_ID env var (default/fallback).
 */
export async function resolveFromEnv(): Promise<TenantResolution> {
  const tenantId = process.env.TENANT_ID || "default";
  const cacheKey = `tenant:env:${tenantId}`;
  const cached = getCached(cacheKey);
  if (cached) return { tenant: cached, source: "env", cacheKey };

  const result = await resolveFromSlug(tenantId);
  return { ...result, source: "env" };
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

  // 2. Host: custom domain (exact) then platform subdomain
  if (options.hostname) {
    const result = await resolveFromHost(options.hostname);
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
