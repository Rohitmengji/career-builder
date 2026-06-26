/*
 * Unit (contract) tests for tagRepo — the application-tag library + links (ADR-0016).
 * Prisma is mocked (./client), so these assert the SHAPE of the queries the repo
 * builds, not real DB behavior.
 *
 * Pinned invariants (no RLS — the repo is the only tenant guard):
 *   - EVERY query carries tenantId, including the link mutations.
 *   - addToApplication is idempotent: a P2002 (already linked) → false, not a throw.
 *   - listForApplications scopes by tenant + the given ids and groups by application.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const tagFindMany = vi.fn();
const tagFindFirst = vi.fn();
const tagCreate = vi.fn();
const tagUpdateMany = vi.fn();
const tagDeleteMany = vi.fn();
const linkCreate = vi.fn();
const linkDeleteMany = vi.fn();
const linkFindMany = vi.fn();

// Mock @prisma/client so the repo's `Prisma.PrismaClientKnownRequestError`
// instanceof check matches errors we throw below. The class MUST be declared
// inside the factory (vi.mock is hoisted above any top-level variable).
vi.mock("@prisma/client", () => {
  class PrismaClientKnownRequestError extends Error {
    code: string;
    constructor(message: string, code: string) { super(message); this.code = code; }
  }
  return { Prisma: { PrismaClientKnownRequestError } };
});
vi.mock("./client", () => ({
  prisma: {
    applicationTag: {
      findMany: (...a: unknown[]) => tagFindMany(...a),
      findFirst: (...a: unknown[]) => tagFindFirst(...a),
      create: (...a: unknown[]) => tagCreate(...a),
      updateMany: (...a: unknown[]) => tagUpdateMany(...a),
      deleteMany: (...a: unknown[]) => tagDeleteMany(...a),
    },
    applicationTagOnApplication: {
      create: (...a: unknown[]) => linkCreate(...a),
      deleteMany: (...a: unknown[]) => linkDeleteMany(...a),
      findMany: (...a: unknown[]) => linkFindMany(...a),
    },
  },
}));

import { Prisma } from "@prisma/client";
import { tagRepo } from "./repositories/tagRepo";

beforeEach(() => {
  [tagFindMany, tagFindFirst, tagCreate, tagUpdateMany, tagDeleteMany, linkCreate, linkDeleteMany, linkFindMany].forEach((f) => f.mockReset());
});

describe("tagRepo — tenant scoping", () => {
  it("listForTenant scopes by tenant and includes usage count", async () => {
    tagFindMany.mockResolvedValueOnce([]);
    await tagRepo.listForTenant("acme");
    const arg = tagFindMany.mock.calls[0][0];
    expect(arg.where).toEqual({ tenantId: "acme" });
    expect(arg.include).toEqual({ _count: { select: { applications: true } } });
  });

  it("findByIdScoped scopes by id + tenant", async () => {
    tagFindFirst.mockResolvedValueOnce(null);
    await tagRepo.findByIdScoped("tag1", "acme");
    expect(tagFindFirst.mock.calls[0][0].where).toEqual({ id: "tag1", tenantId: "acme" });
  });

  it("update is tenant-scoped and returns rows changed", async () => {
    tagUpdateMany.mockResolvedValueOnce({ count: 1 });
    const n = await tagRepo.update("tag1", "acme", { label: "X" });
    expect(tagUpdateMany.mock.calls[0][0].where).toEqual({ id: "tag1", tenantId: "acme" });
    expect(n).toBe(1);
  });

  it("delete is tenant-scoped and returns rows deleted", async () => {
    tagDeleteMany.mockResolvedValueOnce({ count: 1 });
    const n = await tagRepo.delete("tag1", "acme");
    expect(tagDeleteMany.mock.calls[0][0].where).toEqual({ id: "tag1", tenantId: "acme" });
    expect(n).toBe(1);
  });
});

describe("tagRepo — link mutations", () => {
  it("addToApplication stamps tenantId on the join and returns true", async () => {
    linkCreate.mockResolvedValueOnce({});
    const ok = await tagRepo.addToApplication("acme", "app1", "tag1", "user1");
    expect(linkCreate.mock.calls[0][0].data).toMatchObject({ tenantId: "acme", applicationId: "app1", tagId: "tag1", createdById: "user1" });
    expect(ok).toBe(true);
  });

  it("addToApplication swallows a duplicate (P2002) and returns false (idempotent)", async () => {
    linkCreate.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("dup", "P2002"));
    const ok = await tagRepo.addToApplication("acme", "app1", "tag1");
    expect(ok).toBe(false);
  });

  it("addToApplication rethrows non-P2002 errors", async () => {
    linkCreate.mockRejectedValueOnce(new Error("db down"));
    await expect(tagRepo.addToApplication("acme", "app1", "tag1")).rejects.toThrow("db down");
  });

  it("removeFromApplication scopes by tenant + application + tag", async () => {
    linkDeleteMany.mockResolvedValueOnce({ count: 1 });
    await tagRepo.removeFromApplication("acme", "app1", "tag1");
    expect(linkDeleteMany.mock.calls[0][0].where).toEqual({ tenantId: "acme", applicationId: "app1", tagId: "tag1" });
  });
});

describe("tagRepo.listForApplications", () => {
  it("short-circuits with no DB hit on empty ids", async () => {
    const map = await tagRepo.listForApplications("acme", []);
    expect(linkFindMany).not.toHaveBeenCalled();
    expect(map.size).toBe(0);
  });

  it("scopes by tenant + ids and groups tags by applicationId", async () => {
    linkFindMany.mockResolvedValueOnce([
      { applicationId: "app1", tag: { id: "t1", label: "A", color: "blue" } },
      { applicationId: "app1", tag: { id: "t2", label: "B", color: null } },
      { applicationId: "app2", tag: { id: "t1", label: "A", color: "blue" } },
    ]);
    const map = await tagRepo.listForApplications("acme", ["app1", "app2"]);
    expect(linkFindMany.mock.calls[0][0].where).toEqual({ tenantId: "acme", applicationId: { in: ["app1", "app2"] } });
    expect(map.get("app1")).toHaveLength(2);
    expect(map.get("app2")).toEqual([{ id: "t1", label: "A", color: "blue" }]);
  });
});
