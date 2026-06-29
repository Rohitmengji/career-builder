/*
 * @career-builder/shared/search-rank — relevance ranking for tokenized text search (ADR-0024).
 *
 * WHAT: ranks a candidate set of rows (already narrowed by a tenant-scoped DB prefilter)
 *   by how well each matches the query, so the most relevant result is FIRST instead of
 *   in raw date order. Tokenized + multi-term: exact > exact-word > word-prefix > substring,
 *   weighted per field, with an AND-bias that rewards matching more of the query's terms.
 * WHY: the DB `LIKE '%q%'` prefilter can only find rows containing the literal query and
 *   orders by postedAt; it has no notion of relevance and misses scattered multi-word
 *   matches. This is the single source of relevance-ranking truth (the public job search
 *   and any future candidate search both rank through it).
 * HOW: pure + deterministic — no DB, no I/O, no global state. The caller supplies a
 *   `toFields` projection so this stays decoupled from any concrete row type.
 */

export interface RankField {
  text: string;
  /** Relative importance of this field (e.g. title 5 > description 1). */
  weight: number;
}

/**
 * Max distinct query terms considered. Bounds scoring cost (O(rows×fields×terms) is
 * synchronous) so a pathologically long query can't pin the event loop, and keeps the
 * ranker aligned with the DB prefilter's term cap. MUST match the cap in
 * jobRepo.searchAllForRanking so the candidate set is a superset of what the engine scores.
 */
export const MAX_QUERY_TERMS = 16;

/** Split a query into normalized, de-duplicated, lowercased terms (capped). */
export function queryTerms(query: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of query.toLowerCase().split(/\s+/)) {
    const t = raw.trim();
    if (t && !seen.has(t)) {
      seen.add(t);
      out.push(t);
      if (out.length >= MAX_QUERY_TERMS) break;
    }
  }
  return out;
}

/** Word tokens of a field, lowercased (split on any non-alphanumeric run). */
function fieldWords(lowerText: string): string[] {
  return lowerText.split(/[^a-z0-9]+/i).filter(Boolean);
}

/**
 * Score one set of weighted fields against pre-tokenized query terms.
 * Returns 0 when nothing matches; 1 for an empty query (everything matches equally).
 * Per term, the strongest match across fields wins (exact 4× > exact-word 3× >
 * word-prefix 2× > substring 1×, scaled by field weight); the total is then scaled by
 * term coverage so a row matching more of the query ranks above one matching less.
 */
export function scoreFields(fields: RankField[], terms: string[]): number {
  if (terms.length === 0) return 1;
  let score = 0;
  let matchedTerms = 0;
  for (const term of terms) {
    let termScore = 0;
    for (const { text, weight } of fields) {
      if (!text) continue;
      const lower = text.toLowerCase();
      if (!lower.includes(term)) continue; // cheap reject before word work
      const words = fieldWords(lower);
      let factor: number;
      if (lower === term) factor = 4; // whole field is exactly the term
      else if (words.includes(term)) factor = 3; // exact word
      else if (words.some((w) => w.startsWith(term))) factor = 2; // word-prefix
      else factor = 1; // substring only
      termScore = Math.max(termScore, weight * factor);
    }
    if (termScore > 0) matchedTerms += 1;
    score += termScore;
  }
  if (matchedTerms === 0) return 0;
  const coverage = matchedTerms / terms.length;
  return score * (0.5 + 0.5 * coverage);
}

/**
 * Rank items by relevance to the query: drop non-matches, sort by score desc, then by
 * an optional recency key (desc), then by original input order (stable). An empty query
 * preserves the input order unchanged (the caller's DB ordering wins).
 */
export function rankByRelevance<T>(
  items: T[],
  query: string,
  toFields: (item: T) => RankField[],
  toRecency?: (item: T) => number,
): T[] {
  const terms = queryTerms(query);
  if (terms.length === 0) return items.slice();
  const scored = items
    .map((item, i) => ({ item, i, score: scoreFields(toFields(item), terms) }))
    .filter((s) => s.score > 0);
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (toRecency) {
      const r = toRecency(b.item) - toRecency(a.item);
      if (r !== 0) return r;
    }
    return a.i - b.i;
  });
  return scored.map((s) => s.item);
}
