/*
 * Tests for shared/application-status — candidate withdrawal eligibility.
 * Pinned: in-play pre-offer statuses are withdrawable; offer + terminal states are not.
 */
import { describe, it, expect } from "vitest";
import { isWithdrawable, isRecruiterLocked, WITHDRAWABLE_STATUSES } from "./application-status";

describe("isWithdrawable", () => {
  it("allows withdrawal while in play and pre-offer", () => {
    expect(isWithdrawable("applied")).toBe(true);
    expect(isWithdrawable("screening")).toBe(true);
    expect(isWithdrawable("interview")).toBe(true);
  });

  it("forbids withdrawal once an offer is out or the application is terminal", () => {
    for (const s of ["offer", "hired", "rejected", "withdrawn", "unknown"]) {
      expect(isWithdrawable(s)).toBe(false);
    }
  });

  it("WITHDRAWABLE_STATUSES excludes offer + all terminal states", () => {
    expect(WITHDRAWABLE_STATUSES).not.toContain("offer");
    expect(WITHDRAWABLE_STATUSES).not.toContain("hired");
    expect(WITHDRAWABLE_STATUSES).not.toContain("rejected");
  });
});

describe("isRecruiterLocked", () => {
  it("locks the candidate-owned withdrawn status from recruiter status changes", () => {
    expect(isRecruiterLocked("withdrawn")).toBe(true);
  });
  it("leaves all other statuses recruiter-editable (incl. hired/rejected, unchanged)", () => {
    for (const s of ["applied", "screening", "interview", "offer", "hired", "rejected"]) {
      expect(isRecruiterLocked(s)).toBe(false);
    }
  });
});
