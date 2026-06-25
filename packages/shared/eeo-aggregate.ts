/*
 * @career-builder/shared/eeo-aggregate — pure, suppressed EEO aggregation (ADR-0013).
 *
 * EEO self-ID demographics are toxic to the hiring path; they exist ONLY for
 * aggregate reporting. This module mirrors the salary-benchmark k-anonymity
 * precedent: it returns per-dimension counts with BOTH small-cell suppression
 * (hide any value with < minCell respondents) AND complementary/secondary
 * suppression (never leave exactly one cell hidden, since total − shown would
 * reveal it). Never returns a raw sub-threshold count. Pure + unit-testable.
 */

/** Minimum respondents in a cell before it may be shown (brief: k=5). */
export const EEO_MIN_CELL = 5;

export interface EeoRow {
  gender?: string | null;
  race?: string | null;
  ethnicity?: string | null;
  veteranStatus?: string | null;
  disability?: string | null;
}

export const EEO_DIMENSIONS = ["gender", "race", "ethnicity", "veteranStatus", "disability"] as const;
export type EeoDimensionKey = (typeof EEO_DIMENSIONS)[number];

export interface EeoDimension {
  /** True only when total respondents for this dimension >= minCell. */
  available: boolean;
  /** Total respondents who answered this dimension (>= minCell when available). */
  total: number;
  /** Shown cells (suppressed values omitted). */
  cells: { value: string; count: number }[];
  /**
   * Whether ANY value was hidden. Deliberately a boolean, NOT a count — exposing
   * the exact number of hidden cells, together with `total`, would let an attacker
   * bound the partition of the hidden mass and force sub-threshold counts.
   */
  suppressed: boolean;
}

export interface EeoAggregate {
  respondents: number;
  dimensions: Record<EeoDimensionKey, EeoDimension>;
}

function aggregateDimension(values: string[], minCell: number): EeoDimension {
  const total = values.length;
  if (total < minCell) {
    // Too few respondents to reveal anything (not even the breakdown).
    return { available: false, total: 0, cells: [], suppressed: false };
  }

  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);

  // Sort ascending by count so complementary suppression hides the smallest first.
  const sorted = [...counts.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => a.count - b.count);

  let shown = sorted.filter((c) => c.count >= minCell);
  let suppressedCount = sorted.length - shown.length;
  const hiddenMass = () => total - shown.reduce((s, c) => s + c.count, 0);

  // Suppress more of the SHOWN cells while EITHER:
  //  (a) exactly one cell is hidden — recoverable as total − shown; OR
  //  (b) the hidden mass is a small positive residual (< minCell) — a tiny mass can
  //      be forced into a unique partition (e.g. mass 2 over 2 cells = 1+1), leaking
  //      sub-threshold counts. Keep hiding until the hidden mass is 0 or >= minCell.
  // (When `shown` empties, hiddenMass === total >= minCell, so the loop terminates.)
  while (shown.length > 0 && (suppressedCount === 1 || (hiddenMass() > 0 && hiddenMass() < minCell))) {
    shown.shift(); // remove smallest shown → now hidden
    suppressedCount += 1;
  }

  return {
    available: true,
    total,
    cells: [...shown].sort((a, b) => b.count - a.count), // present largest-first
    suppressed: suppressedCount > 0,
  };
}

export function computeEeoAggregate(rows: EeoRow[], opts: { minCell?: number } = {}): EeoAggregate {
  const minCell = opts.minCell ?? EEO_MIN_CELL;
  const dims = {} as Record<EeoDimensionKey, EeoDimension>;
  for (const dim of EEO_DIMENSIONS) {
    const values = rows.map((r) => r[dim]).filter((v): v is string => typeof v === "string" && v.length > 0);
    dims[dim] = aggregateDimension(values, minCell);
  }
  return { respondents: rows.length, dimensions: dims };
}
