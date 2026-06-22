import { describe, it, expect } from "vitest";
import { buildCandidateExport } from "./data-export";

describe("buildCandidateExport — whitelisting (§15 export boundary)", () => {
  const out = buildCandidateExport({
    email: "jane@example.com",
    generatedAt: "2026-06-22T00:00:00.000Z",
    profile: { firstName: "Jane", lastName: "Doe", email: "jane@example.com", passwordHash: "$2b$...", resetTokenHash: "secret", bio: "hi" },
    applications: [
      { id: "app1", status: "rejected", submittedAt: "x", jobTitle: "Eng", notes: "INTERNAL recruiter note", rating: 2, resumeText: "Jane Doe SSN 123", adverseActionFreeText: "failed coding" },
    ],
    interviews: [{ id: "iv1", status: "completed", type: "video", scheduledAt: "x", jobTitle: "Eng", internalNotes: "weak" }],
    offers: [{ id: "off1", status: "accepted", salaryAmount: 100, salaryCurrency: "USD", salaryPeriod: "yearly", jobTitle: "Eng", approverId: "u1", notes: "approval note" }],
    consents: [{ type: "privacy_policy", policyVersion: "2026-06-01", granted: true, source: "apply", createdAt: "x", ipAddress: "1.2.3.4" }],
  });

  it("includes the subject + the candidate's own whitelisted fields", () => {
    expect(out.subject).toBe("jane@example.com");
    expect(out.profile).toMatchObject({ firstName: "Jane", lastName: "Doe", bio: "hi" });
    expect(out.applications[0]).toMatchObject({ id: "app1", status: "rejected", jobTitle: "Eng" });
    expect(out.offers[0]).toMatchObject({ id: "off1", salaryAmount: 100 });
    expect(out.consents[0]).toMatchObject({ type: "privacy_policy", granted: true });
  });

  it("NEVER leaks internal / sensitive fields even when present on the input rows", () => {
    const s = JSON.stringify(out);
    expect(s).not.toContain("passwordHash");
    expect(s).not.toContain("resetTokenHash");
    expect(s).not.toContain("INTERNAL recruiter note");
    expect(s).not.toContain("rating");
    expect(s).not.toContain("resumeText");
    expect(s).not.toContain("SSN 123");
    expect(s).not.toContain("failed coding");
    expect(s).not.toContain("internalNotes");
    expect(s).not.toContain("approverId");
    expect(s).not.toContain("approval note");
    // consent ipAddress is internal-audit, not part of the export payload
    expect(s).not.toContain("1.2.3.4");
  });

  it("handles missing sections gracefully", () => {
    const empty = buildCandidateExport({ email: "x@y.com", generatedAt: "t" });
    expect(empty).toMatchObject({ subject: "x@y.com", profile: null, applications: [], interviews: [], offers: [], consents: [] });
  });
});
