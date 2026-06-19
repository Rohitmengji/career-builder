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
