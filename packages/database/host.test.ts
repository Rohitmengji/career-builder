/*
 * Unit tests for normalizeHostname — canonicalizes a raw host string before it's used
 * to resolve a tenant by custom domain.
 *
 * WHY: Custom-domain lookups key on the hostname, so two spellings of the same host must
 * collapse to one value or domain routing breaks / mis-resolves the tenant. Asserts it
 * lowercases and strips scheme/path/port/trailing dots, and is idempotent (re-normalizing
 * an already-normalized host is a no-op).
 */
import { describe, it, expect } from "vitest";
import { normalizeHostname } from "./host";

describe("normalizeHostname", () => {
  it("lowercases and strips scheme/path/port/trailing dots", () => {
    expect(normalizeHostname("https://Careers.Acme.com/jobs")).toBe("careers.acme.com");
    expect(normalizeHostname("careers.acme.com:443")).toBe("careers.acme.com");
    expect(normalizeHostname("  ACME.com.  ")).toBe("acme.com");
  });

  it("is idempotent", () => {
    const once = normalizeHostname("HTTPS://X.Example.com/");
    expect(normalizeHostname(once)).toBe(once);
  });
});
