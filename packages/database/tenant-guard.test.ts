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
