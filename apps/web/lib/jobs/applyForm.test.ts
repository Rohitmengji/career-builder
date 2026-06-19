import { describe, it, expect } from "vitest";
import {
  validateApplyForm,
  validateResumeFile,
  messageForResponse,
  fileExtension,
  APPLY_LIMITS,
  type ApplyFormValues,
} from "./applyForm";

// Minimal File stand-in (node has File in modern versions, but be explicit).
function fakeFile(name: string, size: number): File {
  return { name, size } as unknown as File;
}

const VALID: ApplyFormValues = {
  firstName: "Jane",
  lastName: "Doe",
  email: "jane@example.com",
  linkedinUrl: "https://linkedin.com/in/janedoe",
};

describe("validateApplyForm — required fields", () => {
  it("passes with valid values + a resume file", () => {
    const r = validateApplyForm(VALID, fakeFile("cv.pdf", 1000));
    expect(r.valid).toBe(true);
    expect(r.firstErrorField).toBeUndefined();
  });

  it("flags missing name/email and reports the first error field in form order", () => {
    const r = validateApplyForm({ firstName: "", lastName: "", email: "" }, fakeFile("cv.pdf", 10));
    expect(r.valid).toBe(false);
    expect(r.errors.firstName).toBeDefined();
    expect(r.errors.lastName).toBeDefined();
    expect(r.errors.email).toBeDefined();
    expect(r.firstErrorField).toBe("firstName");
  });

  it("rejects a malformed email", () => {
    const r = validateApplyForm({ ...VALID, email: "not-an-email" }, fakeFile("cv.pdf", 10));
    expect(r.errors.email).toMatch(/valid email/i);
  });
});

describe("validateApplyForm — resume requirement", () => {
  it("requires a file when URLs aren't allowed", () => {
    const r = validateApplyForm(VALID, null);
    expect(r.errors.resume).toMatch(/attach your resume/i);
  });

  it("accepts a resume URL when allowed", () => {
    const r = validateApplyForm({ ...VALID, resumeUrl: "https://example.com/cv.pdf" }, null, { allowResumeUrl: true });
    expect(r.valid).toBe(true);
  });

  it("rejects a non-http resume URL when allowed", () => {
    const r = validateApplyForm({ ...VALID, resumeUrl: "javascript:alert(1)" }, null, { allowResumeUrl: true });
    expect(r.errors.resume).toBeDefined();
  });
});

describe("validateApplyForm — linkedin host parity with server", () => {
  it("rejects a non-LinkedIn URL", () => {
    const r = validateApplyForm({ ...VALID, linkedinUrl: "https://evil.example.com/in/x" }, fakeFile("cv.pdf", 10));
    expect(r.errors.linkedinUrl).toMatch(/linkedin/i);
  });

  it("accepts a www.linkedin.com URL", () => {
    const r = validateApplyForm({ ...VALID, linkedinUrl: "https://www.linkedin.com/in/x" }, fakeFile("cv.pdf", 10));
    expect(r.errors.linkedinUrl).toBeUndefined();
  });
});

describe("validateResumeFile", () => {
  it("rejects an oversized file (server parity: 5MB)", () => {
    expect(validateResumeFile(fakeFile("cv.pdf", APPLY_LIMITS.maxFileBytes + 1))).toMatch(/under 5MB/);
  });
  it("rejects an empty file", () => {
    expect(validateResumeFile(fakeFile("cv.pdf", 0))).toMatch(/empty/i);
  });
  it("rejects a disallowed extension (e.g. .exe)", () => {
    expect(validateResumeFile(fakeFile("malware.exe", 100))).toMatch(/Unsupported/i);
  });
  it("accepts an allowed extension regardless of case", () => {
    expect(validateResumeFile(fakeFile("Resume.PDF", 100))).toBeNull();
  });
});

describe("fileExtension", () => {
  it("extracts and lowercases the extension", () => {
    expect(fileExtension("a.b.PDF")).toBe(".pdf");
    expect(fileExtension("noext")).toBe("");
  });
});

describe("messageForResponse — actionable, never leaks internals", () => {
  it("maps known statuses to friendly, specific messages", () => {
    expect(messageForResponse(403)).toMatch(/reload the page/i);
    expect(messageForResponse(404)).toMatch(/no longer/i);
    expect(messageForResponse(409)).toMatch(/already applied/i);
    expect(messageForResponse(413)).toMatch(/under 5MB/);
    expect(messageForResponse(429)).toMatch(/wait a moment/i);
  });

  it("uses the safe server message for 400 (schema validation)", () => {
    expect(messageForResponse(400, "Email is required")).toBe("Email is required");
  });

  it("never echoes a raw 5xx body to the user", () => {
    const msg = messageForResponse(500, "TypeError: cannot read property x of undefined at db.ts:42");
    expect(msg).not.toMatch(/TypeError|db\.ts/);
    expect(msg).toMatch(/try again/i);
  });
});
