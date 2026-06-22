import { describe, it, expect, vi, beforeEach } from "vitest";

const appFindMany = vi.fn();
const appUpdateMany = vi.fn();
const adverseUpdateMany = vi.fn();
const offerUpdateMany = vi.fn();
const auditCreate = vi.fn();
const $transaction = vi.fn();

vi.mock("./client", () => ({
  prisma: {
    application: {
      findMany: (...a: unknown[]) => appFindMany(...a),
      updateMany: (...a: unknown[]) => appUpdateMany(...a),
    },
    adverseAction: { updateMany: (...a: unknown[]) => adverseUpdateMany(...a) },
    offer: { updateMany: (...a: unknown[]) => offerUpdateMany(...a) },
    auditLog: { create: (...a: unknown[]) => auditCreate(...a) },
    $transaction: (...a: unknown[]) => $transaction(...a),
  },
}));

import { dataRightsRepo } from "./repositories/dataRightsRepo";

beforeEach(() => {
  [appFindMany, appUpdateMany, adverseUpdateMany, offerUpdateMany, auditCreate, $transaction].forEach((f) => f.mockReset());
  // The array-form $transaction just returns the resolved op array; our repo builds
  // the ops with prisma.*.updateMany (the mocks above return promise-like values via
  // the array we hand back), so emulate per-row results directly.
});

const NOW = new Date("2026-06-22T00:00:00Z");

describe("dataRightsRepo.retentionSweepForTenant", () => {
  it("no-ops when both cutoffs are null (retention disabled)", async () => {
    const res = await dataRightsRepo.retentionSweepForTenant("acme", { rejectedBefore: null, hiredBefore: null }, NOW);
    expect(res).toEqual({ anonymized: 0, resumeKeys: [] });
    expect(appFindMany).not.toHaveBeenCalled();
  });

  it("queries terminal, non-held, not-yet-anonymized apps past the cutoffs", async () => {
    appFindMany.mockResolvedValueOnce([]);
    const rb = new Date("2025-06-22T00:00:00Z");
    await dataRightsRepo.retentionSweepForTenant("acme", { rejectedBefore: rb, hiredBefore: null }, NOW);
    const where = appFindMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ tenantId: "acme", anonymizedAt: null, legalHold: false });
    expect(where.OR).toEqual([{ status: "rejected", updatedAt: { lt: rb } }]);
  });

  it("anonymizes only rows whose guarded update applied, returning their résumé keys", async () => {
    const rb = new Date("2025-01-01");
    appFindMany.mockResolvedValueOnce([
      { id: "a1", email: "jane@x.com", resumePath: "resumes/a1.pdf", status: "rejected" },
      { id: "a2", email: "joe@x.com", resumePath: "resumes/a2.pdf", status: "rejected" },
    ]);
    // a1 anonymized (count 1), a2 raced (reopened/held → count 0); then adverse/offer/audit results.
    $transaction.mockResolvedValueOnce([{ count: 1 }, { count: 0 }, { count: 0 }, { count: 0 }, {}]);

    const res = await dataRightsRepo.retentionSweepForTenant("acme", { rejectedBefore: rb, hiredBefore: null }, NOW);

    // per-row guarded updateMany re-checks id+tenant+legalHold+anonymizedAt AND status+age cutoff
    const firstOp = appUpdateMany.mock.calls[0][0];
    expect(firstOp.where).toMatchObject({ id: "a1", tenantId: "acme", legalHold: false, anonymizedAt: null, status: "rejected", updatedAt: { lt: rb } });
    expect(firstOp.data.firstName).toBe("Redacted");
    // only a1 counted; only a1's blob key returned
    expect(res.anonymized).toBe(1);
    expect(res.resumeKeys).toEqual(["resumes/a1.pdf"]);
  });
});
