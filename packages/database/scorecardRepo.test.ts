/*
 * Unit (contract) tests for scorecardRepo — interview scorecards. Prisma is
 * mocked (./client), so these assert the query shape the repo builds, not DB
 * behavior.
 *
 * WHY: scorecards are uniquely keyed per (tenant, application, interviewer), and
 * submit() must be atomic (ratings are replaced wholesale, not merged).
 *
 * Key behaviors pinned:
 *   - submit() upserts on the compound unique key
 *     tenantId_applicationId_interviewerId; create path carries tenantId, update
 *     path swaps ratings via { deleteMany: {}, create: [...] } (full replace).
 *   - submit() runs inside prisma.$transaction (the mock proxies the tx back to
 *     the same upsert spy so we can inspect the call).
 *   - tenant isolation: listForApplication / findForInterviewer always include
 *     tenantId in `where` (no RLS — app code enforces it).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const upsert = vi.fn();
const findMany = vi.fn();
const findFirst = vi.fn();
// $transaction just runs the callback with a tx that proxies to the same mocks.
const $transaction = vi.fn(async (cb: (tx: unknown) => unknown) =>
  cb({ scorecard: { upsert: (...a: unknown[]) => upsert(...a) } }),
);
vi.mock("./client", () => ({
  prisma: {
    scorecard: {
      upsert: (...a: unknown[]) => upsert(...a),
      findMany: (...a: unknown[]) => findMany(...a),
      findFirst: (...a: unknown[]) => findFirst(...a),
    },
    $transaction: (...a: unknown[]) => $transaction(...(a as [(tx: unknown) => unknown])),
  },
}));

import { scorecardRepo } from "./repositories/scorecardRepo";

beforeEach(() => {
  [upsert, findMany, findFirst, $transaction].forEach((f) => f.mockReset());
  $transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
    cb({ scorecard: { upsert: (...a: unknown[]) => upsert(...a) } }),
  );
});

describe("scorecardRepo.submit", () => {
  it("upserts on the tenant+application+interviewer compound key and replaces ratings", async () => {
    upsert.mockResolvedValueOnce({ id: "sc1" });
    await scorecardRepo.submit({
      tenantId: "acme",
      applicationId: "app1",
      interviewerId: "u1",
      recommendation: "yes",
      overallNotes: "solid",
      ratings: [{ criterion: "Coding", score: 4 }],
    });
    const arg = upsert.mock.calls[0][0];
    expect(arg.where).toEqual({
      tenantId_applicationId_interviewerId: { tenantId: "acme", applicationId: "app1", interviewerId: "u1" },
    });
    // create path carries tenantId; update path swaps ratings (deleteMany + create).
    expect(arg.create).toMatchObject({ tenantId: "acme", applicationId: "app1", interviewerId: "u1" });
    expect(arg.update.ratings).toEqual({ deleteMany: {}, create: [{ criterion: "Coding", score: 4, comment: null }] });
  });

  it("runs inside a transaction", async () => {
    upsert.mockResolvedValueOnce({ id: "sc1" });
    await scorecardRepo.submit({
      tenantId: "acme",
      applicationId: "app1",
      interviewerId: "u1",
      recommendation: "no",
      ratings: [],
    });
    expect($transaction).toHaveBeenCalledTimes(1);
  });
});

describe("scorecardRepo — tenant scoping", () => {
  it("listForApplication scopes by tenant + application", async () => {
    findMany.mockResolvedValueOnce([]);
    await scorecardRepo.listForApplication("acme", "app1");
    expect(findMany.mock.calls[0][0].where).toEqual({ tenantId: "acme", applicationId: "app1" });
  });

  it("getCalibrationRows is tenant-scoped + ordered + maps score = mean(ratings)", async () => {
    findMany.mockResolvedValueOnce([
      { applicationId: "a1", interviewerId: "u1", interviewer: { name: "Ann" }, ratings: [{ score: 4 }, { score: 2 }] },
      { applicationId: "a1", interviewerId: "u2", interviewer: { name: "Bo" }, ratings: [] }, // no ratings → skipped
    ]);
    const rows = await scorecardRepo.getCalibrationRows("acme");
    const call = findMany.mock.calls[0][0];
    expect(call.where).toEqual({ tenantId: "acme" });
    expect(call.orderBy).toEqual([{ applicationId: "asc" }, { interviewerId: "asc" }]);
    expect(rows).toEqual([{ interviewerId: "u1", interviewerName: "Ann", applicationId: "a1", score: 3 }]);
  });

  it("getCalibrationRows drops the trailing (possibly partial) application group when truncated", async () => {
    // cap+1 rows returned → truncated; the last applicationId's rows must be dropped
    // so a half-included panel never corrupts the per-application mean.
    const many = [
      { applicationId: "a1", interviewerId: "u1", interviewer: { name: "A" }, ratings: [{ score: 5 }] },
      { applicationId: "a2", interviewerId: "u2", interviewer: { name: "B" }, ratings: [{ score: 3 }] },
    ];
    findMany.mockResolvedValueOnce(many);
    const rows = await scorecardRepo.getCalibrationRows("acme", 1); // cap=1 → fetch 2 → truncated
    // a2 is the trailing group → dropped; only a1 survives
    expect(rows.map((r) => r.applicationId)).toEqual(["a1"]);
  });

  it("findForInterviewer scopes by tenant + application + interviewer", async () => {
    findFirst.mockResolvedValueOnce(null);
    await scorecardRepo.findForInterviewer("acme", "app1", "u1");
    expect(findFirst.mock.calls[0][0].where).toEqual({ tenantId: "acme", applicationId: "app1", interviewerId: "u1" });
  });
});
