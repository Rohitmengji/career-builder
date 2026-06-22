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

  it("findForInterviewer scopes by tenant + application + interviewer", async () => {
    findFirst.mockResolvedValueOnce(null);
    await scorecardRepo.findForInterviewer("acme", "app1", "u1");
    expect(findFirst.mock.calls[0][0].where).toEqual({ tenantId: "acme", applicationId: "app1", interviewerId: "u1" });
  });
});
