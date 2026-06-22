import { describe, it, expect, vi, beforeEach } from "vitest";

const create = vi.fn();
const findFirst = vi.fn();
const findMany = vi.fn();
const count = vi.fn();
const updateMany = vi.fn();
vi.mock("./client", () => ({
  prisma: {
    offer: {
      create: (...a: unknown[]) => create(...a),
      findFirst: (...a: unknown[]) => findFirst(...a),
      findMany: (...a: unknown[]) => findMany(...a),
      count: (...a: unknown[]) => count(...a),
      updateMany: (...a: unknown[]) => updateMany(...a),
    },
  },
}));

import { offerRepo } from "./repositories/offerRepo";

beforeEach(() => {
  [create, findFirst, findMany, count, updateMany].forEach((f) => f.mockReset());
});

describe("offerRepo.create", () => {
  it("starts in draft and applies USD/yearly defaults", async () => {
    create.mockResolvedValueOnce({});
    await offerRepo.create({ tenantId: "acme", applicationId: "app1", createdById: "u1" });
    expect(create.mock.calls[0][0].data).toMatchObject({
      tenantId: "acme",
      applicationId: "app1",
      createdById: "u1",
      status: "draft",
      salaryCurrency: "USD",
      salaryPeriod: "yearly",
      salaryAmount: null,
    });
  });
});

describe("offerRepo — tenant scoping", () => {
  it("findByIdScoped scopes by id + tenant", async () => {
    findFirst.mockResolvedValueOnce(null);
    await offerRepo.findByIdScoped("off1", "acme");
    expect(findFirst.mock.calls[0][0].where).toEqual({ id: "off1", tenantId: "acme" });
  });

  it("listForApplication scopes by tenant + application", async () => {
    findMany.mockResolvedValueOnce([]);
    await offerRepo.listForApplication("acme", "app1");
    expect(findMany.mock.calls[0][0].where).toEqual({ tenantId: "acme", applicationId: "app1" });
  });

  it("countActiveForApplication filters to non-terminal statuses, tenant-scoped", async () => {
    count.mockResolvedValueOnce(0);
    await offerRepo.countActiveForApplication("acme", "app1");
    expect(count.mock.calls[0][0].where).toEqual({
      tenantId: "acme",
      applicationId: "app1",
      status: { in: ["draft", "pending_approval", "approved", "sent"] },
    });
  });
});

describe("offerRepo — candidate ownership (email + tenant, lowercased)", () => {
  it("findForCandidate scopes by id + tenant + lowercased application email", async () => {
    findFirst.mockResolvedValueOnce(null);
    await offerRepo.findForCandidate("off1", "Jane@Example.com", "acme");
    expect(findFirst.mock.calls[0][0].where).toEqual({
      id: "off1",
      tenantId: "acme",
      application: { email: "jane@example.com" },
    });
  });

  it("listForCandidate filters by tenant + lowercased application email", async () => {
    findMany.mockResolvedValueOnce([]);
    await offerRepo.listForCandidate("Jane@Example.com", "acme");
    expect(findMany.mock.calls[0][0].where).toEqual({ tenantId: "acme", application: { email: "jane@example.com" } });
  });
});

describe("offerRepo — atomic CAS transitions", () => {
  it("transition guards on expected current status in the WHERE and returns count", async () => {
    updateMany.mockResolvedValueOnce({ count: 1 });
    const n = await offerRepo.transition("off1", "acme", "approved", { status: "sent", sentAt: new Date("2026-06-22T00:00:00Z") });
    const arg = updateMany.mock.calls[0][0];
    expect(arg.where).toEqual({ id: "off1", tenantId: "acme", status: "approved" });
    expect(arg.data).toMatchObject({ status: "sent" });
    expect(n).toBe(1);
  });

  it("transition returning 0 signals a lost race / wrong state", async () => {
    updateMany.mockResolvedValueOnce({ count: 0 });
    expect(await offerRepo.transition("off1", "acme", "approved", { status: "sent" })).toBe(0);
  });

  it("decideAsCandidate only matches a SENT, unexpired, owned offer (no TOCTOU window)", async () => {
    updateMany.mockResolvedValueOnce({ count: 1 });
    const now = new Date("2026-06-22T12:00:00Z");
    const n = await offerRepo.decideAsCandidate("off1", "acme", "Jane@Example.com", "accepted", "thanks!", now);
    const arg = updateMany.mock.calls[0][0];
    expect(arg.where).toEqual({
      id: "off1",
      tenantId: "acme",
      application: { email: "jane@example.com" },
      status: "sent",
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    });
    expect(arg.data).toEqual({ status: "accepted", respondedAt: now, decisionNote: "thanks!" });
    expect(n).toBe(1);
  });

  it("decideAsCandidate returning 0 means expired / already-decided / not owned", async () => {
    updateMany.mockResolvedValueOnce({ count: 0 });
    expect(
      await offerRepo.decideAsCandidate("off1", "acme", "jane@example.com", "declined", null, new Date()),
    ).toBe(0);
  });
});
