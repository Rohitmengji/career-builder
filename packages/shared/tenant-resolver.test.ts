import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Prisma client BEFORE importing the resolver (hoisted by vitest).
const findFirst = vi.fn();
vi.mock("@career-builder/database/client", () => ({
  prisma: { tenant: { findFirst: (...args: unknown[]) => findFirst(...args) } },
}));

import {
  resolveFromSlug,
  resolveFromSubdomain,
  resolveTenant,
  tenantCacheKey,
  invalidateTenantCache,
} from "./tenant-resolver";

const ACME = { id: "acme", name: "Acme", domain: "careers.acme.com", plan: "pro", isActive: true };

beforeEach(() => {
  findFirst.mockReset();
});

describe("tenantCacheKey", () => {
  it("namespaces per tenant + segments (no cross-tenant collision)", () => {
    expect(tenantCacheKey("acme", "jobs", "123")).toBe("t:acme:jobs:123");
    expect(tenantCacheKey("acme", "jobs")).not.toBe(tenantCacheKey("globex", "jobs"));
  });
});

describe("resolveFromSlug", () => {
  it("returns an active tenant and caches it (second call skips the DB)", async () => {
    findFirst.mockResolvedValueOnce(ACME);
    const first = await resolveFromSlug("acme");
    expect(first.tenant?.id).toBe("acme");
    expect(first.source).toBe("route");
    expect(findFirst).toHaveBeenCalledTimes(1);

    const second = await resolveFromSlug("acme"); // served from cache
    expect(second.tenant?.id).toBe("acme");
    expect(findFirst).toHaveBeenCalledTimes(1); // not called again

    invalidateTenantCache("acme");
  });

  it("returns null for an inactive tenant (isolation: disabled clients are invisible)", async () => {
    findFirst.mockResolvedValueOnce({ ...ACME, id: "suspended", isActive: false });
    const res = await resolveFromSlug("suspended");
    expect(res.tenant).toBeNull();
  });

  it("returns null (not a throw) when the DB errors", async () => {
    findFirst.mockRejectedValueOnce(new Error("db down"));
    const res = await resolveFromSlug("boom");
    expect(res.tenant).toBeNull();
  });
});

describe("resolveFromSubdomain", () => {
  it("skips reserved subdomains and apex hosts without touching the DB", async () => {
    for (const host of ["localhost", "example.com", "www.example.com", "admin.example.com", "api.example.com"]) {
      const res = await resolveFromSubdomain(host);
      expect(res.tenant).toBeNull();
    }
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("resolves a real subdomain via the slug path", async () => {
    findFirst.mockResolvedValueOnce(ACME);
    const res = await resolveFromSubdomain("acme.hirebase.dev");
    expect(res.tenant?.id).toBe("acme");
    invalidateTenantCache("acme");
  });
});

describe("resolveTenant priority", () => {
  it("prefers an explicit slug over subdomain", async () => {
    findFirst.mockResolvedValueOnce(ACME);
    const res = await resolveTenant({ slug: "acme", hostname: "globex.hirebase.dev" });
    expect(res.tenant?.id).toBe("acme");
    expect(findFirst).toHaveBeenCalledTimes(1); // stopped at slug, never tried subdomain
    invalidateTenantCache("acme");
  });

  it("falls through to env when nothing resolves", async () => {
    findFirst.mockResolvedValue(null); // every lookup misses
    const res = await resolveTenant({ slug: "nope", hostname: "ghost.hirebase.dev" });
    expect(res.tenant).toBeNull();
    expect(res.source).toBe("env");
  });
});
