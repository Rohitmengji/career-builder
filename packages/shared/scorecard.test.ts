import { describe, it, expect } from "vitest";
import {
  parseScorecardCriteria,
  clampScore,
  aggregateScorecards,
  candidateFeedbackProjection,
  isRecommendation,
  MAX_CRITERIA,
  MIN_SCORECARDS_FOR_DECISION,
  type ScorecardInput,
} from "./scorecard";

describe("parseScorecardCriteria", () => {
  it("parses a JSON string, trims, and drops blanks", () => {
    expect(parseScorecardCriteria(JSON.stringify(["  Communication ", "", "Problem solving"]))).toEqual([
      "Communication",
      "Problem solving",
    ]);
  });

  it("accepts an array directly", () => {
    expect(parseScorecardCriteria(["Coding", "System design"])).toEqual(["Coding", "System design"]);
  });

  it("drops case-insensitive duplicates, keeping first", () => {
    expect(parseScorecardCriteria(["Coding", "coding", "CODING"])).toEqual(["Coding"]);
  });

  it("caps at MAX_CRITERIA", () => {
    const many = Array.from({ length: MAX_CRITERIA + 5 }, (_, i) => `Criterion ${i}`);
    expect(parseScorecardCriteria(many)).toHaveLength(MAX_CRITERIA);
  });

  it("returns [] for malformed JSON or non-arrays", () => {
    expect(parseScorecardCriteria("{not json")).toEqual([]);
    expect(parseScorecardCriteria(42)).toEqual([]);
    expect(parseScorecardCriteria(null)).toEqual([]);
  });

  it("truncates over-long labels and ignores non-strings", () => {
    const long = "x".repeat(500);
    const [label] = parseScorecardCriteria([long, 5, {}, true]);
    expect(label.length).toBeLessThanOrEqual(120);
  });
});

describe("clampScore", () => {
  it("clamps into [1,5] and rounds", () => {
    expect(clampScore(0)).toBe(1);
    expect(clampScore(9)).toBe(5);
    expect(clampScore(3.4)).toBe(3);
    expect(clampScore(3.6)).toBe(4);
  });
  it("returns null for non-finite", () => {
    expect(clampScore("abc")).toBeNull();
    expect(clampScore(NaN)).toBeNull();
    expect(clampScore(null)).toBeNull();
  });
});

describe("isRecommendation", () => {
  it("validates the enum", () => {
    expect(isRecommendation("strong_yes")).toBe(true);
    expect(isRecommendation("maybe")).toBe(false);
    expect(isRecommendation(1)).toBe(false);
  });
});

describe("aggregateScorecards", () => {
  const criteria = ["Coding", "Communication"];

  it("handles the empty case", () => {
    const agg = aggregateScorecards([], criteria);
    expect(agg.total).toBe(0);
    expect(agg.overallAverage).toBeNull();
    expect(agg.recommendationLean).toBeNull();
    expect(agg.needsMoreFeedback).toBe(true);
    // Rubric criteria still appear, with null averages.
    expect(agg.perCriterion).toEqual([
      { criterion: "Coding", average: null, count: 0 },
      { criterion: "Communication", average: null, count: 0 },
    ]);
  });

  it("averages per criterion only over scorecards that rated it", () => {
    const cards: ScorecardInput[] = [
      {
        interviewerId: "u1",
        recommendation: "yes",
        ratings: [
          { criterion: "Coding", score: 4 },
          { criterion: "Communication", score: 5 },
        ],
      },
      {
        interviewerId: "u2",
        recommendation: "strong_yes",
        ratings: [
          { criterion: "Coding", score: 5 }, // didn't rate Communication
        ],
      },
    ];
    const agg = aggregateScorecards(cards, criteria);
    const coding = agg.perCriterion.find((c) => c.criterion === "Coding")!;
    const comm = agg.perCriterion.find((c) => c.criterion === "Communication")!;
    expect(coding).toEqual({ criterion: "Coding", average: 4.5, count: 2 });
    expect(comm).toEqual({ criterion: "Communication", average: 5, count: 1 });
    // Overall = mean of all individual scores (4,5,5) = 4.7 (rounded).
    expect(agg.overallAverage).toBe(4.7);
  });

  it("counts recommendations and computes a net lean", () => {
    const cards: ScorecardInput[] = [
      { interviewerId: "u1", recommendation: "strong_yes", ratings: [] }, // +2
      { interviewerId: "u2", recommendation: "no", ratings: [] }, // -1
    ];
    const agg = aggregateScorecards(cards, criteria);
    expect(agg.recommendationCounts).toEqual({ strong_yes: 1, yes: 0, no: 1, strong_no: 0 });
    expect(agg.recommendationLean).toBe(0.5); // (2 + -1) / 2
  });

  it("clears needsMoreFeedback at the threshold", () => {
    const card: ScorecardInput = { interviewerId: "u1", recommendation: "yes", ratings: [] };
    expect(aggregateScorecards([card], criteria).needsMoreFeedback).toBe(true);
    const enough = Array.from({ length: MIN_SCORECARDS_FOR_DECISION }, (_, i) => ({
      ...card,
      interviewerId: `u${i}`,
    }));
    expect(aggregateScorecards(enough, criteria).needsMoreFeedback).toBe(false);
  });

  it("appends rated criteria not in the rubric (after a rubric edit) so feedback is never hidden", () => {
    const cards: ScorecardInput[] = [
      { interviewerId: "u1", recommendation: "yes", ratings: [{ criterion: "Legacy skill", score: 3 }] },
    ];
    const agg = aggregateScorecards(cards, criteria);
    const legacy = agg.perCriterion.find((c) => c.criterion === "Legacy skill");
    expect(legacy).toEqual({ criterion: "Legacy skill", average: 3, count: 1 });
  });

  it("ignores out-of-range/garbage scores via clamping", () => {
    const cards: ScorecardInput[] = [
      { interviewerId: "u1", recommendation: "yes", ratings: [{ criterion: "Coding", score: 99 }] },
    ];
    const agg = aggregateScorecards(cards, criteria);
    expect(agg.perCriterion.find((c) => c.criterion === "Coding")!.average).toBe(5);
  });
});

describe("candidateFeedbackProjection — candidate-safe (ADR-0012)", () => {
  const cards = [
    { interviewerId: "u1", recommendation: "yes" as const, ratings: [{ criterion: "Coding", score: 4 }, { criterion: "Communication", score: 5 }] },
    { interviewerId: "u2", recommendation: "strong_no" as const, ratings: [{ criterion: "Coding", score: 2, comment: "SECRET internal comment" }] },
  ];
  const agg = aggregateScorecards(cards, ["Coding", "Communication"]);
  const fb = candidateFeedbackProjection(agg);

  it("returns per-criterion averages + overall + interviewer count", () => {
    expect(fb.interviewerCount).toBe(2);
    expect(fb.criteria).toContainEqual({ criterion: "Coding", average: 3 });
    expect(fb.criteria).toContainEqual({ criterion: "Communication", average: 5 });
    expect(fb.overallAverage).not.toBeNull();
  });

  it("NEVER leaks interviewer identity, recommendation labels, or comments", () => {
    const s = JSON.stringify(fb);
    expect(s).not.toContain("u1");
    expect(s).not.toContain("u2");
    expect(s).not.toContain("strong_no");
    expect(s).not.toContain("recommendation");
    expect(s).not.toContain("SECRET internal comment");
  });

  it("omits criteria nobody rated", () => {
    const empty = candidateFeedbackProjection(aggregateScorecards([], ["Coding"]));
    expect(empty.criteria).toEqual([]);
    expect(empty.overallAverage).toBeNull();
  });
});
