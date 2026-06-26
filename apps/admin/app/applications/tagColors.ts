/*
 * Tag colour → Tailwind class map (ADR-0016, B2b) — admin UI only.
 *
 * WHY: tag colours are a CLOSED palette (shared/tags.TAG_COLORS). The DB only ever
 *   stores a palette key; this maps each key to hard-coded Tailwind classes. Because
 *   the class strings are literals here (never interpolated from the stored value),
 *   a malformed/foreign colour can never inject CSS — unknown keys fall back to gray.
 * HOW: chipClass() returns the chip's bg/text/border classes; swatchClass() returns
 *   a solid dot for the colour picker.
 */

const CHIP: Record<string, string> = {
  gray: "bg-gray-100 text-gray-700 border-gray-200",
  red: "bg-red-100 text-red-700 border-red-200",
  orange: "bg-orange-100 text-orange-700 border-orange-200",
  amber: "bg-amber-100 text-amber-800 border-amber-200",
  green: "bg-green-100 text-green-700 border-green-200",
  teal: "bg-teal-100 text-teal-700 border-teal-200",
  blue: "bg-blue-100 text-blue-700 border-blue-200",
  indigo: "bg-indigo-100 text-indigo-700 border-indigo-200",
  purple: "bg-purple-100 text-purple-700 border-purple-200",
  pink: "bg-pink-100 text-pink-700 border-pink-200",
};

const SWATCH: Record<string, string> = {
  gray: "bg-gray-400",
  red: "bg-red-500",
  orange: "bg-orange-500",
  amber: "bg-amber-500",
  green: "bg-green-500",
  teal: "bg-teal-500",
  blue: "bg-blue-500",
  indigo: "bg-indigo-500",
  purple: "bg-purple-500",
  pink: "bg-pink-500",
};

/** Tailwind classes for a tag chip (falls back to gray for unknown keys). */
export function chipClass(color: string | null | undefined): string {
  return CHIP[color ?? "gray"] ?? CHIP.gray;
}

/** Tailwind class for a solid colour swatch in the picker. */
export function swatchClass(color: string): string {
  return SWATCH[color] ?? SWATCH.gray;
}

/** The palette order shown in the picker (mirrors shared/tags.TAG_COLORS). */
export const PALETTE = ["gray", "red", "orange", "amber", "green", "teal", "blue", "indigo", "purple", "pink"] as const;
