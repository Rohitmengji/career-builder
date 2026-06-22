import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { assertCron } from "./cron";

function reqWith(authorization?: string): Request {
  return new Request("https://admin.example.com/api/cron/health", {
    headers: authorization ? { authorization } : {},
  });
}

describe("assertCron", () => {
  const original = process.env.CRON_SECRET;
  beforeEach(() => { process.env.CRON_SECRET = "s3cr3t-token-value"; });
  afterEach(() => {
    if (original === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = original;
  });

  it("accepts the correct Bearer token", () => {
    expect(assertCron(reqWith("Bearer s3cr3t-token-value"))).toBe(true);
  });

  it("rejects a wrong token", () => {
    expect(assertCron(reqWith("Bearer wrong-token-value!!"))).toBe(false);
  });

  it("rejects a missing Authorization header", () => {
    expect(assertCron(reqWith())).toBe(false);
  });

  it("rejects a token of a different length (no timingSafeEqual throw)", () => {
    expect(assertCron(reqWith("Bearer short"))).toBe(false);
  });

  it("rejects everything when CRON_SECRET is unset (fail closed)", () => {
    delete process.env.CRON_SECRET;
    expect(assertCron(reqWith("Bearer s3cr3t-token-value"))).toBe(false);
  });
});
