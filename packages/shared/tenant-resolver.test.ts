/*
 * Unit tests for the tenant resolver (./tenant-resolver) — how an inbound
 * request (slug / subdomain / custom domain) is mapped to a Tenant.
 *
 * WHY: tenant resolution is the front door of multi-tenancy. Every downstream
 * query is tenant-scoped in app code (no Postgres RLS), so resolving to the
 * WRONG tenant — or routing a tenant that is inactive or under-plan — is a
 * cross-tenant isolation failure. Prisma is mocked (hoisted by vitest) so this
 * exercises the routing/priority/caching/fail-closed logic without a DB.
 *
 * Key behaviors asserted:
 *  - tenantCacheKey namespaces per tenant + segments (no cross-tenant collision);
 *  - resolveFromSlug caches a hit (second call skips the DB), queries by id only
 *    (no fuzzy domain OR), returns null for an INACTIVE tenant, and fails closed
 *    (returns null, never throws) on a DB error;
 *  - resolveFromDomain prefers an ACTIVE managed Domain row, refuses a domain
 *    whose tenant downgraded below the required plan, and falls back to the
 *    legacy Tenant.domain column;
 *  - resolveFromSubdomain skips reserved subdomains / apex hosts without a DB hit;
 *  - resolveTenant priority: explicit slug beats subdomain, and an all-miss
 *    falls through to the env source.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Prisma client BEFORE importing the resolver (hoisted by vitest).
const findFirst = vi.fn(); // prisma.tenant.findFirst
const domainFindFirst = vi.fn(); // prisma.domain.findFirst (managed custom domains)
vi.mock("@career-builder/database/client", () => ({
  prisma: {
    tenant: { findFirst: (...args: unknown[]) => findFirst(...args) },
    domain: { findFirst: (...args: unknown[]) => domainFindFirst(...args) },
  },
}));

import {
  resolveFromSlug,
  resolveFromSubdomain,
  resolveFromDomain,
  resolveFromHost,
  resolveTenant,
  tenantCacheKey,
  invalidateTenantCache,
} from "./tenant-resolver";

const ACME = { id: "acme", name: "Acme", domain: "careers.acme.com", plan: "pro", isActive: true };

beforeEach(() => {
  findFirst.mockReset();
  domainFindFirst.mockReset();
  // Default: no managed custom domain → resolveFromDomain falls back to the
  // legacy Tenant.domain column (what most tests exercise).
  domainFindFirst.mockResolvedValue(null);
  // Deterministic subdomain-vs-custom-domain split for host parsing.
  process.env.PLATFORM_ROOT_DOMAIN = "hirebase.dev";
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

  it("queries by id only — no fuzzy domain OR", async () => {
    findFirst.mockResolvedValueOnce(null);
    await resolveFromSlug("acme-id-only");
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "acme-id-only" } }),
    );
  });
});

describe("resolveFromDomain", () => {
  it("matches an ACTIVE managed domain first (Domain table) without hitting the legacy column", async () => {
    domainFindFirst.mockResolvedValueOnce({ tenant: ACME });
    const res = await resolveFromDomain("Careers.Acme.com:443");
    expect(res.tenant?.id).toBe("acme");
    expect(res.source).toBe("domain");
    expect(domainFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { hostname: "careers.acme.com", status: "active" } }),
    );
    expect(findFirst).not.toHaveBeenCalled(); // legacy path not needed
    invalidateTenantCache("acme");
  });

  it("does NOT route a managed domain whose tenant downgraded below the required plan", async () => {
    // Active domain, but tenant is now on free → custom domains not allowed.
    domainFindFirst.mockResolvedValueOnce({ tenant: { ...ACME, plan: "free" } });
    findFirst.mockResolvedValueOnce(null); // legacy column also misses
    const res = await resolveFromDomain("careers.acme.com");
    expect(res.tenant).toBeNull();
    invalidateTenantCache("acme");
  });

  it("falls back to the legacy Tenant.domain column when no managed domain matches", async () => {
    domainFindFirst.mockResolvedValueOnce(null);
    findFirst.mockResolvedValueOnce(ACME);
    const res = await resolveFromDomain("careers.acme.com");
    expect(res.tenant?.id).toBe("acme");
    expect(res.source).toBe("domain");
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { domain: "careers.acme.com" } }),
    );
    invalidateTenantCache("acme");
  });

  it("returns null when no tenant owns the domain", async () => {
    domainFindFirst.mockResolvedValueOnce(null);
    findFirst.mockResolvedValueOnce(null);
    expect((await resolveFromDomain("unknown.example.com")).tenant).toBeNull();
  });
});

describe("resolveFromHost", () => {
  it("resolves a custom domain via exact match", async () => {
    findFirst.mockResolvedValueOnce(ACME); // domain hit
    const res = await resolveFromHost("careers.acme.com");
    expect(res.tenant?.id).toBe("acme");
    expect(res.source).toBe("domain");
    invalidateTenantCache("acme");
  });

  it("resolves a platform subdomain via the slug path", async () => {
    findFirst.mockResolvedValueOnce(ACME); // subdomain → slug hit
    const res = await resolveFromHost("acme.hirebase.dev");
    expect(res.tenant?.id).toBe("acme");
    expect(res.source).toBe("subdomain");
    invalidateTenantCache("acme");
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
