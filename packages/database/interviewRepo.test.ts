import { describe, it, expect, vi, beforeEach } from "vitest";

const create = vi.fn();
const findFirst = vi.fn();
const findMany = vi.fn();
const updateMany = vi.fn();
vi.mock("./client", () => ({
  prisma: {
    interview: {
      create: (...a: unknown[]) => create(...a),
      findFirst: (...a: unknown[]) => findFirst(...a),
      findMany: (...a: unknown[]) => findMany(...a),
      updateMany: (...a: unknown[]) => updateMany(...a),
    },
  },
}));

import { interviewRepo } from "./repositories/interviewRepo";

beforeEach(() => {
  [create, findFirst, findMany, updateMany].forEach((f) => f.mockReset());
});

describe("interviewRepo.create", () => {
  it("applies sane defaults", async () => {
    create.mockResolvedValueOnce({});
    await interviewRepo.create({ tenantId: "acme", applicationId: "app1", scheduledAt: new Date("2026-06-25T14:00:00Z") });
    expect(create.mock.calls[0][0].data).toMatchObject({
      tenantId: "acme",
      applicationId: "app1",
      round: 1,
      type: "video",
      status: "scheduled",
      durationMins: 45,
      timezone: "UTC",
      interviewerId: null,
    });
  });
});

describe("interviewRepo — candidate ownership + tenant scoping", () => {
  it("findForCandidate scopes by id + tenant + lowercased application email", async () => {
    findFirst.mockResolvedValueOnce(null);
    await interviewRepo.findForCandidate("iv1", "Jane@Example.com", "acme");
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "iv1", tenantId: "acme", application: { email: "jane@example.com" } } }),
    );
  });

  it("listForCandidate filters by tenant + application email", async () => {
    findMany.mockResolvedValueOnce([]);
    await interviewRepo.listForCandidate("Jane@Example.com", "acme");
    expect(findMany.mock.calls[0][0].where).toEqual({ tenantId: "acme", application: { email: "jane@example.com" } });
  });

  it("findByIdScoped scopes by id + tenant", async () => {
    findFirst.mockResolvedValueOnce(null);
    await interviewRepo.findByIdScoped("iv1", "acme");
    expect(findFirst.mock.calls[0][0].where).toEqual({ id: "iv1", tenantId: "acme" });
  });

  it("update goes through updateMany scoped to id + tenant", async () => {
    updateMany.mockResolvedValueOnce({ count: 1 });
    const n = await interviewRepo.update("iv1", "acme", { status: "confirmed" });
    expect(updateMany).toHaveBeenCalledWith({ where: { id: "iv1", tenantId: "acme" }, data: { status: "confirmed" } });
    expect(n).toBe(1);
  });
});
