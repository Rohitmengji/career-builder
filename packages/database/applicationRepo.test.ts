/*
 * Unit (contract) tests for applicationRepo.findByTenant — the recruiter
 * candidate-search/list query. Prisma is mocked (./client), so these assert the
 * `where`/`omit` shape the repo builds, not DB behavior.
 *
 * WHY: this is the main list endpoint, so its filter must be both correct and
 * safe — tenant-scoped, the free-text search must span the right columns, and
 * the heavy résumé text must stay out of the list payload.
 *
 * Key behaviors pinned:
 *   - q builds an OR over firstName/lastName/email/resumeText (contains), and
 *     the SAME OR drives count() so pagination totals stay accurate.
 *   - blank/absent q omits the OR entirely (no empty-match filter).
 *   - tenant isolation: where.tenantId is always set (no RLS — app code guards).
 *   - projection: omit: { resumeText: true } keeps résumé bodies off the list.
 *   - q + status compose as tenant AND status AND the OR group.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Prisma client before importing the repo (hoisted).
const findMany = vi.fn();
const count = vi.fn();
vi.mock("./client", () => ({
  prisma: {
    application: {
      findMany: (...a: unknown[]) => findMany(...a),
      count: (...a: unknown[]) => count(...a),
    },
  },
}));

import { applicationRepo } from "./repositories/applicationRepo";

beforeEach(() => {
  findMany.mockReset();
  count.mockReset();
  findMany.mockResolvedValue([]);
  count.mockResolvedValue(0);
});

describe("applicationRepo.findByTenant — candidate search (q)", () => {
  it("builds a name/email/résumé OR filter when q is provided", async () => {
    await applicationRepo.findByTenant({ tenantId: "acme", q: "kubernetes" });
    const arg = findMany.mock.calls[0][0];
    expect(arg.where.tenantId).toBe("acme");
    expect(arg.where.OR).toEqual([
      { firstName: { contains: "kubernetes" } },
      { lastName: { contains: "kubernetes" } },
      { email: { contains: "kubernetes" } },
      { resumeText: { contains: "kubernetes" } },
    ]);
    // Same filter drives the count (accurate pagination).
    expect(count.mock.calls[0][0].where.OR).toBeDefined();
  });

  it("omits the OR filter when q is absent or blank", async () => {
    await applicationRepo.findByTenant({ tenantId: "acme" });
    expect(findMany.mock.calls[0][0].where.OR).toBeUndefined();

    await applicationRepo.findByTenant({ tenantId: "acme", q: "   " });
    expect(findMany.mock.calls[1][0].where.OR).toBeUndefined();
  });

  it("always tenant-scopes and keeps résumé text out of the list payload (omit)", async () => {
    await applicationRepo.findByTenant({ tenantId: "acme", q: "go" });
    const arg = findMany.mock.calls[0][0];
    expect(arg.where.tenantId).toBe("acme");
    expect(arg.omit).toEqual({ resumeText: true });
  });

  it("combines q with status (AND of tenant + status + OR group)", async () => {
    await applicationRepo.findByTenant({ tenantId: "acme", status: "interview", q: "react" });
    const where = findMany.mock.calls[0][0].where;
    expect(where.tenantId).toBe("acme");
    expect(where.status).toBe("interview");
    expect(where.OR).toHaveLength(4);
  });
});
