/*
 * Tenant store — now backed by the database via @career-builder/database.
 *
 * Provides the same API surface as the old file-based store.
 * All tenant config is stored in the Tenant table with theme/branding as JSON strings.
 */

import { tenantRepo } from "@career-builder/database";
import {
  type TenantConfig,
  DEFAULT_CONFIG,
  mergeTenantConfig,
  normalizeTheme,
  validateBranding,
} from "@career-builder/tenant-config";

/* ================================================================== */
/*  Cache layer (in-memory, 60s TTL)                                   */
/* ================================================================== */

interface CacheEntry {
  config: TenantConfig;
  timestamp: number;
}

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, CacheEntry>();
let tenantListCache: { ids: string[]; timestamp: number } | null = null;

function isFresh(entry: { timestamp: number }): boolean {
  return Date.now() - entry.timestamp < CACHE_TTL_MS;
}

function invalidateCache(tenantId: string): void {
  cache.delete(tenantId);
  tenantListCache = null;
}

function invalidateAll(): void {
  cache.clear();
  tenantListCache = null;
}

/* ================================================================== */
/*  Helpers                                                            */
/* ================================================================== */

function safeJsonParse(str: unknown, fallback: unknown): any {
  if (typeof str !== "string") return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

function dbRowToConfig(row: {
  id: string;
  name: string;
  theme: unknown;
  branding: unknown;
  createdAt: Date;
  updatedAt: Date;
}): TenantConfig {
  return mergeTenantConfig({
    id: row.id,
    name: row.name,
    theme: safeJsonParse(row.theme, {}),
    branding: safeJsonParse(row.branding, {}),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

/* ================================================================== */
/*  Public API                                                         */
/* ================================================================== */

/**
 * Save (create or update) a tenant config.
 * Normalizes theme + validates branding before persisting.
 */
export async function saveTenant(config: TenantConfig): Promise<void> {
  const full = mergeTenantConfig({ ...config, updatedAt: new Date().toISOString() });
  full.theme = normalizeTheme(full.theme);
  full.branding = validateBranding(full.branding);

  const existing = await tenantRepo.findById(config.id);

  if (existing) {
    await tenantRepo.update(config.id, {
      name: full.name || config.id,
      theme: JSON.stringify(full.theme),
      branding: JSON.stringify(full.branding),
    });
  } else {
    await tenantRepo.create({
      id: config.id,
      name: full.name || config.id,
      theme: JSON.stringify(full.theme),
      branding: JSON.stringify(full.branding),
    } as any);
  }

  invalidateCache(config.id);
}

/**
 * Load a tenant config by ID. Returns the default if not found.
 * Results are cached for performance.
 */
export async function loadTenant(tenantId: string): Promise<TenantConfig> {
  // Check cache first
  const cached = cache.get(tenantId);
  if (cached && isFresh(cached)) {
    return cached.config;
  }

  const row = await tenantRepo.findById(tenantId);
  if (!row) {
    // Fall back to default — NEVER break UI
    if (tenantId !== "default") {
      return loadTenant("default");
    }
    const fallback = mergeTenantConfig(DEFAULT_CONFIG);
    cache.set(tenantId, { config: fallback, timestamp: Date.now() });
    return fallback;
  }

  const config = dbRowToConfig(row);
  cache.set(tenantId, { config, timestamp: Date.now() });
  return config;
}

/**
 * List all tenant IDs. Cached.
 */
export async function listTenants(): Promise<string[]> {
  if (tenantListCache && isFresh(tenantListCache)) {
    return tenantListCache.ids;
  }

  const tenants = await tenantRepo.findAll();
  const ids = tenants.map((t) => t.id);

  tenantListCache = { ids, timestamp: Date.now() };
  return ids;
}

/**
 * Delete a tenant config. Cannot delete "default".
 */
export async function deleteTenant(tenantId: string): Promise<boolean> {
  if (tenantId === "default") return false;
  try {
    await tenantRepo.delete(tenantId);
    invalidateCache(tenantId);
    return true;
  } catch {
    return false;
  }
}

/**
 * Force-clear the cache. Useful after bulk operations.
 */
export function clearTenantCache(): void {
  invalidateAll();
}
