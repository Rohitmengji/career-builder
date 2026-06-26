/*
 * Saved-view filter helpers (ADR-0016, B2b) — pure, no DB.
 *
 * WHAT: the whitelist of filter keys a saved view may persist, plus a sanitizer
 *   that strips a raw object down to exactly that shape.
 * WHY: a SavedView.filters is stored as JSON and later replayed against the
 *   applications list endpoint. If we persisted whatever the client sent, a view
 *   could smuggle arbitrary keys into the query layer. This module is the single
 *   chokepoint that defines what a view is ALLOWED to contain.
 * HOW: pickViewFilters() returns a new object containing only known keys, with
 *   types coerced/validated (strings trimmed + length-capped, tags reduced to a
 *   bounded array of non-empty strings). It NEVER trusts extra keys. The route's
 *   zod schema validates first; this is the defense-in-depth normalizer that also
 *   runs on read so legacy/edited rows can't widen the shape.
 */

/** The only filter keys a saved view may carry. */
export const SAVED_VIEW_FILTER_KEYS = ["status", "jobId", "department", "q", "tags"] as const;

export interface ViewFilters {
  status?: string;
  jobId?: string;
  department?: string;
  q?: string;
  tags?: string[];
}

const MAX_STR = 200;
const MAX_TAGS = 50;

function cleanStr(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  if (!t) return undefined;
  return t.slice(0, MAX_STR);
}

/**
 * Reduce an arbitrary object to a clean ViewFilters with ONLY whitelisted keys.
 * Unknown keys are dropped; bad types become undefined; tags is bounded.
 */
export function pickViewFilters(raw: unknown): ViewFilters {
  const out: ViewFilters = {};
  if (!raw || typeof raw !== "object") return out;
  const r = raw as Record<string, unknown>;

  const status = cleanStr(r.status);
  if (status) out.status = status;
  const jobId = cleanStr(r.jobId);
  if (jobId) out.jobId = jobId;
  const department = cleanStr(r.department);
  if (department) out.department = department;
  const q = cleanStr(r.q);
  if (q) out.q = q;

  if (Array.isArray(r.tags)) {
    const tags = r.tags
      .filter((t): t is string => typeof t === "string")
      .map((t) => t.trim())
      .filter((t) => t.length > 0 && t.length <= MAX_STR)
      .slice(0, MAX_TAGS);
    if (tags.length) out.tags = Array.from(new Set(tags));
  }

  return out;
}

/** Parse a stored filters JSON string back into a clean ViewFilters (safe on garbage). */
export function parseViewFilters(json: string | null | undefined): ViewFilters {
  if (!json) return {};
  try {
    return pickViewFilters(JSON.parse(json));
  } catch {
    return {};
  }
}

/** Serialize filters for storage (always the cleaned shape). */
export function serializeViewFilters(raw: unknown): string {
  return JSON.stringify(pickViewFilters(raw));
}
