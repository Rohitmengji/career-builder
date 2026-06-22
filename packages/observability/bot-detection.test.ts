import { describe, it, expect } from "vitest";
import { detectBot, isLoopbackIp } from "./bot-detection";

/** A bare request with no browser-like headers (what curl/scripts send). */
function bareRequest(ua = "curl/8.7.1"): Request {
  return new Request("http://localhost:3001/api/admin/analytics", {
    method: "GET",
    headers: ua ? { "user-agent": ua } : {},
  });
}

describe("isLoopbackIp", () => {
  it("recognizes loopback forms", () => {
    expect(isLoopbackIp("::1")).toBe(true);
    expect(isLoopbackIp("127.0.0.1")).toBe(true);
    expect(isLoopbackIp("127.1.2.3")).toBe(true);
    expect(isLoopbackIp("::ffff:127.0.0.1")).toBe(true);
    expect(isLoopbackIp("localhost")).toBe(true);
  });
  it("rejects public IPs", () => {
    expect(isLoopbackIp("8.8.8.8")).toBe(false);
    expect(isLoopbackIp("203.0.113.7")).toBe(false);
    expect(isLoopbackIp("unknown")).toBe(false);
  });
});

describe("detectBot — loopback exemption", () => {
  it("NEVER blocks loopback, even for a known-bad bot UA with no headers", () => {
    // Same request that previously scored 70 and blocked ::1 for an hour.
    const res = detectBot(bareRequest("curl/8.7.1"), "::1");
    expect(res.action).toBe("allow");
    expect(res.score).toBe(0);
    expect(res.signals).toContain("loopback");
  });

  it("still blocks the same bot from a public IP", () => {
    const res = detectBot(bareRequest("curl/8.7.1"), "203.0.113.7");
    expect(res.action).toBe("block");
    expect(res.score).toBeGreaterThanOrEqual(70);
  });
});
