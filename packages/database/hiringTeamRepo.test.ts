/*
 * Unit (contract) tests for hiringTeamRepo (ADR-0020, B6b) — application-visibility
 * scoping. Prisma is mocked. Pinned invariants (this is an access-control surface —
 * a scoping bug is a data leak):
 *   - EVERY query is tenant-scoped.
 *   - listJobIdsForUser returns exactly the user's team jobIds (the allow-list).
 *   - addMember is idempotent (P2002 → false).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const findMany = vi.fn();
const create = vi.fn();
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
    hiringTeamMember: {
      findMany: (...a: unknown[]) => findMany(...a),
      create: (...a: unknown[]) => create(...a),
      deleteMany: (...a: unknown[]) => deleteMany(...a),
    },
  },
}));

import { Prisma } from "@prisma/client";
import { hiringTeamRepo } from "./repositories/hiringTeamRepo";

beforeEach(() => { [findMany, create, deleteMany].forEach((f) => f.mockReset()); });

describe("hiringTeamRepo — scoping", () => {
  it("listForJob scopes by tenant + job and includes the user", async () => {
    findMany.mockResolvedValueOnce([]);
    await hiringTeamRepo.listForJob("acme", "job1");
    const arg = findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ tenantId: "acme", jobId: "job1" });
    expect(arg.include).toBeTruthy();
  });

  it("listJobIdsForUser scopes by tenant + user and returns the jobId allow-list", async () => {
    findMany.mockResolvedValueOnce([{ jobId: "j1" }, { jobId: "j2" }]);
    const ids = await hiringTeamRepo.listJobIdsForUser("acme", "u1");
    expect(findMany.mock.calls[0][0].where).toEqual({ tenantId: "acme", userId: "u1" });
    expect(ids).toEqual(["j1", "j2"]);
  });

  it("listJobIdsForUser returns [] for a user on no teams (no access)", async () => {
    findMany.mockResolvedValueOnce([]);
    expect(await hiringTeamRepo.listJobIdsForUser("acme", "u1")).toEqual([]);
  });
});

describe("hiringTeamRepo — mutations", () => {
  it("addMember stamps tenant + role, returns true", async () => {
    create.mockResolvedValueOnce({});
    const ok = await hiringTeamRepo.addMember("acme", "job1", "u1", "lead");
    expect(create.mock.calls[0][0].data).toEqual({ tenantId: "acme", jobId: "job1", userId: "u1", role: "lead" });
    expect(ok).toBe(true);
  });

  it("addMember swallows duplicate (P2002) → false (idempotent)", async () => {
    create.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("dup", "P2002"));
    expect(await hiringTeamRepo.addMember("acme", "job1", "u1")).toBe(false);
  });

  it("removeMember scopes by tenant + job + user", async () => {
    deleteMany.mockResolvedValueOnce({ count: 1 });
    await hiringTeamRepo.removeMember("acme", "job1", "u1");
    expect(deleteMany.mock.calls[0][0].where).toEqual({ tenantId: "acme", jobId: "job1", userId: "u1" });
  });
});
