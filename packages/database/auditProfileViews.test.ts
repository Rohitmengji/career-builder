import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Prisma client before importing the repo (hoisted).
const findMany = vi.fn();
const create = vi.fn();
vi.mock("./client", () => ({
  prisma: { auditLog: { findMany: (...a: unknown[]) => findMany(...a), create: (...a: unknown[]) => create(...a) } },
}));

import { auditRepo, CANDIDATE_PROFILE_VIEW } from "./repositories/auditRepo";

beforeEach(() => {
  findMany.mockReset();
  create.mockReset();
});

describe("auditRepo.logProfileView", () => {
  it("writes a tenant-scoped, append-only candidate_profile_view row", async () => {
    create.mockResolvedValueOnce({ id: "a1" });
    await auditRepo.logProfileView("acme", "app_1", "user_1", "1.2.3.4");
    expect(create).toHaveBeenCalledWith({
      data: {
        action: CANDIDATE_PROFILE_VIEW,
        entity: "application",
        entityId: "app_1",
        userId: "user_1",
        tenantId: "acme",
        ipAddress: "1.2.3.4",
      },
    });
  });
});

describe("auditRepo.findProfileViews — candidate 'who viewed me'", () => {
  it("returns nothing (no DB hit) when the candidate has no applications", async () => {
    const res = await auditRepo.findProfileViews("acme", []);
    expect(res).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("queries ONLY this tenant + the candidate's own application ids + the view action", async () => {
    findMany.mockResolvedValueOnce([
      { createdAt: new Date("2026-01-02"), user: { name: "Jane R." } },
      { createdAt: new Date("2026-01-01"), user: null },
    ]);
    const res = await auditRepo.findProfileViews("acme", ["app_1", "app_2"]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "acme", action: CANDIDATE_PROFILE_VIEW, entityId: { in: ["app_1", "app_2"] } },
      }),
    );
    // Returns only viewer name + timestamp (never the wider audit log).
    expect(res).toEqual([
      { viewerName: "Jane R.", viewedAt: new Date("2026-01-02") },
      { viewerName: "A team member", viewedAt: new Date("2026-01-01") },
    ]);
  });
});
