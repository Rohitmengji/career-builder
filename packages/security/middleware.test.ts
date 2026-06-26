/*
 * Unit tests for validateCsrf in ./middleware.
 *
 * WHAT: Contract tests for the CSRF guard that every admin write goes through
 * (getSession() + validateCsrf, per the repo invariant).
 * WHY: CSRF protection is enforced in app code, so this guard's accept/reject
 * decisions are load-bearing; the assertions pin down exactly which signals
 * count as same-origin vs. forged.
 * HOW: Builds bare POST Requests with hand-set headers and asserts the layered
 * checks — Origin host must match Host; Sec-Fetch-Site: cross-site is rejected
 * when no Origin is present; otherwise a double-submit cookie/header pair
 * (cb_csrf cookie === x-csrf-token) must match. A request with no same-origin
 * signal AND no token is rejected (fail-closed default).
 */
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
