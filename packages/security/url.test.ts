/*
 * Unit tests for validateUrl in ./url (SSRF + scheme guard).
 *
 * WHAT: Tests the URL validator used to vet any externally-supplied/outbound
 * URL (e.g. candidate profile links, resume URLs).
 * WHY: Untrusted URLs are an XSS (javascript:/data:) and SSRF (internal hosts)
 * vector; this guard is fail-closed, so the rejection cases are the point.
 * HOW: Asserts dangerous schemes (javascript:, data:) are rejected, https is
 * allowed by default, allowedProtocols can pin https-only (rejecting http),
 * an allowedHosts allowlist restricts the host, internal hostnames like
 * localhost are blocked, and malformed/empty input is rejected.
 */
import { describe, it, expect } from "vitest";
import { validateUrl } from "./url";

describe("validateUrl (SSRF / scheme guard)", () => {
  it("rejects javascript: and data: URIs", () => {
    expect(validateUrl("javascript:alert(1)").valid).toBe(false);
    expect(validateUrl("data:text/html,<script>").valid).toBe(false);
  });

  it("allows https by default", () => {
    expect(validateUrl("https://example.com/resume.pdf").valid).toBe(true);
  });

  it("enforces allowedProtocols (https-only rejects http)", () => {
    expect(validateUrl("http://example.com", { allowedProtocols: ["https:"] }).valid).toBe(false);
    expect(validateUrl("https://example.com", { allowedProtocols: ["https:"] }).valid).toBe(true);
  });

  it("enforces a host allowlist", () => {
    const opts = { allowedProtocols: ["https:"], allowedHosts: ["linkedin.com", "www.linkedin.com"] };
    expect(validateUrl("https://www.linkedin.com/in/jane", opts).valid).toBe(true);
    expect(validateUrl("https://evil.example.com/in/jane", opts).valid).toBe(false);
  });

  it("rejects internal hostnames", () => {
    expect(validateUrl("http://localhost/admin").valid).toBe(false);
  });

  it("rejects malformed input", () => {
    expect(validateUrl("").valid).toBe(false);
    expect(validateUrl("not a url").valid).toBe(false);
  });
});
