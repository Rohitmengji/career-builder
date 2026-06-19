import { describe, it, expect } from "vitest";
import { createPreviewToken, verifyPreviewToken } from "./preview-token";

describe("preview-token", () => {
  it("round-trips a valid token and returns its claims", () => {
    const token = createPreviewToken("acme", "careers");
    const claims = verifyPreviewToken(token);
    expect(claims).toEqual({ tenantId: "acme", slug: "careers" });
  });

  it("rejects a tampered signature", () => {
    const token = createPreviewToken("acme", "careers");
    const tampered = token.slice(0, -2) + (token.endsWith("a") ? "bb" : "aa");
    expect(verifyPreviewToken(tampered)).toBeNull();
  });

  it("rejects a tampered payload (different tenant) without a matching signature", () => {
    const token = createPreviewToken("acme", "careers");
    const [, sig] = token.split(".");
    const forgedPayload = Buffer.from("globex:careers:9999999999").toString("base64url");
    expect(verifyPreviewToken(`${forgedPayload}.${sig}`)).toBeNull();
  });

  it("rejects an expired token", () => {
    const token = createPreviewToken("acme", "careers", -10); // already expired
    expect(verifyPreviewToken(token)).toBeNull();
  });

  it("rejects malformed / empty tokens", () => {
    expect(verifyPreviewToken("")).toBeNull();
    expect(verifyPreviewToken(null)).toBeNull();
    expect(verifyPreviewToken("not-a-token")).toBeNull();
    expect(verifyPreviewToken("a.b.c")).toBeNull();
  });

  it("binds the slug into the token", () => {
    const token = createPreviewToken("acme", "about");
    expect(verifyPreviewToken(token)?.slug).toBe("about");
  });
});
