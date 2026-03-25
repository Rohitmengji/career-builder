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

/**
 * Resolve the admin API base URL.
 * Priority: ADMIN_API_URL → NEXT_PUBLIC_APP_URL → VERCEL_URL → localhost
 */
export function getAdminApiUrl(): string {
  const serverOnly = process.env.ADMIN_API_URL;
  if (serverOnly?.trim()) return serverOnly.trim().replace(/\/$/, "");

  const publicUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_ADMIN_API_URL;
  if (publicUrl?.trim()) return publicUrl.trim().replace(/\/$/, "");

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  if (process.env.NODE_ENV === "production") {
    console.warn("[tenant] ADMIN_API_URL not set in production — using defaults");
  }

  return "http://localhost:3001";
}

function fetchWithTimeout(url: string, timeoutMs = 4000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { cache: "no-store", signal: controller.signal }).finally(
    () => clearTimeout(timer),
  );
}

/**
 * Fetch the tenant config from the admin API.
 * Tries TENANT_ID env first, falls back to "default", then returns DEFAULT_* on failure.
 * Results are cached per-request via Next.js `fetch` deduplication.
 */
export async function fetchTenantConfig(): Promise<TenantConfig> {
  const apiUrl = getAdminApiUrl();
  const tenantId = process.env.TENANT_ID || "default";

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
