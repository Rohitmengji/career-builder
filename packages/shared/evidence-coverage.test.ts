/*
 * Tests for shared/evidence-coverage — scorecard evidence-coverage nudge.
 * Pinned: evidence = a substantive comment; extreme (1/5) scores without evidence are
 * flagged; "adequate" needs good coverage AND no unjustified extreme; empty is trivial.
 */

import { describe, it, expect } from "vitest";
import { computeEvidenceCoverage, MIN_EVIDENCE_CHARS } from "./evidence-coverage";

const long = "Failed the SQL exercise: couldn't write a JOIN."; // > MIN_EVIDENCE_CHARS

describe("computeEvidenceCoverage", () => {
  it("counts ratings with a substantive comment as evidenced", () => {
    const c = computeEvidenceCoverage([
      { score: 4, comment: long },
      { score: 3, comment: "ok" }, // too short → not evidence
      { score: 2, comment: null },
    ]);
    expect(c.total).toBe(3);
    expect(c.withEvidence).toBe(1);
    expect(c.missing).toBe(2);
    expect(c.ratio).toBe(0.33);
    expect(c.adequate).toBe(false);
  });

  it("flags EXTREME scores (1/5) given with no evidence", () => {
    const c = computeEvidenceCoverage([
      { score: 5, comment: "" },        // extreme, no evidence
      { score: 1, comment: "bad" },     // extreme, too short
      { score: 5, comment: long },      // extreme, justified
    ]);
    expect(c.extremesMissing).toBe(2);
    expect(c.adequate).toBe(false);
  });

  it("adequate when coverage is good AND no extreme is unjustified", () => {
    const c = computeEvidenceCoverage([
      { score: 5, comment: long },
      { score: 4, comment: long },
      { score: 3, comment: "short" }, // mid score, thin — allowed
    ]);
    expect(c.ratio).toBeCloseTo(0.67, 2);
    expect(c.extremesMissing).toBe(0);
    expect(c.adequate).toBe(true);
  });

  it("empty ratings are trivially adequate (nothing to justify)", () => {
    expect(computeEvidenceCoverage([])).toMatchObject({ total: 0, ratio: 1, adequate: true });
  });

  it("respects the MIN_EVIDENCE_CHARS threshold at the boundary", () => {
    const exactly = "x".repeat(MIN_EVIDENCE_CHARS);
    expect(computeEvidenceCoverage([{ score: 3, comment: exactly }]).withEvidence).toBe(1);
    expect(computeEvidenceCoverage([{ score: 3, comment: exactly.slice(1) }]).withEvidence).toBe(0);
  });
});
