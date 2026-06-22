import { describe, it, expect } from "vitest";
import {
  ADVERSE_CATEGORIES,
  isAdverseCategory,
  categoryLabel,
  candidateLabel,
  candidateProjection,
} from "./adverse-action";

describe("ADVERSE_CATEGORIES / isAdverseCategory", () => {
  it("is a closed vocabulary", () => {
    expect(ADVERSE_CATEGORIES).toEqual([
      "screening_failed", "experience_gap", "role_filled",
      "stronger_candidates", "not_responsive", "other",
    ]);
    expect(isAdverseCategory("experience_gap")).toBe(true);
    expect(isAdverseCategory("we hired jane")).toBe(false);
    expect(isAdverseCategory(7)).toBe(false);
  });
  it("every category has both a recruiter + candidate label", () => {
    for (const c of ADVERSE_CATEGORIES) {
      expect(categoryLabel(c).length).toBeGreaterThan(0);
      expect(candidateLabel(c).length).toBeGreaterThan(0);
    }
  });
});

describe("candidateProjection — the disclosure boundary", () => {
  it("returns null when not shared (default)", () => {
    expect(candidateProjection({ category: "experience_gap", freeText: "weak on system design" })).toBeNull();
    expect(candidateProjection({ category: "experience_gap", sharedWithCandidate: false, candidateMessage: "hi" })).toBeNull();
  });

  it("uses the curated message when shared", () => {
    const p = candidateProjection({ category: "role_filled", sharedWithCandidate: true, candidateMessage: "  Thanks — the role was filled internally.  " });
    expect(p).toEqual({ category: "role_filled", message: "Thanks — the role was filled internally." });
  });

  it("falls back to a safe generic label when shared with no curated message", () => {
    const p = candidateProjection({ category: "stronger_candidates", sharedWithCandidate: true });
    expect(p?.category).toBe("stronger_candidates");
    expect(p?.message).toBe("We decided to move forward with other candidates for this role.");
  });

  it("NEVER exposes freeText", () => {
    const p = candidateProjection({ category: "experience_gap", sharedWithCandidate: true, freeText: "INTERNAL: failed coding round badly" });
    expect(JSON.stringify(p)).not.toContain("INTERNAL");
    expect(JSON.stringify(p)).not.toContain("coding round");
  });

  it("coerces an unknown stored category to 'other' safely", () => {
    const p = candidateProjection({ category: "weird_legacy_value", sharedWithCandidate: true });
    expect(p?.category).toBe("other");
  });
});
