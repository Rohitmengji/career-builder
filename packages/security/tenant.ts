/*
 * @career-builder/security — Tenant Isolation
 *
 * Provides middleware-like utilities that enforce multi-tenant data boundaries.
 *
 * Protects against:
 *   - Cross-tenant data leakage (T1 accessing T2's records)
 *   - Missing tenantId on mutations
 *   - Privilege escalation across tenants
 *
 * Strategy:
 *   1. Every API request must carry tenantId (from session or header)
 *   2. All DB queries must be scoped to that tenantId
 *   3. Mutation responses are double-checked against session tenantId
 */

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

export interface TenantContext {
  tenantId: string;
  userId: string;
  role: string;
}

/* ================================================================== */
/*  Tenant ID extraction & validation                                  */
/* ================================================================== */

const TENANT_ID_RE = /^[a-z0-9][a-z0-9-]{0,48}[a-z0-9]$/;

/**
 * Validate a tenant ID format.
 * Must be 2-50 chars, lowercase alphanumeric + hyphens, no leading/trailing hyphen.
 */
export function isValidTenantId(id: unknown): id is string {
  return typeof id === "string" && TENANT_ID_RE.test(id);
}

/**
 * Extract the tenant ID from a Request.
 * Checks (in order): X-Tenant-ID header → cookie → null
 */
export function extractTenantId(request: Request): string | null {
  // 1. Explicit header (used by admin API calls)
  const headerVal = request.headers.get("x-tenant-id");
  if (headerVal && isValidTenantId(headerVal)) return headerVal;

  // 2. Cookie (set during auth)
  const cookies = request.headers.get("cookie") || "";
  const match = cookies.match(/(?:^|;\s*)tenantId=([^;]+)/);
  if (match && isValidTenantId(match[1])) return match[1]!;

  return null;
}

/* ================================================================== */
/*  Query scoping                                                      */
/* ================================================================== */

/**
 * Scope a Prisma `where` clause to the given tenantId.
 * Ensures every query is filtered by tenant.
 *
 * @example
 *   const jobs = await prisma.job.findMany({
 *     where: scopeToTenant({ status: 'published' }, 'acme')
 *   });
 */
export function scopeToTenant<T extends Record<string, unknown>>(
  where: T,
  tenantId: string,
): T & { tenantId: string } {
  if (!isValidTenantId(tenantId)) {
    throw new Error(`Invalid tenantId: ${tenantId}`);
  }
  return { ...where, tenantId };
}

/**
 * Verify that a record belongs to the expected tenant.
 * Throws if there's a mismatch — this is a secondary safety net
 * in case the query-level scoping was bypassed.
 */
export function assertTenantOwnership(
  record: { tenantId?: string } | null | undefined,
  expectedTenantId: string,
  entityName = "Record",
): void {
  if (!record) {
    throw new TenantAccessError(`${entityName} not found`);
  }
  if (record.tenantId !== expectedTenantId) {
    throw new TenantAccessError(
      `Tenant mismatch: ${entityName} belongs to a different tenant`,
    );
  }
}

/* ================================================================== */
/*  Errors                                                             */
/* ================================================================== */

export class TenantAccessError extends Error {
  public readonly status = 403;
  public readonly code = "TENANT_ACCESS_DENIED";

  constructor(message: string) {
    super(message);
    this.name = "TenantAccessError";
  }
}

/* ================================================================== */
/*  Request-level guard                                                */
/* ================================================================== */

/**
 * Guard that ensures a valid tenant context exists.
 * Returns a JSON Response if the check fails, or the TenantContext on success.
 */
export function requireTenantContext(
  tenantId: string | null | undefined,
  userId: string | null | undefined,
  role: string | null | undefined,
): TenantContext | Response {
  if (!tenantId || !isValidTenantId(tenantId)) {
    return new Response(
      JSON.stringify({ error: "Tenant context required" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }
  if (!userId) {
    return new Response(
      JSON.stringify({ error: "Authentication required" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }
  return { tenantId, userId, role: role || "viewer" };
}

/* ================================================================== */
/*  Tenant-scoped helpers                                              */
/* ================================================================== */

/**
 * Create a set of Prisma query helpers scoped to a tenant.
 * Reduces boilerplate by pre-binding tenantId.
 *
 * @example
 *   const scoped = tenantScope('acme');
 *   const jobs = await prisma.job.findMany({ where: scoped.where({ status: 'published' }) });
 *   const newJob = await prisma.job.create({ data: scoped.data({ title: 'Engineer' }) });
 */
export function tenantScope(tenantId: string) {
  if (!isValidTenantId(tenantId)) {
    throw new Error(`Invalid tenantId: ${tenantId}`);
  }

  return {
    /** Add tenantId to a where clause */
    where: <T extends Record<string, unknown>>(clause: T = {} as T) => ({
      ...clause,
      tenantId,
    }),

    /** Add tenantId to a data clause (for create/update) */
    data: <T extends Record<string, unknown>>(data: T) => ({
      ...data,
      tenantId,
    }),

    /** The raw tenantId */
    tenantId,
  };
}
