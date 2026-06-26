/*
 * Unit (contract) tests for savedViewRepo — private, per-user filter presets (ADR-0016).
 * Prisma is mocked (./client). Pinned invariant: EVERY query scopes by BOTH tenantId
 * AND userId — a view is owned by one user in one tenant and is never readable or
 * deletable by anyone else (no RLS — the repo is the only guard).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const findMany = vi.fn();
const create = vi.fn();
const deleteMany = vi.fn();
vi.mock("./client", () => ({
  prisma: {
    savedView: {
      findMany: (...a: unknown[]) => findMany(...a),
      create: (...a: unknown[]) => create(...a),
      deleteMany: (...a: unknown[]) => deleteMany(...a),
    },
  },
}));

import { savedViewRepo } from "./repositories/savedViewRepo";

beforeEach(() => { [findMany, create, deleteMany].forEach((f) => f.mockReset()); });

describe("savedViewRepo — owner scoping", () => {
  it("listForUser scopes by tenant + user", async () => {
    findMany.mockResolvedValueOnce([]);
    await savedViewRepo.listForUser("acme", "user1");
    expect(findMany.mock.calls[0][0].where).toEqual({ tenantId: "acme", userId: "user1" });
  });

  it("create carries tenant + user + name + filters", async () => {
    create.mockResolvedValueOnce({});
    await savedViewRepo.create({ tenantId: "acme", userId: "user1", name: "Eng", filters: '{"status":"interview"}' });
    expect(create.mock.calls[0][0].data).toEqual({ tenantId: "acme", userId: "user1", name: "Eng", filters: '{"status":"interview"}' });
  });

  it("delete scopes by id + tenant + user (cannot delete another user's view)", async () => {
    deleteMany.mockResolvedValueOnce({ count: 0 });
    const n = await savedViewRepo.delete("view1", "acme", "user1");
    expect(deleteMany.mock.calls[0][0].where).toEqual({ id: "view1", tenantId: "acme", userId: "user1" });
    expect(n).toBe(0);
  });
});
