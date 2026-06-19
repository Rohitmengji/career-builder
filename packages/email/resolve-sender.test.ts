import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolveSender } from "./index";

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
