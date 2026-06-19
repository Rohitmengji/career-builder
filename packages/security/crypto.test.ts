import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, timingSafeEqual, generateToken, sha256, hmacSign, hmacVerify } from "./crypto";

describe("crypto", () => {
  it("hashes and verifies a password (scrypt round-trip)", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash.startsWith("$scrypt$")).toBe(true);
    expect(await verifyPassword("correct horse battery staple", hash)).toBe(true);
    expect(await verifyPassword("wrong password", hash)).toBe(false);
  });

  it("rejects a crafted hash with out-of-bounds scrypt cost params (anti-DoS)", async () => {
    // N = 2^20 is above the allowed envelope (<= 2^17) — must not run scrypt.
    const malicious = "$scrypt$1048576$8$1$0000$0000";
    expect(await verifyPassword("anything", malicious)).toBe(false);
    // r/p out of range
    expect(await verifyPassword("x", "$scrypt$16384$999$1$0000$0000")).toBe(false);
  });

  it("timingSafeEqual compares correctly", () => {
    expect(timingSafeEqual("abc", "abc")).toBe(true);
    expect(timingSafeEqual("abc", "abd")).toBe(false);
    expect(timingSafeEqual("abc", "abcd")).toBe(false);
  });

  it("generateToken produces unique, sufficiently-long tokens", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(32);
  });

  it("hmac sign/verify round-trips and rejects tampering", () => {
    const sig = hmacSign("payload", "secret");
    expect(hmacVerify("payload", sig, "secret")).toBe(true);
    expect(hmacVerify("payload", sig, "other-secret")).toBe(false);
    expect(hmacVerify("tampered", sig, "secret")).toBe(false);
  });

  it("sha256 is deterministic", () => {
    expect(sha256("abc")).toBe(sha256("abc"));
    expect(sha256("abc")).not.toBe(sha256("abd"));
  });
});
