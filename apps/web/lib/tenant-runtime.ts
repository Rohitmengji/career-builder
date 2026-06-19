/*
 * Web tenant runtime (SERVER-ONLY) — the single source of "which tenant is
 * this request for?" in the public site.
 *
 * Behind the `multi_tenant_web` flag:
 *   - OFF (default): returns the TENANT_ID env pin — identical to today's
 *     single-tenant behavior. The whole cutover is inert until the flag is on.
 *   - ON: resolves the tenant from the request host (the x-tenant-host header
 *     set by middleware, falling back to the Host header), via the cached
 *     resolver, and falls back to the env pin if the host doesn't map to an
 *     active tenant (keeps the site serving rather than 404-ing).
 *
 * Per-request memoized with React cache() so repeated calls in one render /
 * request hit the DB at most once.
 */

import { cache } from "react";
import { headers } from "next/headers";
import { isEnabled } from "@career-builder/shared/feature-flags";
import { resolveFromHost, type ResolvedTenant } from "@career-builder/shared/tenant-resolver";
import { tenantRepo } from "@career-builder/database";
import type { TenantEmailSettings } from "@career-builder/email";

/** The env pin — fallback and the entire behavior when the flag is off. */
export const ENV_TENANT_ID = process.env.TENANT_ID || "default";

/** True when per-request host-based tenant resolution is active. */
export function isMultiTenantWeb(): boolean {
  return isEnabled("multi_tenant_web");
}

/**
 * Resolve the full tenant for the current request (or null when running on the
 * env pin / unresolved). Memoized per request.
 */
export const getWebTenant = cache(async (): Promise<ResolvedTenant | null> => {
  if (!isMultiTenantWeb()) return null;
  try {
    const h = await headers();
    const host = h.get("x-tenant-host") || h.get("host") || "";
    if (host) {
      const res = await resolveFromHost(host);
      if (res.tenant) return res.tenant;
    }
  } catch {
    // headers() unavailable outside a request scope — fall back to env.
  }
  return null;
});

/**
 * The resolved tenant id for the current request. Falls back to the env pin
 * when the flag is off or the host doesn't resolve.
 */
export const getWebTenantId = cache(async (): Promise<string> => {
  const tenant = await getWebTenant();
  return tenant?.id ?? ENV_TENANT_ID;
});

/**
 * Assert that a session's tenant matches the tenant resolved for this request's
 * host. Prevents a session cookie minted on tenant A's host from being replayed
 * on tenant B's host. No-op when the flag is off (single-tenant).
 *
 * @returns true if the session may be trusted for this request.
 */
export async function sessionTenantMatchesHost(sessionTenantId: string): Promise<boolean> {
  if (!isMultiTenantWeb()) return true;
  const current = await getWebTenantId();
  return sessionTenantId === current;
}

/**
 * Per-tenant email sender settings (Tenant.settings.email) for the current
 * request, or undefined when single-tenant / unset / malformed. The email
 * service falls back to the platform default sender when this is undefined or
 * the tenant address isn't verified (R8). Memoized per request.
 */
export const getWebTenantEmailSettings = cache(
  async (): Promise<TenantEmailSettings | undefined> => {
    if (!isMultiTenantWeb()) return undefined;
    const tenant = await getWebTenant();
    if (!tenant) return undefined;
    try {
      const row = await tenantRepo.findById(tenant.id);
      const raw = (row as { settings?: unknown } | null)?.settings;
      const settings = typeof raw === "string" ? JSON.parse(raw) : raw;
      const email = (settings as { email?: Record<string, unknown> } | null)?.email;
      if (email && typeof email === "object") {
        return {
          fromEmail: typeof email.fromEmail === "string" ? email.fromEmail : undefined,
          fromName: typeof email.fromName === "string" ? email.fromName : undefined,
          adminEmail: typeof email.adminEmail === "string" ? email.adminEmail : undefined,
          senderVerified: email.senderVerified === true,
        };
      }
    } catch {
      // malformed settings JSON — fall back to platform default sender
    }
    return undefined;
  },
);
