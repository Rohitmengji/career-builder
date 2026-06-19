import { describe, it, expect } from "vitest";
import { validateCsrf } from "./middleware";

function req(headers: Record<string, string>) {
  return new Request("http://localhost/api/x", { method: "POST", headers });
}

describe("validateCsrf", () => {
  it("accepts a same-origin request (Origin host matches)", () => {
    expect(validateCsrf(req({ origin: "http://localhost", host: "localhost" })).valid).toBe(true);
  });

  it("rejects a cross-origin request (Origin mismatch)", () => {
    expect(validateCsrf(req({ origin: "https://evil.example.com", host: "localhost" })).valid).toBe(false);
  });

  it("rejects a cross-site request via Sec-Fetch-Site when no Origin", () => {
    expect(validateCsrf(req({ "sec-fetch-site": "cross-site", host: "localhost" })).valid).toBe(false);
  });

  it("accepts a valid double-submit token (no origin/referer)", () => {
    const r = validateCsrf(req({ host: "localhost", cookie: "cb_csrf=tok123", "x-csrf-token": "tok123" }));
    expect(r.valid).toBe(true);
  });

  it("rejects a mismatched double-submit token", () => {
    const r = validateCsrf(req({ host: "localhost", cookie: "cb_csrf=tok123", "x-csrf-token": "different" }));
    expect(r.valid).toBe(false);
  });

  it("rejects a request with no same-origin signal and no token", () => {
    expect(validateCsrf(req({ host: "localhost" })).valid).toBe(false);
  });
});
