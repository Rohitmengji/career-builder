/*
 * Unit tests for extractResumeText() — the SERVER-ONLY, fail-safe resume parser.
 *
 * WHY: parsing untrusted uploads is a DoS surface, so the contract is that the
 * function NEVER throws and NEVER blocks an application — it returns null on any
 * problem. These tests pin every guard described in extract.ts so a refactor
 * can't silently weaken them. The unpdf parser is mocked (see below) so the
 * guard logic is exercised without real PDF fixtures.
 *
 * Behaviours asserted:
 *   - type allow-list: only application/pdf and text/plain are parsed (txt skips
 *     the PDF parser entirely); mime parameters like charset are tolerated;
 *     unsupported types return null without invoking the parser;
 *   - fail-safe: parser throw, timeout (parser never resolves), empty input,
 *     oversize input (> MAX_BYTES), and whitespace-only output all yield null;
 *   - concurrency cap: once MAX_CONCURRENT_EXTRACTIONS in-flight, the next call
 *     is skipped without invoking the parser (the held slots are released at the
 *     end so the module-level counter doesn't leak into later tests);
 *   - normalization + output cap: runaway whitespace collapses, multi-page arrays
 *     join, and output is truncated to MAX_TEXT_CHARS.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the PDF parser so the guard logic is testable without a real PDF fixture.
const extractText = vi.fn();
const getDocumentProxy = vi.fn();
vi.mock("unpdf", () => ({
  extractText: (...a: unknown[]) => extractText(...a),
  getDocumentProxy: (...a: unknown[]) => getDocumentProxy(...a),
}));

import { extractResumeText, MAX_TEXT_CHARS, MAX_BYTES, MAX_CONCURRENT_EXTRACTIONS } from "./extract";

const pdfBytes = () => new Uint8Array([0x25, 0x50, 0x44, 0x46]); // "%PDF"

beforeEach(() => {
  extractText.mockReset();
  getDocumentProxy.mockReset();
  getDocumentProxy.mockResolvedValue({});
});

describe("extractResumeText — type allow-list", () => {
  it("parses application/pdf", async () => {
    extractText.mockResolvedValueOnce({ totalPages: 1, text: "Jane — Senior Engineer" });
    const out = await extractResumeText({ bytes: pdfBytes(), mimeType: "application/pdf" });
    expect(out).toBe("Jane — Senior Engineer");
  });

  it("parses text/plain without invoking the PDF parser", async () => {
    const bytes = new TextEncoder().encode("Plain resume text");
    const out = await extractResumeText({ bytes, mimeType: "text/plain" });
    expect(out).toBe("Plain resume text");
    expect(getDocumentProxy).not.toHaveBeenCalled();
  });

  it("returns null (does NOT parse) for unsupported types", async () => {
    const out = await extractResumeText({ bytes: pdfBytes(), mimeType: "application/zip" });
    expect(out).toBeNull();
    expect(getDocumentProxy).not.toHaveBeenCalled();
  });

  it("tolerates a mime type with parameters (e.g. charset)", async () => {
    const bytes = new TextEncoder().encode("hello");
    const out = await extractResumeText({ bytes, mimeType: "text/plain; charset=utf-8" });
    expect(out).toBe("hello");
  });
});

describe("extractResumeText — fail-safe (never throws)", () => {
  it("returns null when the parser throws", async () => {
    extractText.mockRejectedValueOnce(new Error("malformed pdf"));
    const out = await extractResumeText({ bytes: pdfBytes(), mimeType: "application/pdf" });
    expect(out).toBeNull();
  });

  it("returns null when extraction exceeds the timeout (can't hang the request)", async () => {
    extractText.mockImplementationOnce(() => new Promise(() => {})); // never resolves
    const out = await extractResumeText({ bytes: pdfBytes(), mimeType: "application/pdf" }, { timeoutMs: 20 });
    expect(out).toBeNull();
  });

  it("returns null for empty input and oversize input", async () => {
    expect(await extractResumeText({ bytes: new Uint8Array(0), mimeType: "application/pdf" })).toBeNull();
    const huge = new Uint8Array(MAX_BYTES + 1);
    expect(await extractResumeText({ bytes: huge, mimeType: "application/pdf" })).toBeNull();
    expect(getDocumentProxy).not.toHaveBeenCalled();
  });

  it("returns null when the parser yields only whitespace", async () => {
    extractText.mockResolvedValueOnce({ totalPages: 1, text: "   \n\n   " });
    const out = await extractResumeText({ bytes: pdfBytes(), mimeType: "application/pdf" });
    expect(out).toBeNull();
  });
});

describe("extractResumeText — concurrency cap (DoS bound)", () => {
  it("skips extraction (returns null) once the per-instance cap is saturated", async () => {
    getDocumentProxy.mockResolvedValue({});
    // Hold each parse open with a deferred resolver so we can free slots at the end
    // (otherwise the held slots leak into later tests via the module-level counter).
    const release: Array<(v: unknown) => void> = [];
    extractText.mockImplementation(() => new Promise((res) => release.push(res)));

    // Saturate: fire MAX concurrent extractions (don't await — they stay in flight).
    const hanging = Array.from({ length: MAX_CONCURRENT_EXTRACTIONS }, () =>
      extractResumeText({ bytes: pdfBytes(), mimeType: "application/pdf" }, { timeoutMs: 60_000 }).catch(() => null),
    );
    // The next one must be skipped immediately without invoking the parser.
    getDocumentProxy.mockClear();
    const skipped = await extractResumeText({ bytes: pdfBytes(), mimeType: "application/pdf" });
    expect(skipped).toBeNull();
    expect(getDocumentProxy).not.toHaveBeenCalled();

    // Free the held slots so the counter returns to 0 for subsequent tests.
    release.forEach((r) => r({ text: "" }));
    await Promise.allSettled(hanging);
  });
});

describe("extractResumeText — normalization + output cap", () => {
  it("collapses runaway whitespace", async () => {
    extractText.mockResolvedValueOnce({ text: "a\r\n\r\n\r\n\r\nb     c\t\td" });
    const out = await extractResumeText({ bytes: pdfBytes(), mimeType: "application/pdf" });
    expect(out).toBe("a\n\nb c d");
  });

  it("joins multi-page array text", async () => {
    extractText.mockResolvedValueOnce({ text: ["page one", "page two"] });
    const out = await extractResumeText({ bytes: pdfBytes(), mimeType: "application/pdf" });
    expect(out).toBe("page one\npage two");
  });

  it("caps output at MAX_TEXT_CHARS", async () => {
    extractText.mockResolvedValueOnce({ text: "x".repeat(MAX_TEXT_CHARS + 5000) });
    const out = await extractResumeText({ bytes: pdfBytes(), mimeType: "application/pdf" });
    expect(out!.length).toBe(MAX_TEXT_CHARS);
  });
});
