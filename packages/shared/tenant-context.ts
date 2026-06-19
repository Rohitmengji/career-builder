/*
 * @career-builder/shared/tenant-context — per-request tenant context (NODE-ONLY).
 *
 * Wraps a request in an AsyncLocalStorage so any code in the call tree can ask
 * "which tenant am I serving?" without threading a tenantId through every
 * function. This is the isolation backstop: tenant-scoped code calls
 * getTenantId(), which THROWS if no tenant is in scope — a missing context is a
 * bug, not a silent fall-through to some default tenant.
 *
 * Edge middleware cannot use AsyncLocalStorage (node:async_hooks), so the flow
 * is: middleware sets the `x-tenant-id` header (see tenant-host) → a Node
 * bootstrap resolves it via the cached resolver → runWithTenant wraps the
 * handler. Do NOT import this module from edge middleware.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import type { ResolvedTenant, TenantSource } from "./tenant-resolver";

export interface TenantContextValue {
  tenant: ResolvedTenant;
  /** How the tenant was resolved (domain/subdomain/route/header/env). */
  source: TenantSource;
}

const storage = new AsyncLocalStorage<TenantContextValue>();

/** Run `fn` with the given tenant bound to the async context. */
export function runWithTenant<T>(ctx: TenantContextValue, fn: () => T): T {
  return storage.run(ctx, fn);
}

/** The full context (tenant + source), or undefined if none is bound. */
export function getTenantContext(): TenantContextValue | undefined {
  return storage.getStore();
}

/** The resolved tenant, or undefined if none is bound. */
export function getTenant(): ResolvedTenant | undefined {
  return storage.getStore()?.tenant;
}

/**
 * The current tenant id. THROWS when called outside a tenant-scoped context —
 * this is intentional: it surfaces missing isolation rather than leaking across
 * tenants. Use {@link getTenantIdOrNull} where absence is legitimately allowed.
 */
export function getTenantId(): string {
  const ctx = storage.getStore();
  if (!ctx) {
    throw new Error(
      "[tenant-context] getTenantId() called with no tenant in scope. " +
        "Wrap the request in runWithTenant(), or use getTenantIdOrNull() if absence is valid.",
    );
  }
  return ctx.tenant.id;
}

/** The current tenant id, or null when no tenant is bound (no throw). */
export function getTenantIdOrNull(): string | null {
  return storage.getStore()?.tenant.id ?? null;
}
