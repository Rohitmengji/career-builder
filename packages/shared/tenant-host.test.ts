/*
 * Unit tests for parseHostTenant (./tenant-host) — the host → tenant-hint parser.
 *
 * WHY: tenant resolution begins by deciding what an incoming Host header points
 * at (a platform subdomain like `acme.hirebase.dev`, a custom domain, or no
 * tenant at all). This is pure string logic, so it is tested in isolation from
 * the DB-backed resolver; getting it wrong is a cross-tenant routing bug.
 *
 * Key behaviors asserted:
 *  - subdomain extraction under an explicit platform root, with the :port stripped;
 *  - the platform apex (and `www`) resolve to NO tenant;
 *  - reserved subdomains (www/api/admin/app) are never treated as tenants;
 *  - hosts outside the root are flagged isCustomDomain (no slug guess);
 *  - <sub>.localhost dev convention and bare-localhost handling;
 *  - the no-root heuristic (first label when 3+ labels) and the 2-label apex
 *    custom-domain fallback; plus null/empty host safety.
 */
import { describe, it, expect } from "vitest";
import { parseHostTenant } from "./tenant-host";

describe("parseHostTenant (with explicit root domain)", () => {
  const root = "hirebase.dev";

  it("extracts a subdomain under the platform root", () => {
    const r = parseHostTenant("acme.hirebase.dev", root);
    expect(r).toMatchObject({ host: "acme.hirebase.dev", subdomain: "acme", candidate: "acme", isCustomDomain: false });
  });

  it("strips the port before parsing", () => {
    expect(parseHostTenant("acme.hirebase.dev:3000", root).candidate).toBe("acme");
  });

  it("treats the platform apex as no tenant", () => {
    expect(parseHostTenant("hirebase.dev", root).candidate).toBeNull();
    expect(parseHostTenant("www.hirebase.dev", root).candidate).toBeNull();
  });

  it("skips reserved subdomains", () => {
    for (const sub of ["www", "api", "admin", "app"]) {
      expect(parseHostTenant(`${sub}.hirebase.dev`, root).candidate).toBeNull();
    }
  });

  it("flags a host outside the root as a custom domain", () => {
    const r = parseHostTenant("careers.acme.com", root);
    expect(r.candidate).toBeNull();
    expect(r.isCustomDomain).toBe(true);
  });
});

describe("parseHostTenant (localhost dev)", () => {
  it("treats <sub>.localhost as a subdomain", () => {
    expect(parseHostTenant("acme.localhost").candidate).toBe("acme");
    expect(parseHostTenant("globex.localhost:3000").candidate).toBe("globex");
  });

  it("plain localhost has no tenant", () => {
    expect(parseHostTenant("localhost").candidate).toBeNull();
    expect(parseHostTenant("localhost:3000").candidate).toBeNull();
  });
});

describe("parseHostTenant (no root configured — heuristic)", () => {
  it("uses the first label when 3+ labels are present", () => {
    expect(parseHostTenant("acme.example.com", undefined).candidate).toBe("acme");
  });

  it("treats a bare 2-label apex as a possible custom domain", () => {
    const r = parseHostTenant("example.com", undefined);
    expect(r.candidate).toBeNull();
    expect(r.isCustomDomain).toBe(true);
  });

  it("handles empty/missing host", () => {
    expect(parseHostTenant(null).candidate).toBeNull();
    expect(parseHostTenant("").host).toBe("");
  });
});
