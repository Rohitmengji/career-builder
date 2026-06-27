/*
 * Tests for shared/portable-record — the candidate's verified cross-tenant footprint.
 * Pinned: counts only; distinct-employer count; "reached interview/offer" are
 * status-or-beyond; output never carries a tenant identity.
 */

import { describe, it, expect } from "vitest";
import { computeFootprint } from "./portable-record";

describe("computeFootprint", () => {
  it("counts distinct employers + status-or-beyond outcomes", () => {
    const f = computeFootprint([
      { tenantId: "a", status: "applied" },
      { tenantId: "a", status: "rejected" },
      { tenantId: "b", status: "interview" },
      { tenantId: "c", status: "offer" },
      { tenantId: "c", status: "hired" },
    ]);
    expect(f.employers).toBe(3); // a, b, c
    expect(f.applications).toBe(5);
    expect(f.reachedInterview).toBe(3); // interview + offer + hired
    expect(f.offers).toBe(2); // offer + hired
    expect(f.hired).toBe(1);
  });

  it("returns all-zero for no applications", () => {
    expect(computeFootprint([])).toEqual({ employers: 0, applications: 0, reachedInterview: 0, offers: 0, hired: 0 });
  });

  it("output carries no tenant identity (counts only)", () => {
    const f = computeFootprint([{ tenantId: "secret-co", status: "hired" }]);
    expect(JSON.stringify(f)).not.toContain("secret-co");
    expect(f).toEqual({ employers: 1, applications: 1, reachedInterview: 1, offers: 1, hired: 1 });
  });
});
