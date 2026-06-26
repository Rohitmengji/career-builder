/*
 * Unit tests for computeEeoAggregate (./eeo-aggregate) — k-anonymity suppression
 * of EEO self-ID demographics for aggregate reporting (ADR-0013).
 *
 * WHY: EEO demographics exist ONLY for aggregate reporting and must never be
 * re-identifiable. This module enforces small-cell suppression (hide any value
 * with < EEO_MIN_CELL respondents) PLUS complementary/secondary suppression so a
 * hidden cell can't be recovered from `total − shown`. Because these are privacy
 * guards, the tests double as the spec for the suppression algorithm.
 *
 * Key behaviors asserted:
 *  - the whole dimension is hidden when respondents < minCell;
 *  - a legit >= minCell cell is shown only when the residual hidden mass is
 *    itself >= minCell (no over-suppression, but no derivable leak either);
 *  - no raw sub-threshold count is ever returned;
 *  - complementary suppression never leaves exactly one cell hidden (it would be
 *    derivable), and keeps hiding until the hidden residual >= minCell — even
 *    when that means hiding an otherwise-showable cell;
 *  - `suppressed` is a BOOLEAN, never the hidden-cell count (so an attacker can't
 *    reconstruct a unique 1+1+...+1 partition);
 *  - each dimension aggregates independently, blank/null answers are ignored,
 *    and a dimension nobody answered is marked unavailable.
 */
import { describe, it, expect } from "vitest";
import { computeEeoAggregate, EEO_MIN_CELL, type EeoRow } from "./eeo-aggregate";

function rows(spec: Record<string, number>): EeoRow[] {
  const out: EeoRow[] = [];
  for (const [gender, n] of Object.entries(spec)) for (let i = 0; i < n; i++) out.push({ gender });
  return out;
}

describe("computeEeoAggregate — small-cell suppression", () => {
  it("hides the whole dimension when respondents < minCell", () => {
    const agg = computeEeoAggregate(rows({ female: 2, male: 2 }));
    expect(agg.dimensions.gender.available).toBe(false);
    expect(agg.dimensions.gender.cells).toEqual([]);
  });

  it("shows cells >= minCell when the hidden mass is itself >= minCell (no extra suppression of a legit cell)", () => {
    // nonbinary 3 + other 3 = 6 hidden mass (>= minCell), so the residual guard does
    // not force hiding the legit decline_to_state:6 cell.
    const agg = computeEeoAggregate(rows({ female: 10, male: 8, nonbinary: 3, other: 3, decline_to_state: 6 }));
    const g = agg.dimensions.gender;
    expect(g.available).toBe(true);
    expect(g.total).toBe(30);
    const shownValues = g.cells.map((c) => c.value);
    expect(shownValues).toContain("female");
    expect(shownValues).toContain("male");
    expect(shownValues).toContain("decline_to_state"); // 6 stays — hidden mass 6 >= minCell
    expect(shownValues).not.toContain("nonbinary"); // 3 < 5
    expect(shownValues).not.toContain("other"); // 3 < 5
    expect(g.suppressed).toBe(true); // boolean, never the exact hidden-cell count
  });

  it("never returns a raw sub-threshold count", () => {
    const agg = computeEeoAggregate(rows({ female: 10, male: 8, nonbinary: 3, other: 3, decline_to_state: 6 }));
    for (const c of agg.dimensions.gender.cells) expect(c.count).toBeGreaterThanOrEqual(EEO_MIN_CELL);
  });
});

describe("complementary (secondary) suppression", () => {
  it("never leaves exactly one cell hidden (it would be derivable from the total)", () => {
    // female 20, male 18, nonbinary 3 → primary hides nonbinary (1 hidden, derivable as 41-38).
    // Complementary suppression hides a second cell; hidden mass becomes >= minCell.
    const agg = computeEeoAggregate(rows({ female: 20, male: 18, nonbinary: 3 }));
    const g = agg.dimensions.gender;
    expect(g.suppressed).toBe(true);
    expect(g.cells).toHaveLength(1); // one of the big cells also hidden to protect nonbinary
    expect(g.total).toBe(41);
  });

  it("shows all cells when none are below threshold (no suppression)", () => {
    const agg = computeEeoAggregate(rows({ female: 20, male: 18 }));
    expect(agg.dimensions.gender.suppressed).toBe(false);
    expect(agg.dimensions.gender.cells).toHaveLength(2);
  });

  it("does NOT leave a small residual hidden mass that forces a unique partition", () => {
    // {a:1, b:1, c:5}: naive suppression would show c:5 with hidden mass 2 over 2 cells
    // → forced 1+1, revealing both sub-threshold cells. Must keep hiding until the
    // residual is >= minCell (here: hide c too).
    const r = computeEeoAggregate(rows({ a: 1, b: 1, c: 5 })).dimensions.gender;
    expect(r.suppressed).toBe(true);
    expect(r.cells).toEqual([]); // c:5 also hidden — no sub-threshold cell derivable
    expect(r.total).toBe(7); // residual hidden mass is the whole total (>= minCell)
  });

  it("many forced-singleton cells summing to exactly minCell are not derivable (count hidden)", () => {
    // {a:1,b:1,c:1,d:1,e:1, f:20}: hidden mass 5 == minCell, 5 cells. Because `suppressed`
    // is a boolean (not the count), the attacker can't force 1+1+1+1+1.
    const r = computeEeoAggregate([
      ...["a", "b", "c", "d", "e"].map((g) => ({ gender: g })),
      ...Array.from({ length: 20 }, () => ({ gender: "f" })),
    ]).dimensions.gender;
    expect(r.suppressed).toBe(true);
    expect(typeof r.suppressed).toBe("boolean");
    expect(r.cells.map((c) => c.value)).toEqual(["f"]);
  });
});

describe("multi-dimension + empty", () => {
  it("aggregates each dimension independently and ignores blanks", () => {
    const data: EeoRow[] = [
      ...Array.from({ length: 6 }, () => ({ gender: "female", race: "asian" })),
      ...Array.from({ length: 6 }, () => ({ gender: "male", race: null })),
    ];
    const agg = computeEeoAggregate(data);
    expect(agg.respondents).toBe(12);
    expect(agg.dimensions.gender.total).toBe(12);
    expect(agg.dimensions.race.total).toBe(6); // only 6 answered race
    expect(agg.dimensions.disability.available).toBe(false); // nobody answered
  });
});
