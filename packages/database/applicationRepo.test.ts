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
