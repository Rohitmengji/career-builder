/*
 * Unit tests for safeUrl() — the render-time XSS guard in the design system.
 *
 * WHY: safeUrl() sanitizes any URL before it reaches an href/src in tenant- or
 * editor-authored content. new URL() alone would happily accept "javascript:"
 * and "data:" schemes, so these tests pin the allow-list behaviour that keeps a
 * crafted link from executing script.
 *
 * Behaviours asserted: dangerous schemes (javascript/data/vbscript) and
 * non-http(s) absolute schemes (ftp/file) are rejected even when obfuscated with
 * whitespace, control chars, or Unicode (NBSP / bidi override / zero-width);
 * safe forms (http(s), relative, anchor, mailto, tel) pass through unchanged; and
 * empty/non-string input returns the caller-supplied fallback.
 */
import { describe, it, expect } from "vitest";
import { safeUrl } from "./design-system";

describe("safeUrl — rejects dangerous schemes (render-time XSS guard)", () => {
  it("blocks javascript: hrefs (new URL() would otherwise accept them)", () => {
    expect(safeUrl("javascript:alert(1)")).toBe("");
    expect(safeUrl("JavaScript:alert(1)")).toBe("");
    // Obfuscated with whitespace/control chars between the scheme letters.
    expect(safeUrl("java\tscript:alert(1)")).toBe("");
    expect(safeUrl("  javascript:alert(1)")).toBe("");
    expect(safeUrl("java\nscript:alert(1)", "#safe")).toBe("#safe");
  });

  it("blocks data: and vbscript: schemes", () => {
    expect(safeUrl("data:text/html,<script>alert(1)</script>")).toBe("");
    expect(safeUrl("vbscript:msgbox(1)")).toBe("");
  });

  it("blocks Unicode-obfuscated schemes (NBSP / bidi / zero-width between letters)", () => {
    expect(safeUrl("java\u00a0script:alert(1)")).toBe(""); // NBSP
    expect(safeUrl("java\u202escript:alert(1)")).toBe(""); // RTL override
    expect(safeUrl("java\u200bscript:alert(1)")).toBe(""); // zero-width space
    expect(safeUrl("\u2066javascript:alert(1)")).toBe(""); // leading isolate
  });

  it("blocks non-http(s) absolute schemes", () => {
    expect(safeUrl("ftp://example.com/file")).toBe("");
    expect(safeUrl("file:///etc/passwd")).toBe("");
  });

  it("allows safe http(s), relative, anchor, mailto, tel", () => {
    expect(safeUrl("https://example.com/jobs")).toBe("https://example.com/jobs");
    expect(safeUrl("http://example.com")).toBe("http://example.com");
    expect(safeUrl("/jobs")).toBe("/jobs");
    expect(safeUrl("#apply")).toBe("#apply");
    expect(safeUrl("mailto:careers@example.com")).toBe("mailto:careers@example.com");
    expect(safeUrl("tel:+1-800-555-0100")).toBe("tel:+1-800-555-0100");
  });

  it("returns the fallback for empty / non-string input", () => {
    expect(safeUrl("", "#")).toBe("#");
    expect(safeUrl(undefined, "#")).toBe("#");
    expect(safeUrl(null, "#")).toBe("#");
    expect(safeUrl(123 as unknown, "#")).toBe("#");
    expect(safeUrl("   ", "#")).toBe("#");
  });
});
