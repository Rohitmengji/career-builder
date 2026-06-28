/*
 * Tests for shared/search-rank — relevance ranking for tokenized search.
 * Pinned: term normalization/dedup; exact > prefix > substring + field weights;
 * coverage AND-bias (matching more terms ranks higher); non-matches dropped;
 * empty query preserves order; recency + stable tiebreaks; deterministic.
 */
import { describe, it, expect } from "vitest";
import { queryTerms, scoreFields, rankByRelevance, MAX_QUERY_TERMS, type RankField } from "./search-rank";

describe("queryTerms", () => {
  it("lowercases, splits on whitespace, dedups, drops empties", () => {
    expect(queryTerms("  Senior   Engineer senior ")).toEqual(["senior", "engineer"]);
    expect(queryTerms("")).toEqual([]);
  });

  it("caps the term count (bounds scoring cost; aligns with the DB prefilter)", () => {
    const many = Array.from({ length: MAX_QUERY_TERMS + 50 }, (_, i) => `t${i}`).join(" ");
    expect(queryTerms(many)).toHaveLength(MAX_QUERY_TERMS);
  });
});

describe("scoreFields", () => {
  const f = (title: string, desc = ""): RankField[] => [
    { text: title, weight: 5 },
    { text: desc, weight: 1 },
  ];

  it("empty query matches everything (score 1)", () => {
    expect(scoreFields(f("anything"), [])).toBe(1);
  });

  it("returns 0 when no term matches", () => {
    expect(scoreFields(f("Backend Engineer"), ["designer"])).toBe(0);
  });

  it("ranks exact-word above word-prefix above substring, weighted by field", () => {
    const exactWord = scoreFields(f("Engineer"), ["engineer"]);   // exact word in title
    const prefix = scoreFields(f("Engineering"), ["engineer"]);   // word-prefix in title
    const substr = scoreFields(f("Reengineered"), ["engineer"]);  // substring only
    expect(exactWord).toBeGreaterThan(prefix);
    expect(prefix).toBeGreaterThan(substr);
  });

  it("weights a title match above a description-only match", () => {
    const inTitle = scoreFields(f("Go Engineer", "writes code"), ["go"]);
    const inDesc = scoreFields(f("Engineer", "writes Go code"), ["go"]);
    expect(inTitle).toBeGreaterThan(inDesc);
  });

  it("rewards covering more of the query (AND-bias)", () => {
    const both = scoreFields(f("Senior Engineer"), ["senior", "engineer"]);
    const one = scoreFields(f("Senior Designer"), ["senior", "engineer"]);
    expect(both).toBeGreaterThan(one);
  });
});

describe("rankByRelevance", () => {
  interface Row { id: string; title: string; posted: number }
  const fields = (r: Row): RankField[] => [{ text: r.title, weight: 5 }];
  const recency = (r: Row) => r.posted;

  it("sorts by relevance and drops non-matches", () => {
    const rows: Row[] = [
      { id: "a", title: "Backend Engineer", posted: 1 },
      { id: "b", title: "Engineering Manager", posted: 2 }, // prefix
      { id: "c", title: "Product Designer", posted: 3 },    // no match → dropped
    ];
    const out = rankByRelevance(rows, "engineer", fields, recency).map((r) => r.id);
    expect(out).toEqual(["a", "b"]);
  });

  it("breaks score ties by recency (desc)", () => {
    const rows: Row[] = [
      { id: "old", title: "Engineer", posted: 1 },
      { id: "new", title: "Engineer", posted: 9 },
    ];
    expect(rankByRelevance(rows, "engineer", fields, recency).map((r) => r.id)).toEqual(["new", "old"]);
  });

  it("an empty query preserves input order unchanged", () => {
    const rows: Row[] = [
      { id: "x", title: "B", posted: 1 },
      { id: "y", title: "A", posted: 2 },
    ];
    expect(rankByRelevance(rows, "  ", fields, recency).map((r) => r.id)).toEqual(["x", "y"]);
  });

  it("is a stable, pure sort (equal score+recency keeps input order)", () => {
    const rows: Row[] = [
      { id: "1", title: "Engineer", posted: 5 },
      { id: "2", title: "Engineer", posted: 5 },
    ];
    expect(rankByRelevance(rows, "engineer", fields, recency).map((r) => r.id)).toEqual(["1", "2"]);
  });
});
