/*
 * Unit tests for ./blind-hiring — config parsing + server-enforced applicant
 * redaction (pure logic, the core of the blind-hiring invariant).
 *
 * WHY: blind hiring removes identifying PII from applicants before reviewers see
 * them, to reduce bias. Redaction MUST happen server-side and must be total — a
 * single surviving identifier (a name buried in resumeText, a tenant-scoped
 * resumePath) defeats the purpose. The "mandatory" test serializes the output and
 * asserts no PII string appears anywhere.
 *
 * Behaviors asserted:
 *  - parseBlindHiring: defaults to disabled-with-all-fields when unset/malformed,
 *    parses the enabled config from string or object form, drops unknown field
 *    names, falls back to ALL redactable fields when the list is empty, and treats
 *    any non-`true` `enabled` as disabled;
 *  - redactApplicant: no-op (returns same ref) when disabled; when enabled masks
 *    every configured field so NO PII value survives in the JSON (incl.
 *    resumeText and the tenant-scoped resumePath), sets redacted:true, keeps
 *    non-identifying fields (job/status/rating) intact, honors a partial field
 *    selection, and never mutates the input;
 *  - redactApplicants: applies the same redaction across a list.
 */
import { describe, it, expect } from "vitest";
import {
  parseBlindHiring,
  redactApplicant,
  redactApplicants,
  DEFAULT_BLIND_HIRING,
  REDACTABLE_FIELDS,
} from "./blind-hiring";

const applicant = {
  id: "app_abc12345",
  firstName: "Jane",
  lastName: "Doe",
  email: "jane@example.com",
  phone: "+1 555 0100",
  linkedinUrl: "https://linkedin.com/in/jane",
  resumeUrl: "https://files/resume.pdf",
  resumePath: "t/acme/resumes/r.pdf",
  resumeText: "Jane Doe — jane@example.com — Senior Engineer in San Francisco",
  location: "San Francisco",
  status: "screening",
  rating: 4,
  job: { title: "Senior Eng" },
};

describe("parseBlindHiring", () => {
  it("defaults to disabled with all fields when unset/malformed", () => {
    expect(parseBlindHiring(undefined)).toEqual(DEFAULT_BLIND_HIRING);
    expect(parseBlindHiring("not json")).toEqual(DEFAULT_BLIND_HIRING);
    expect(parseBlindHiring(JSON.stringify({}))).toEqual(DEFAULT_BLIND_HIRING);
  });

  it("parses an enabled config (string or object form)", () => {
    const s = JSON.stringify({ blindHiring: { enabled: true, fields: ["firstName", "email"] } });
    expect(parseBlindHiring(s)).toEqual({ enabled: true, fields: ["firstName", "email"] });
    expect(parseBlindHiring({ blindHiring: { enabled: true, fields: ["phone"] } })).toEqual({
      enabled: true,
      fields: ["phone"],
    });
  });

  it("drops unknown fields and falls back to all fields if list is empty", () => {
    expect(parseBlindHiring({ blindHiring: { enabled: true, fields: ["ssn", "firstName"] } })).toEqual({
      enabled: true,
      fields: ["firstName"],
    });
    expect(parseBlindHiring({ blindHiring: { enabled: true, fields: [] } })).toEqual({
      enabled: true,
      fields: [...REDACTABLE_FIELDS],
    });
  });

  it("treats any non-true enabled as disabled", () => {
    expect(parseBlindHiring({ blindHiring: { enabled: "yes" } }).enabled).toBe(false);
  });
});

describe("redactApplicant — server-enforced redaction (THE mandatory test)", () => {
  it("is a no-op when disabled", () => {
    expect(redactApplicant(applicant, { enabled: false, fields: [...REDACTABLE_FIELDS] })).toBe(applicant);
  });

  it("masks EVERY configured identifying field; none of the PII survives", () => {
    const out = redactApplicant(applicant, { enabled: true, fields: [...REDACTABLE_FIELDS] });
    // The serialized payload must contain no identifying value.
    const json = JSON.stringify(out);
    for (const v of ["Jane", "Doe", "jane@example.com", "555 0100", "linkedin.com/in/jane", "resume.pdf", "t/acme/resumes", "San Francisco"]) {
      expect(json).not.toContain(v);
    }
    expect(out.firstName).toBe("Candidate");
    expect(out.email).toBeNull();
    expect(out.resumeUrl).toBeNull();
    expect(out.resumeText).toBeNull(); // identity-rich extracted text must be masked
    expect(out.redacted).toBe(true);
  });

  it("keeps NON-identifying fields (job, status, rating) intact", () => {
    const out = redactApplicant(applicant, { enabled: true, fields: [...REDACTABLE_FIELDS] });
    expect(out.status).toBe("screening");
    expect(out.rating).toBe(4);
    expect(out.job).toEqual({ title: "Senior Eng" });
  });

  it("honors a partial field selection (only redacts chosen fields)", () => {
    const out = redactApplicant(applicant, { enabled: true, fields: ["email", "phone"] });
    expect(out.firstName).toBe("Jane"); // not selected → preserved
    expect(out.email).toBeNull();
    expect(out.phone).toBeNull();
    expect(out.resumeUrl).toBe("https://files/resume.pdf"); // not selected → preserved
  });

  it("does not mutate the input object", () => {
    const copy = { ...applicant };
    redactApplicant(applicant, { enabled: true, fields: [...REDACTABLE_FIELDS] });
    expect(applicant).toEqual(copy);
  });
});

describe("redactApplicants (list)", () => {
  it("redacts every row when enabled", () => {
    const out = redactApplicants([applicant, { ...applicant, id: "app_xyz99" }], {
      enabled: true,
      fields: [...REDACTABLE_FIELDS],
    });
    expect(out.every((a) => a.redacted && a.email === null)).toBe(true);
  });
});
