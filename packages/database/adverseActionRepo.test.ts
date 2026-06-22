import { describe, it, expect, vi, beforeEach } from "vitest";

const upsert = vi.fn();
const findFirst = vi.fn();
const findMany = vi.fn();
const groupBy = vi.fn();
vi.mock("./client", () => ({
  prisma: {
    adverseAction: {
      upsert: (...a: unknown[]) => upsert(...a),
      findFirst: (...a: unknown[]) => findFirst(...a),
      findMany: (...a: unknown[]) => findMany(...a),
      groupBy: (...a: unknown[]) => groupBy(...a),
    },
  },
}));

import { adverseActionRepo } from "./repositories/adverseActionRepo";

beforeEach(() => { [upsert, findFirst, findMany, groupBy].forEach((f) => f.mockReset()); });

describe("adverseActionRepo.upsert", () => {
  it("upserts on the unique applicationId; create carries tenantId + defaults", async () => {
    upsert.mockResolvedValueOnce({});
    await adverseActionRepo.upsert({ tenantId: "acme", applicationId: "app1", category: "experience_gap", freeText: "internal" });
    const arg = upsert.mock.calls[0][0];
    expect(arg.where).toEqual({ applicationId: "app1" });
    expect(arg.create).toMatchObject({ tenantId: "acme", applicationId: "app1", category: "experience_gap", kind: "rejection", sharedWithCandidate: false });
    expect(arg.update).toMatchObject({ category: "experience_gap", kind: "rejection" });
  });
});

describe("adverseActionRepo — scoping + leakage", () => {
  it("findForApplication scopes by tenant + application", async () => {
    findFirst.mockResolvedValueOnce(null);
    await adverseActionRepo.findForApplication("acme", "app1");
    expect(findFirst.mock.calls[0][0].where).toEqual({ tenantId: "acme", applicationId: "app1" });
  });

  it("findCandidateVisible returns only shared records and NEVER selects freeText/decidedBy", async () => {
    findMany.mockResolvedValueOnce([]);
    await adverseActionRepo.findCandidateVisible("acme", ["app1", "app2"]);
    const arg = findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ tenantId: "acme", applicationId: { in: ["app1", "app2"] }, sharedWithCandidate: true });
    expect(Object.keys(arg.select)).toEqual(["applicationId", "category", "candidateMessage", "sharedWithCandidate"]);
    expect(arg.select.freeText).toBeUndefined();
    expect(arg.select.decidedBy).toBeUndefined();
  });

  it("findCandidateVisible short-circuits on empty input (no DB hit)", async () => {
    const out = await adverseActionRepo.findCandidateVisible("acme", []);
    expect(out).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("aggregateByCategory groups by category, tenant-scoped, counts only", async () => {
    groupBy.mockResolvedValueOnce([]);
    await adverseActionRepo.aggregateByCategory("acme");
    const arg = groupBy.mock.calls[0][0];
    expect(arg.by).toEqual(["category"]);
    expect(arg.where).toEqual({ tenantId: "acme" });
    expect(arg._count).toEqual({ _all: true });
  });
});
