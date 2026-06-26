/*
 * Unit tests for validateUpload + UPLOAD_PRESETS in ./file-upload.
 *
 * WHAT: Tests the upload validator that gates every file accepted into the
 * system (logos, media), using the `media` preset here.
 * WHY: The declared MIME type / extension can't be trusted, so uploads are
 * verified by content; this test pins the anti-spoofing and anti-XSS behavior
 * that protects tenant storage and anyone who later views the asset.
 * HOW: Helpers build real binary headers (PNG/JPEG magic bytes; a RIFF
 * container + fourCC for WEBP) and assert that detection is by magic bytes not
 * extension (png-named jpeg is rejected), the RIFF fourCC must be WEBP (WAVE/AVI
 * rejected), SVGs containing <script>/event handlers are rejected, the size cap
 * is enforced, and a valid upload yields a sanitized safeFilename with no path
 * traversal ("../"/"/" stripped).
 */
import { describe, it, expect } from "vitest";
import { validateUpload, UPLOAD_PRESETS } from "./file-upload";

function buf(...bytes: number[]) {
  return Buffer.from(bytes);
}
// RIFF container header: "RIFF" + 4 size bytes + fourCC
function riff(fourCC: string) {
  return Buffer.concat([Buffer.from("RIFF"), buf(0, 0, 0, 0), Buffer.from(fourCC)]);
}

describe("validateUpload", () => {
  it("accepts a real PNG by magic bytes", () => {
    const png = buf(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2);
    const r = validateUpload({ name: "logo.png", size: png.length, type: "image/png" }, png, UPLOAD_PRESETS.media);
    expect(r.valid).toBe(true);
    expect(r.detectedType).toBe("png");
  });

  it("rejects a spoofed file (png extension, jpeg bytes)", () => {
    const jpeg = buf(0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0);
    const r = validateUpload({ name: "logo.png", size: jpeg.length, type: "image/png" }, jpeg, UPLOAD_PRESETS.media);
    expect(r.valid).toBe(false);
  });

  it("accepts a real WEBP (RIFF + WEBP fourCC)", () => {
    const webp = riff("WEBP");
    const r = validateUpload({ name: "x.webp", size: webp.length, type: "image/webp" }, webp, UPLOAD_PRESETS.media);
    expect(r.valid).toBe(true);
  });

  it("rejects WAV/AVI masquerading as WEBP (fourCC check)", () => {
    const wave = riff("WAVE");
    const r = validateUpload({ name: "x.webp", size: wave.length, type: "image/webp" }, wave, UPLOAD_PRESETS.media);
    expect(r.valid).toBe(false);
  });

  it("rejects SVG containing a script / event handler", () => {
    const evil = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`);
    const r = validateUpload({ name: "x.svg", size: evil.length, type: "image/svg+xml" }, evil, UPLOAD_PRESETS.media);
    expect(r.valid).toBe(false);
  });

  it("rejects files over the size limit", () => {
    const png = buf(0x89, 0x50, 0x4e, 0x47);
    const r = validateUpload({ name: "x.png", size: 99 * 1024 * 1024, type: "image/png" }, png, UPLOAD_PRESETS.media);
    expect(r.valid).toBe(false);
  });

  it("produces a safe, sanitized filename for valid uploads", () => {
    const png = buf(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    const r = validateUpload({ name: "../../etc/passwd.png", size: png.length, type: "image/png" }, png, UPLOAD_PRESETS.media);
    expect(r.valid).toBe(true);
    expect(r.safeFilename).toBeDefined();
    expect(r.safeFilename).not.toContain("/");
    expect(r.safeFilename).not.toContain("..");
  });
});
