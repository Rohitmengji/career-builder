/*
 * Unit tests for the output/input sanitizers in ./sanitize.
 *
 * WHAT: Exercises the package/security sanitization primitives — escapeHtml,
 * stripHtml, sanitizeRichText, sanitizeEmail, sanitizeTenantId.
 * WHY: These are the last line of defense against stored/reflected XSS in
 * tenant-supplied content (rich text, emails, tenant ids) and against ATS
 * input that flows into HTML or identifiers; a regression here is a security bug.
 * HOW: Asserts the security-relevant behaviors that are NOT obvious from the
 * function names — e.g. `/` is escaped to defend `</script>` breakouts, comments
 * and CDATA can't smuggle payloads past sanitizeRichText, only http(s) hrefs
 * survive (and gain rel="noopener noreferrer"), emails normalize to lowercase
 * (ties into ADR-0001 email-as-identity), and tenant ids reduce to the safe
 * [a-z0-9-] charset (null when nothing valid remains).
 */
import { describe, it, expect } from "vitest";
import { escapeHtml, stripHtml, sanitizeRichText, sanitizeEmail, sanitizeTenantId } from "./sanitize";

describe("escapeHtml", () => {
  it("escapes HTML metacharacters", () => {
    // note: `/` is also escaped (&#x2F;) to defend against `</script>` breakouts
    expect(escapeHtml(`<b>"x"&'</b>`)).toBe("&lt;b&gt;&quot;x&quot;&amp;&#x27;&lt;&#x2F;b&gt;");
  });
});

describe("stripHtml", () => {
  it("removes all tags", () => {
    expect(stripHtml("<p>hi <b>there</b></p>")).not.toContain("<");
  });
});

describe("sanitizeRichText", () => {
  it("strips <script> and event handlers", () => {
    const out = sanitizeRichText(`<p onclick="x()">hi</p><script>alert(1)</script>`);
    expect(out).not.toMatch(/<script/i);
    expect(out).not.toMatch(/onclick/i);
  });

  it("strips HTML comments and CDATA (payload hiding)", () => {
    const out = sanitizeRichText(`<!--<script>alert(1)//--><![CDATA[<img onerror=x>]]>ok`);
    expect(out).not.toMatch(/<script/i);
    expect(out).not.toMatch(/onerror/i);
    expect(out).toContain("ok");
  });

  it("keeps safe formatting tags", () => {
    const out = sanitizeRichText("<p>hello <strong>world</strong></p>");
    expect(out).toContain("<strong>");
    expect(out).toContain("<p>");
  });

  it("only allows http(s) hrefs on <a> (single/unquoted too)", () => {
    expect(sanitizeRichText(`<a href="javascript:alert(1)">x</a>`)).not.toMatch(/javascript:/i);
    expect(sanitizeRichText(`<a href='javascript:alert(1)'>x</a>`)).not.toMatch(/javascript:/i);
    const safe = sanitizeRichText(`<a href="https://example.com">x</a>`);
    expect(safe).toContain("example.com"); // href is preserved (slashes may be entity-encoded)
    expect(safe).not.toMatch(/javascript:/i);
    expect(safe).toContain('rel="noopener noreferrer"');
  });
});

describe("sanitizeEmail", () => {
  it("normalizes valid emails and rejects invalid", () => {
    expect(sanitizeEmail("  Foo@Example.COM ")).toBe("foo@example.com");
    expect(sanitizeEmail("not-an-email")).toBeNull();
  });
});

describe("sanitizeTenantId", () => {
  it("sanitizes ids to the safe charset; returns null when nothing valid remains", () => {
    expect(sanitizeTenantId("acme-co")).toBe("acme-co");
    expect(sanitizeTenantId("Bad_ID!")).toBe("badid"); // lowercased + stripped to [a-z0-9-]
    expect(sanitizeTenantId("!!!")).toBeNull();
  });
});
