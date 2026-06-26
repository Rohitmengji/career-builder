/*
 * Unit (contract) tests for requisitionRepo (ADR-0020). Prisma is mocked.
 * Pinned invariants:
 *   - EVERY query is tenant-scoped.
 *   - transition is an ATOMIC compare-and-set: its WHERE carries the expected
 *     fromStatus, so a stale transition (status already moved) applies to 0 rows.
 *   - isDuplicateJobError maps P2002 (one-req-per-job) for the route.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const findMany = vi.fn();
const findFirst = vi.fn();
const create = vi.fn();
const updateMany = vi.fn();
const deleteMany = vi.fn();

vi.mock("@prisma/client", () => {
  class PrismaClientKnownRequestError extends Error {
    code: string;
    constructor(message: string, code: string) { super(message); this.code = code; }
  }
  return { Prisma: { PrismaClientKnownRequestError } };
});
vi.mock("./client", () => ({
  prisma: {
    requisition: {
      findMany: (...a: unknown[]) => findMany(...a),
      findFirst: (...a: unknown[]) => findFirst(...a),
      create: (...a: unknown[]) => create(...a),
      updateMany: (...a: unknown[]) => updateMany(...a),
      deleteMany: (...a: unknown[]) => deleteMany(...a),
    },
  },
}));

import { Prisma } from "@prisma/client";
import { requisitionRepo } from "./repositories/requisitionRepo";

beforeEach(() => { [findMany, findFirst, create, updateMany, deleteMany].forEach((f) => f.mockReset()); });

describe("requisitionRepo — tenant scoping", () => {
  it("listForTenant scopes by tenant (+ optional status)", async () => {
    findMany.mockResolvedValueOnce([]);
    await requisitionRepo.listForTenant("acme", "pending_approval");
    expect(findMany.mock.calls[0][0].where).toEqual({ tenantId: "acme", status: "pending_approval" });
  });

  it("findByIdScoped + findByJob are tenant-scoped", async () => {
    findFirst.mockResolvedValue(null);
    await requisitionRepo.findByIdScoped("r1", "acme");
    await requisitionRepo.findByJob("job1", "acme");
    expect(findFirst.mock.calls[0][0].where).toEqual({ id: "r1", tenantId: "acme" });
    expect(findFirst.mock.calls[1][0].where).toEqual({ jobId: "job1", tenantId: "acme" });
  });
});

describe("requisitionRepo.transition — atomic CAS", () => {
  it("WHERE carries id + tenant + the expected fromStatus", async () => {
    updateMany.mockResolvedValueOnce({ count: 1 });
    const n = await requisitionRepo.transition("r1", "acme", "pending_approval", "approved", { approverId: "u1", decisionNote: "ok", decidedAt: new Date(0) });
    const call = updateMany.mock.calls[0][0];
    expect(call.where).toEqual({ id: "r1", tenantId: "acme", status: "pending_approval" });
    expect(call.data).toMatchObject({ status: "approved", approverId: "u1", decisionNote: "ok" });
    expect(n).toBe(1);
  });

  it("returns 0 when the from-state no longer holds (stale transition)", async () => {
    updateMany.mockResolvedValueOnce({ count: 0 });
    expect(await requisitionRepo.transition("r1", "acme", "draft", "pending_approval")).toBe(0);
  });
});

describe("requisitionRepo — create + delete", () => {
  it("create stamps tenant + defaults", async () => {
    create.mockResolvedValueOnce({});
    await requisitionRepo.create({ tenantId: "acme", jobId: "job1", title: "Senior FE", createdById: "u1" });
    expect(create.mock.calls[0][0].data).toMatchObject({ tenantId: "acme", jobId: "job1", title: "Senior FE", headcount: 1, createdById: "u1" });
  });

  it("update is an atomic CAS on status==='draft' (can't mutate a non-draft req)", async () => {
    updateMany.mockResolvedValueOnce({ count: 0 });
    const n = await requisitionRepo.update("r1", "acme", { title: "X" });
    expect(updateMany.mock.calls[0][0].where).toEqual({ id: "r1", tenantId: "acme", status: "draft" });
    expect(n).toBe(0); // raced out of draft → 0 rows
  });

  it("delete is tenant-scoped", async () => {
    deleteMany.mockResolvedValueOnce({ count: 1 });
    await requisitionRepo.delete("r1", "acme");
    expect(deleteMany.mock.calls[0][0].where).toEqual({ id: "r1", tenantId: "acme" });
  });

  it("isDuplicateJobError detects P2002", () => {
    expect(requisitionRepo.isDuplicateJobError(new Prisma.PrismaClientKnownRequestError("dup", "P2002"))).toBe(true);
    expect(requisitionRepo.isDuplicateJobError(new Error("nope"))).toBe(false);
  });
});
