/*
 * Tenant config resolution for server components.
 *
 * Used by: [slug]/page.tsx, jobs/page layout, jobs/[id]/page.tsx
 * Fetches the tenant theme + branding from the admin API (with timeout).
 * Always returns a valid config — falls back to defaults on failure.
 */

import {
  type TenantConfig,
  DEFAULT_CONFIG,
  mergeTenantConfig,
} from "@career-builder/tenant-config";
// Single source of truth for URL resolution (was duplicated in 4 places).
import { getAdminApiUrl } from "@career-builder/shared/env";
import { getWebTenantId } from "./tenant-runtime";

// Re-exported for any existing importers of this module.
export { getAdminApiUrl };

function fetchWithTimeout(url: string, timeoutMs = 4000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { cache: "no-store", signal: controller.signal }).finally(
    () => clearTimeout(timer),
  );
}

/**
 * Fetch the tenant config from the admin API.
 * Uses the per-request resolved tenant (host-based when multi_tenant_web is on,
 * else the TENANT_ID env pin), falls back to "default", then DEFAULT_* on
 * failure. Results are cached per-request via Next.js `fetch` deduplication.
 */
export async function fetchTenantConfig(): Promise<TenantConfig> {
  const apiUrl = getAdminApiUrl();
  const tenantId = await getWebTenantId();

  try {
    const res = await fetchWithTimeout(`${apiUrl}/api/tenants?id=${tenantId}`);
    if (res.ok) {
      const data = await res.json();
      if (data.tenant) return mergeTenantConfig(data.tenant);
    }
  } catch {
    // timeout or network error — fall through to default
  }

  // Last-resort fallback to "default" tenant
  if (tenantId !== "default") {
    try {
      const res = await fetchWithTimeout(`${apiUrl}/api/tenants?id=default`);
      if (res.ok) {
        const data = await res.json();
        if (data.tenant) return mergeTenantConfig(data.tenant);
      }
    } catch {
      // ignore
    }
  }

  return DEFAULT_CONFIG;
}
