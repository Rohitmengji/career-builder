/*
 * Tests for shared/talent-pool — the marketing-consent gate for re-engagement.
 * Pinned invariant: DEFAULT-DENY — only members with marketing === true are
 * emailed; missing/false consent is skipped. De-dupes by lowercased email.
 */

import { describe, it, expect } from "vitest";
import { partitionReengageRecipients } from "./talent-pool";

describe("partitionReengageRecipients", () => {
  it("sends only to members with marketing consent === true", () => {
    const out = partitionReengageRecipients(
      [{ candidateEmail: "a@x.com" }, { candidateEmail: "b@x.com" }, { candidateEmail: "c@x.com" }],
      {
        "a@x.com": { marketing: true, privacy_policy: true },
        "b@x.com": { marketing: false },
        // c@x.com has NO consent record
      },
    );
    expect(out.willSend).toEqual(["a@x.com"]);
    expect(out.skippedNoConsent.sort()).toEqual(["b@x.com", "c@x.com"]);
  });

  it("is default-deny: empty consent map skips everyone", () => {
    const out = partitionReengageRecipients([{ candidateEmail: "a@x.com" }], {});
    expect(out.willSend).toEqual([]);
    expect(out.skippedNoConsent).toEqual(["a@x.com"]);
  });

  it("lowercases + de-dupes emails before matching consent", () => {
    const out = partitionReengageRecipients(
      [{ candidateEmail: "A@X.com" }, { candidateEmail: "a@x.com" }],
      { "a@x.com": { marketing: true } },
    );
    expect(out.willSend).toEqual(["a@x.com"]);
    expect(out.skippedNoConsent).toEqual([]);
  });

  it("does not treat a truthy non-true value as consent", () => {
    // Defense against a sloppy consent map — only the literal boolean true sends.
    const out = partitionReengageRecipients(
      [{ candidateEmail: "a@x.com" }],
      { "a@x.com": { marketing: 1 as unknown as boolean } },
    );
    expect(out.willSend).toEqual([]);
  });
});
