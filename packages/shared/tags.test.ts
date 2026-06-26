/*
 * Tests for shared/tags — the closed colour palette + label/colour validators.
 * Asserts the security-relevant contract: colour is ALWAYS coerced to a known
 * palette key (never raw CSS), and labels normalize to a stable form.
 */

import { describe, it, expect } from "vitest";
import {
  TAG_COLORS,
  DEFAULT_TAG_COLOR,
  isTagColor,
  coerceTagColor,
  normalizeTagLabel,
} from "./tags";

describe("isTagColor", () => {
  it("accepts every palette key", () => {
    for (const c of TAG_COLORS) expect(isTagColor(c)).toBe(true);
  });
  it("rejects anything outside the palette (incl. CSS-ish strings)", () => {
    expect(isTagColor("red; background:url(x)")).toBe(false);
    expect(isTagColor("#ff0000")).toBe(false);
    expect(isTagColor("")).toBe(false);
    expect(isTagColor(undefined)).toBe(false);
    expect(isTagColor(123)).toBe(false);
  });
});

describe("coerceTagColor", () => {
  it("passes through a valid key", () => {
    expect(coerceTagColor("blue")).toBe("blue");
  });
  it("falls back to the default for anything invalid", () => {
    expect(coerceTagColor("rainbow")).toBe(DEFAULT_TAG_COLOR);
    expect(coerceTagColor(null)).toBe(DEFAULT_TAG_COLOR);
  });
});

describe("normalizeTagLabel", () => {
  it("trims and collapses internal whitespace", () => {
    expect(normalizeTagLabel("  strong   fit \n")).toBe("strong fit");
  });
  it("preserves display casing", () => {
    expect(normalizeTagLabel("Referral")).toBe("Referral");
  });
});
