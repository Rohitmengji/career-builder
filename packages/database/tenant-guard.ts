/*
 * Tenant guard — defense-in-depth helpers for tenant isolation.
 *
 * Turso/SQLite has no row-level security, so isolation is enforced in code.
 * The primary mechanism is explicit per-call tenant scoping (repositories take
 * a tenantId; mutations go through assertOwned). These helpers make that
 * scoping uniform and hard to forget on the READ paths, and give the request
 * layer one place to assert ownership.
 *
 * NOTE: a fully-global Prisma `$extends` interceptor that injects tenantId into
 * EVERY operation is intentionally NOT used here — update/delete/upsert use
 * unique-where input types that can't safely take an extra tenantId field, and
 * a global interceptor would also break legitimate cross-tenant admin queries.
 * The escape hatch is simply the raw `prisma` client for unscoped/admin use.
 */

/** Models that carry a tenantId and must always be queried within a tenant. */
export const TENANT_SCOPED_MODELS = [
  "job",
  "application",
  "candidate",
  "page",
  "pageVersion",
  "analyticsEvent",
  "auditLog",
  "subscription",
] as const;

export type TenantScopedModel = (typeof TENANT_SCOPED_MODELS)[number];

/**
 * Merge a tenantId into a Prisma `where` filter so a query can't span tenants.
 * Use on findMany/findFirst/count/updateMany/deleteMany where clauses.
 *
 * @throws if tenantId is empty — a tenant-scoped read with no tenant is a bug.
 */
export function tenantWhere<W extends Record<string, unknown>>(
  tenantId: string,
  where?: W,
): W & { tenantId: string } {
  if (!tenantId) {
    throw new Error("[tenant-guard] tenantWhere() requires a non-empty tenantId");
  }
  return { ...(where ?? ({} as W)), tenantId };
}

/**
 * Assert that a loaded row belongs to the expected tenant. Returns the row when
 * it matches, otherwise null (treat as not-found — never leak a foreign row).
 */
export function assertTenantOwned<T extends { tenantId: string }>(
  row: T | null | undefined,
  tenantId: string,
): T | null {
  if (!row) return null;
  if (!tenantId || row.tenantId !== tenantId) return null;
  return row;
}
