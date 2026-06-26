/*
 * Unit (contract) tests for talentPoolRepo — talent pools + members (ADR-0018).
 * Prisma is mocked. Pinned invariants (no RLS — the repo is the only guard):
 *   - EVERY query is tenant-scoped.
 *   - addMember lowercases the email and is idempotent (P2002 -> false).
 *   - deleteMembersByEmail (the GDPR §17 erasure hook) deletes by tenant + lc email.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const poolFindMany = vi.fn();
const poolFindFirst = vi.fn();
const poolCreate = vi.fn();
const poolUpdateMany = vi.fn();
const poolDeleteMany = vi.fn();
const memberCreate = vi.fn();
const memberDeleteMany = vi.fn();
const memberFindMany = vi.fn();

vi.mock("@prisma/client", () => {
  class PrismaClientKnownRequestError extends Error {
    code: string;
    constructor(message: string, code: string) { super(message); this.code = code; }
  }
  return { Prisma: { PrismaClientKnownRequestError } };
});
vi.mock("./client", () => ({
  prisma: {
    talentPool: {
      findMany: (...a: unknown[]) => poolFindMany(...a),
      findFirst: (...a: unknown[]) => poolFindFirst(...a),
      create: (...a: unknown[]) => poolCreate(...a),
      updateMany: (...a: unknown[]) => poolUpdateMany(...a),
      deleteMany: (...a: unknown[]) => poolDeleteMany(...a),
    },
    talentPoolMember: {
      create: (...a: unknown[]) => memberCreate(...a),
      deleteMany: (...a: unknown[]) => memberDeleteMany(...a),
      findMany: (...a: unknown[]) => memberFindMany(...a),
    },
  },
}));

import { Prisma } from "@prisma/client";
import { talentPoolRepo } from "./repositories/talentPoolRepo";

beforeEach(() => {
  [poolFindMany, poolFindFirst, poolCreate, poolUpdateMany, poolDeleteMany, memberCreate, memberDeleteMany, memberFindMany].forEach((f) => f.mockReset());
});

describe("talentPoolRepo — tenant scoping", () => {
  it("listForTenant scopes by tenant + includes member count", async () => {
    poolFindMany.mockResolvedValueOnce([]);
    await talentPoolRepo.listForTenant("acme");
    const arg = poolFindMany.mock.calls[0][0];
    expect(arg.where).toEqual({ tenantId: "acme" });
    expect(arg.include).toEqual({ _count: { select: { members: true } } });
  });

  it("findByIdScoped scopes by id + tenant", async () => {
    poolFindFirst.mockResolvedValueOnce(null);
    await talentPoolRepo.findByIdScoped("p1", "acme");
    expect(poolFindFirst.mock.calls[0][0].where).toEqual({ id: "p1", tenantId: "acme" });
  });

  it("update + delete are tenant-scoped", async () => {
    poolUpdateMany.mockResolvedValueOnce({ count: 1 });
    poolDeleteMany.mockResolvedValueOnce({ count: 1 });
    await talentPoolRepo.update("p1", "acme", { name: "VIP" });
    await talentPoolRepo.delete("p1", "acme");
    expect(poolUpdateMany.mock.calls[0][0].where).toEqual({ id: "p1", tenantId: "acme" });
    expect(poolDeleteMany.mock.calls[0][0].where).toEqual({ id: "p1", tenantId: "acme" });
  });
});

describe("talentPoolRepo — members", () => {
  it("addMember lowercases the email + stamps tenantId, returns true", async () => {
    memberCreate.mockResolvedValueOnce({});
    const ok = await talentPoolRepo.addMember("acme", "p1", "JANE@X.com", { candidateName: "Jane", addedById: "u1" });
    expect(memberCreate.mock.calls[0][0].data).toMatchObject({ tenantId: "acme", poolId: "p1", candidateEmail: "jane@x.com", candidateName: "Jane", addedById: "u1" });
    expect(ok).toBe(true);
  });

  it("addMember swallows duplicate (P2002) -> false (idempotent)", async () => {
    memberCreate.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("dup", "P2002"));
    expect(await talentPoolRepo.addMember("acme", "p1", "a@x.com")).toBe(false);
  });

  it("addMember rethrows non-P2002", async () => {
    memberCreate.mockRejectedValueOnce(new Error("db down"));
    await expect(talentPoolRepo.addMember("acme", "p1", "a@x.com")).rejects.toThrow("db down");
  });

  it("removeMember scopes by tenant + pool + lc email", async () => {
    memberDeleteMany.mockResolvedValueOnce({ count: 1 });
    await talentPoolRepo.removeMember("acme", "p1", "JANE@X.com");
    expect(memberDeleteMany.mock.calls[0][0].where).toEqual({ tenantId: "acme", poolId: "p1", candidateEmail: "jane@x.com" });
  });

  it("listMembers scopes by tenant + pool", async () => {
    memberFindMany.mockResolvedValueOnce([]);
    await talentPoolRepo.listMembers("acme", "p1");
    expect(memberFindMany.mock.calls[0][0].where).toEqual({ tenantId: "acme", poolId: "p1" });
  });

  it("deleteMembersByEmail (erasure hook) deletes by tenant + lc email across pools", async () => {
    memberDeleteMany.mockResolvedValueOnce({ count: 2 });
    const n = await talentPoolRepo.deleteMembersByEmail("acme", "JANE@X.com");
    expect(memberDeleteMany.mock.calls[0][0].where).toEqual({ tenantId: "acme", candidateEmail: "jane@x.com" });
    expect(n).toBe(2);
  });
});
