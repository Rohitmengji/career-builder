/*
 * Unit tests for ./tenant-context — the AsyncLocalStorage-backed per-request
 * tenant scope that the whole isolation model leans on.
 *
 * WHY: these tests pin the contract that tenant-scoped code depends on, so a
 * refactor of the ALS plumbing can't silently weaken isolation. The key
 * behaviors asserted:
 *   - inside runWithTenant the bound tenant is visible to all accessors;
 *   - getTenantId() THROWS outside any context (the isolation backstop — a
 *     missing context is a bug, never a silent default tenant), while
 *     getTenantIdOrNull() returns null for the "absence is valid" case;
 *   - the context survives `await` boundaries (real handlers are async);
 *   - the context does NOT leak after the run completes (no cross-request bleed).
 */
import { describe, it, expect } from "vitest";
import {
  runWithTenant,
  getTenant,
  getTenantId,
  getTenantIdOrNull,
  getTenantContext,
  type TenantContextValue,
} from "./tenant-context";

const ctx: TenantContextValue = {
  tenant: { id: "acme", name: "Acme", domain: null, plan: "pro", isActive: true },
  source: "subdomain",
};

describe("tenant-context", () => {
  it("exposes the bound tenant inside runWithTenant", () => {
    runWithTenant(ctx, () => {
      expect(getTenantId()).toBe("acme");
      expect(getTenant()?.id).toBe("acme");
      expect(getTenantIdOrNull()).toBe("acme");
      expect(getTenantContext()?.source).toBe("subdomain");
    });
  });

  it("getTenantId THROWS outside any context (isolation backstop)", () => {
    expect(() => getTenantId()).toThrow(/no tenant in scope/i);
  });

  it("getTenantIdOrNull returns null outside any context", () => {
    expect(getTenantIdOrNull()).toBeNull();
    expect(getTenant()).toBeUndefined();
  });

  it("survives async boundaries within the run", async () => {
    await runWithTenant(ctx, async () => {
      await Promise.resolve();
      expect(getTenantId()).toBe("acme");
    });
  });

  it("does not leak the context after the run completes", () => {
    runWithTenant(ctx, () => getTenantId());
    expect(getTenantIdOrNull()).toBeNull();
  });
});
