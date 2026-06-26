/*
 * Unit tests for stageRepo — the configurable hiring-pipeline stages (Prisma mocked via ./client).
 *
 * WHY: Stages drive how applications move through the funnel, so every read/write must stay
 * tenant-scoped, and ordering must be mutated atomically. These tests pin both.
 *
 * Key behaviors asserted:
 *   - listForTenant targets the tenant's DEFAULT pipeline (jobId: null), ordered by `order`,
 *     with an optional isActive filter.
 *   - findByIdScoped / update / countActiveByKind are all scoped by tenant (and id where
 *     relevant) — never global.
 *   - create derives isTerminal from `kind` (a "rejected" stage is terminal, "in_process" is
 *     not) and defaults to the tenant pipeline (jobId: null).
 *   - reorder writes every id's new order inside a single $transaction, each updateMany
 *     scoped by id + tenant.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const findMany = vi.fn();
const findFirst = vi.fn();
const create = vi.fn();
const updateMany = vi.fn();
const count = vi.fn();
const $transaction = vi.fn();
vi.mock("./client", () => ({
  prisma: {
    pipelineStage: {
      findMany: (...a: unknown[]) => findMany(...a),
      findFirst: (...a: unknown[]) => findFirst(...a),
      create: (...a: unknown[]) => create(...a),
      updateMany: (...a: unknown[]) => updateMany(...a),
      count: (...a: unknown[]) => count(...a),
    },
    $transaction: (...a: unknown[]) => $transaction(...a),
  },
}));

import { stageRepo } from "./repositories/stageRepo";

beforeEach(() => { [findMany, findFirst, create, updateMany, count, $transaction].forEach((f) => f.mockReset()); });

describe("stageRepo — tenant scoping", () => {
  it("listForTenant scopes to tenant + the default pipeline (jobId null), ordered", async () => {
    findMany.mockResolvedValueOnce([]);
    await stageRepo.listForTenant("acme");
    expect(findMany.mock.calls[0][0].where).toEqual({ tenantId: "acme", jobId: null });
    expect(findMany.mock.calls[0][0].orderBy).toEqual({ order: "asc" });
  });

  it("listForTenant activeOnly filters isActive", async () => {
    findMany.mockResolvedValueOnce([]);
    await stageRepo.listForTenant("acme", true);
    expect(findMany.mock.calls[0][0].where).toEqual({ tenantId: "acme", jobId: null, isActive: true });
  });

  it("findByIdScoped scopes by id + tenant", async () => {
    findFirst.mockResolvedValueOnce(null);
    await stageRepo.findByIdScoped("st1", "acme");
    expect(findFirst.mock.calls[0][0].where).toEqual({ id: "st1", tenantId: "acme" });
  });

  it("create defaults isTerminal from kind + sets tenant-default (jobId null)", async () => {
    create.mockResolvedValueOnce({});
    await stageRepo.create({ tenantId: "acme", key: "take_home", label: "Take-home", kind: "in_process", order: 2 });
    expect(create.mock.calls[0][0].data).toMatchObject({ tenantId: "acme", jobId: null, key: "take_home", kind: "in_process", isTerminal: false, isActive: true });

    create.mockResolvedValueOnce({});
    await stageRepo.create({ tenantId: "acme", key: "archived", label: "Archived", kind: "rejected" });
    expect(create.mock.calls[1][0].data.isTerminal).toBe(true);
  });

  it("update + countActiveByKind are tenant-scoped", async () => {
    updateMany.mockResolvedValueOnce({ count: 1 });
    await stageRepo.update("st1", "acme", { label: "Renamed" });
    expect(updateMany.mock.calls[0][0].where).toEqual({ id: "st1", tenantId: "acme" });

    count.mockResolvedValueOnce(2);
    await stageRepo.countActiveByKind("acme", "offer");
    expect(count.mock.calls[0][0].where).toEqual({ tenantId: "acme", jobId: null, kind: "offer", isActive: true });
  });

  it("reorder updates each id's order, tenant-scoped, in a transaction", async () => {
    $transaction.mockResolvedValueOnce([]);
    updateMany.mockReturnValue({});
    await stageRepo.reorder("acme", ["a", "b", "c"]);
    expect($transaction).toHaveBeenCalledTimes(1);
    // each updateMany scoped by id + tenant
    expect(updateMany.mock.calls.every((c) => c[0].where.tenantId === "acme")).toBe(true);
  });
});
