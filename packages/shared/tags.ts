/*
 * Application tag helpers (ADR-0016, B2b) — pure, no DB.
 *
 * WHAT: the closed colour palette for application tags + small validators.
 * WHY: a tag's colour is rendered into the recruiter UI as a CSS class. If we let
 *   it be free-form we'd be injecting attacker-controlled strings into class names
 *   / style — so colour is constrained to a FIXED key set here, and the UI maps the
 *   key to a hard-coded Tailwind class. Never store or render a raw colour string.
 * HOW: TAG_COLORS is the source of truth (a tuple so it can seed a zod enum in
 *   packages/security/validate.ts). isTagColor() narrows an unknown string;
 *   normalizeTagLabel() trims/collapses whitespace for stable de-duplication.
 */

/** Closed palette of tag colour keys. Order is the swatch order in the picker. */
export const TAG_COLORS = [
  "gray",
  "red",
  "orange",
  "amber",
  "green",
  "teal",
  "blue",
  "indigo",
  "purple",
  "pink",
] as const;

export type TagColor = (typeof TAG_COLORS)[number];

export const DEFAULT_TAG_COLOR: TagColor = "gray";

/** True when `c` is one of the allowed palette keys. */
export function isTagColor(c: unknown): c is TagColor {
  return typeof c === "string" && (TAG_COLORS as readonly string[]).includes(c);
}

/** Coerce any input to a safe palette key (falls back to the default). */
export function coerceTagColor(c: unknown): TagColor {
  return isTagColor(c) ? c : DEFAULT_TAG_COLOR;
}

/**
 * Normalize a tag label for storage + uniqueness: trim and collapse internal
 * whitespace. (Case is preserved for display; the per-tenant unique constraint
 * is on the stored label, so callers that want case-insensitive de-dup should
 * lower-case before compare — we keep the display casing the recruiter typed.)
 */
export function normalizeTagLabel(label: string): string {
  return label.replace(/\s+/g, " ").trim();
}
