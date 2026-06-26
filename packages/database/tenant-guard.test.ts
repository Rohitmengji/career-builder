/*
 * Unit tests for tenant-guard — the primitives that enforce multi-tenancy in app code.
 *
 * WHY: We have NO Postgres RLS (SQLite/Turso); tenant isolation is the responsibility of
 * every query, so these helpers are the single most security-critical surface in the DB
 * package. A regression here leaks one tenant's data into another.
 *
 * Covers the three contracts a newcomer must trust:
 *   - tenantWhere: always injects tenantId, applies it LAST so a caller cannot spoof/override
 *     it via the extra filter, and refuses an empty tenantId (a scoped read with no tenant
 *     is a bug, not "match all").
 *   - assertTenantOwned: a deny-by-default ownership check — returns the row only for the
 *     owning tenant, else null; never throws-and-leaks.
 *   - TENANT_SCOPED_MODELS: the registry of per-tenant models (job/application/candidate/page).
 */
import { describe, it, expect } from "vitest";
import { tenantWhere, assertTenantOwned, TENANT_SCOPED_MODELS } from "./tenant-guard";

describe("tenantWhere", () => {
  it("injects the tenant filter into a where clause", () => {
    expect(tenantWhere("acme", { isPublished: true })).toEqual({ isPublished: true, tenantId: "acme" });
  });

  it("works with no prior filter", () => {
    expect(tenantWhere("acme")).toEqual({ tenantId: "acme" });
  });

  it("throws on an empty tenantId (a scoped read with no tenant is a bug)", () => {
    expect(() => tenantWhere("")).toThrow(/non-empty tenantId/);
  });

  it("a caller cannot override tenantId via the extra filter", () => {
    // tenantId is applied last, so a spoofed where.tenantId is overwritten.
    expect(tenantWhere("acme", { tenantId: "globex" } as Record<string, unknown>).tenantId).toBe("acme");
  });
});

describe("assertTenantOwned — deliberate cross-tenant access must be denied", () => {
  const row = { id: "app_1", tenantId: "acme", email: "a@b.com" };

  it("returns the row for the owning tenant", () => {
    expect(assertTenantOwned(row, "acme")).toBe(row);
  });

  it("DENIES a row owned by another tenant (returns null, never leaks)", () => {
    expect(assertTenantOwned(row, "globex")).toBeNull();
  });

  it("denies when no tenant is supplied", () => {
    expect(assertTenantOwned(row, "")).toBeNull();
    expect(assertTenantOwned(null, "acme")).toBeNull();
  });
});

describe("TENANT_SCOPED_MODELS", () => {
  it("covers the per-tenant data models", () => {
    for (const m of ["job", "application", "candidate", "page"]) {
      expect(TENANT_SCOPED_MODELS).toContain(m);
    }
  });
});
