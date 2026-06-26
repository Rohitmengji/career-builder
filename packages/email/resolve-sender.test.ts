/*
 * Unit tests for resolveSender() (packages/email/index.ts).
 *
 * WHAT: pins the per-send sender-resolution contract — given optional tenant
 * email settings, which `from` address and which `adminEmail` an outgoing mail
 * gets.
 *
 * WHY: senders are reused across every email type, so a regression here silently
 * affects all outbound mail. The central invariant is R8 (anti-spoofing): a
 * tenant's own from-address is honored ONLY when senderVerified === true;
 * otherwise we emit `from: undefined` so the provider falls back to its verified
 * platform default rather than spoofing an unverified domain.
 *
 * Behaviors asserted:
 *   - no tenant settings  -> from is undefined, adminEmail = platform EMAIL_ADMIN
 *   - R8 unverified sender -> tenant fromEmail ignored (from stays undefined)
 *   - R8 verified sender   -> tenant {email,name} used (name falls back to env)
 *   - tenant adminEmail overrides the platform admin inbox for notifications
 *
 * Env is read fresh inside resolveSender on each call, so these tests drive
 * behavior purely by mutating process.env.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolveSender } from "./index";

// Snapshot the real env once; afterEach restores it so per-test env mutations
// below don't leak into other test files sharing the process.
const SAVED = { ...process.env };

beforeEach(() => {
  process.env.EMAIL_FROM = "platform@careerbuilder.app";
  process.env.EMAIL_FROM_NAME = "Career Builder";
  process.env.EMAIL_ADMIN = "ops@careerbuilder.app";
});

afterEach(() => {
  process.env = { ...SAVED };
});

describe("resolveSender", () => {
  it("uses the platform default sender when no tenant settings", () => {
    const { from, adminEmail } = resolveSender();
    expect(from).toBeUndefined(); // provider falls back to its verified default
    expect(adminEmail).toBe("ops@careerbuilder.app");
  });

  it("R8: ignores an UNVERIFIED tenant from-address", () => {
    const { from } = resolveSender({ fromEmail: "jobs@acme.com", senderVerified: false });
    expect(from).toBeUndefined();
  });

  it("R8: uses a VERIFIED tenant from-address", () => {
    const { from } = resolveSender({
      fromEmail: "jobs@acme.com",
      fromName: "Acme Careers",
      senderVerified: true,
    });
    expect(from).toEqual({ email: "jobs@acme.com", name: "Acme Careers" });
  });

  it("routes notifications to the tenant admin inbox when set", () => {
    expect(resolveSender({ adminEmail: "hr@acme.com" }).adminEmail).toBe("hr@acme.com");
  });
});
