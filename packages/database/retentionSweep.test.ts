/*
 * Unit tests for dataRightsRepo.retentionSweepForTenant — the scheduled data-retention sweep
 * that anonymizes stale terminal applications (Prisma mocked via ./client; ADR-0011).
 *
 * WHY: Retention is per-tenant and policy-driven; the sweep must touch only rows that are
 * genuinely past their cutoff, never under legal hold, and must be race-safe against a row
 * being reopened/held between the candidate query and the write. These tests pin all three.
 *
 * Key behaviors asserted:
 *   - No-op when retention is disabled (both cutoffs null): returns zero work, never queries.
 *   - The candidate query selects terminal, non-held, not-yet-anonymized rows past the cutoff
 *     (rejectedBefore / hiredBefore become an OR of status+age conditions), tenant-scoped.
 *   - Each row's anonymizing updateMany RE-CHECKS the full guard in its WHERE (id+tenant+
 *     legalHold:false+anonymizedAt:null AND status+age). So a row that raced (got reopened or
 *     held) matches 0 and is skipped — only rows whose guarded update actually applied are
 *     counted, and only their résumé blob keys are returned (for the caller to delete from
 *     object storage).
 *
 * NOTE: here $transaction is mocked in its ARRAY form — it resolves to the array of per-op
 * results ([{count}, ...]) the repo's batched ops produce. (The callback form is exercised in
 * dataRights.test.ts.)
 */
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
    eeoSelfId: { deleteMany: vi.fn() },
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
