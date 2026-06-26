/*
 * Unit tests for eeoRepo — the EEO/voluntary self-ID store (Prisma mocked via ./client).
 *
 * WHY: EEO demographic data is legally sensitive and must NEVER be linkable back to an
 * individual candidate (ADR-0013). These tests pin the repo's intentionally narrow API and
 * its anti-linkage projection so a well-meaning refactor can't accidentally expose it.
 *
 * Key behaviors asserted:
 *   - Isolation surface: the repo exposes ONLY record / listForAggregate / deleteForApplications
 *     — there is deliberately no "read one row" method.
 *   - record upserts exactly one row per application (keyed on applicationId).
 *   - listForAggregate is UNLINKABLE: select returns demographic columns only — never id or
 *     applicationId — so aggregates can't be joined back to a person; and it's tenant-scoped.
 *   - deleteForApplications is tenant + applicationId scoped, and no-ops (returns 0, skips the
 *     query) on an empty id list.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const upsert = vi.fn();
const findMany = vi.fn();
const deleteMany = vi.fn();
vi.mock("./client", () => ({
  prisma: {
    eeoSelfId: {
      upsert: (...a: unknown[]) => upsert(...a),
      findMany: (...a: unknown[]) => findMany(...a),
      deleteMany: (...a: unknown[]) => deleteMany(...a),
    },
  },
}));

import { eeoRepo } from "./repositories/eeoRepo";

beforeEach(() => { [upsert, findMany, deleteMany].forEach((f) => f.mockReset()); });

describe("eeoRepo — isolation surface (ADR-0013)", () => {
  it("exposes ONLY record / listForAggregate / deleteForApplications (no individual read)", () => {
    expect(Object.keys(eeoRepo).sort()).toEqual(["deleteForApplications", "listForAggregate", "record"]);
  });

  it("record upserts one row per application", async () => {
    upsert.mockResolvedValueOnce({});
    await eeoRepo.record({ tenantId: "acme", applicationId: "app1", gender: "female", race: null });
    const arg = upsert.mock.calls[0][0];
    expect(arg.where).toEqual({ applicationId: "app1" });
    expect(arg.create).toMatchObject({ tenantId: "acme", applicationId: "app1", gender: "female", race: null });
  });

  it("listForAggregate returns UNLINKABLE rows — demographic columns only, no id/applicationId", async () => {
    findMany.mockResolvedValueOnce([]);
    await eeoRepo.listForAggregate("acme");
    const arg = findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ tenantId: "acme" });
    expect(Object.keys(arg.select).sort()).toEqual(["disability", "ethnicity", "gender", "race", "veteranStatus"]);
    expect(arg.select.id).toBeUndefined();
    expect(arg.select.applicationId).toBeUndefined();
  });

  it("deleteForApplications scopes by tenant + application ids; no-op on empty", async () => {
    expect(await eeoRepo.deleteForApplications("acme", [])).toBe(0);
    expect(deleteMany).not.toHaveBeenCalled();
    deleteMany.mockResolvedValueOnce({ count: 2 });
    await eeoRepo.deleteForApplications("acme", ["a1", "a2"]);
    expect(deleteMany.mock.calls[0][0].where).toEqual({ tenantId: "acme", applicationId: { in: ["a1", "a2"] } });
  });
});
