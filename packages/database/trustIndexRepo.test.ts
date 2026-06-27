/*
 * Unit (contract) tests for trustIndexRepo (ADR-0029) — the 2nd deliberate cross-tenant
 * aggregate. Prisma is mocked. Pinned invariants (this is the highest-risk surface):
 *   - EXCLUDES the viewing tenant from the market (tenantId: { not }).
 *   - "responded" uses the passed CLOSED allow-list (status: { in: respondedStatuses }),
 *     not an open "!= applied" rule → parity with the per-tenant badge.
 *   - applies the SAME min-settled floor; returns ONLY anonymized rates (no tenantId).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const groupBy = vi.fn();
const count = vi.fn();
vi.mock("./client", () => ({ prisma: { application: { groupBy: (...a: unknown[]) => groupBy(...a), count: (...a: unknown[]) => count(...a) } } }));

import { trustIndexRepo } from "./repositories/trustIndexRepo";

beforeEach(() => { groupBy.mockReset(); count.mockReset(); });

const OPTS = { excludeTenantId: "me", cutoff: new Date("2026-01-01T00:00:00Z"), minSettled: 10, respondedStatuses: ["screening", "interview", "offer", "hired", "rejected"] };

describe("trustIndexRepo.getMarketResponsivenessRates", () => {
  it("excludes the viewer + uses the closed responded allow-list; returns anonymized rates", async () => {
    // responded-by-tenant, then ghost-by-tenant (Promise.all order)
    groupBy
      .mockResolvedValueOnce([{ tenantId: "t1", _count: { _all: 8 } }, { tenantId: "t2", _count: { _all: 9 } }])
      .mockResolvedValueOnce([{ tenantId: "t1", _count: { _all: 2 } }, { tenantId: "t2", _count: { _all: 1 } }]);

    const rates = await trustIndexRepo.getMarketResponsivenessRates(OPTS);

    // t1: 8 responded / (8+2)=10 settled → 80 ; t2: 9 / 10 → 90
    expect(rates.sort((a, b) => a - b)).toEqual([80, 90]);

    const respondedWhere = groupBy.mock.calls[0][0].where;
    expect(respondedWhere.tenantId).toEqual({ not: "me" });
    expect(respondedWhere.status).toEqual({ in: OPTS.respondedStatuses }); // closed allow-list, not "!= applied"
    const ghostWhere = groupBy.mock.calls[1][0].where;
    expect(ghostWhere).toMatchObject({ tenantId: { not: "me" }, status: "applied", submittedAt: { lt: OPTS.cutoff } });
    // never returns a tenantId
    expect(rates.every((r) => typeof r === "number")).toBe(true);
  });

  it("drops tenants below the min-settled floor (no thin, gameable sample)", async () => {
    groupBy
      .mockResolvedValueOnce([{ tenantId: "t1", _count: { _all: 3 } }]) // responded 3
      .mockResolvedValueOnce([{ tenantId: "t1", _count: { _all: 2 } }]); // ghost 2 → settled 5 < 10
    expect(await trustIndexRepo.getMarketResponsivenessRates(OPTS)).toEqual([]);
  });

  it("handles a tenant with responses but no ghosts (settled from responded alone)", async () => {
    groupBy
      .mockResolvedValueOnce([{ tenantId: "t1", _count: { _all: 12 } }])
      .mockResolvedValueOnce([]); // no ghosts
    expect(await trustIndexRepo.getMarketResponsivenessRates(OPTS)).toEqual([100]); // 12/12
  });
});

describe("trustIndexRepo.getTenantResponsivenessRate (own, all-time — apples-to-apples with the market)", () => {
  it("computes the viewer's rate via the SAME all-time count definition (no row cap)", async () => {
    count.mockResolvedValueOnce(8).mockResolvedValueOnce(2); // responded 8, ghosted 2 → 80%
    const own = await trustIndexRepo.getTenantResponsivenessRate("me", { cutoff: OPTS.cutoff, minSettled: 10, respondedStatuses: OPTS.respondedStatuses });
    expect(own).toEqual({ available: true, responseRate: 80, sampleSize: 10 });
    // responded count uses the closed allow-list + tenant scope (not "!= applied")
    expect(count.mock.calls[0][0].where).toEqual({ tenantId: "me", status: { in: OPTS.respondedStatuses } });
    expect(count.mock.calls[1][0].where).toMatchObject({ tenantId: "me", status: "applied" });
  });

  it("suppresses below the min-settled floor", async () => {
    count.mockResolvedValueOnce(3).mockResolvedValueOnce(2); // settled 5 < 10
    const own = await trustIndexRepo.getTenantResponsivenessRate("me", { cutoff: OPTS.cutoff, minSettled: 10, respondedStatuses: OPTS.respondedStatuses });
    expect(own.available).toBe(false);
  });
});
