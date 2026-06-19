import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the DNS resolver before importing the module under test.
const resolveTxt = vi.fn();
vi.mock("node:dns/promises", () => ({ resolveTxt: (...a: unknown[]) => resolveTxt(...a) }));

import {
  planAllowsCustomDomain,
  isValidPublicHostname,
  verifyTxtHost,
  dnsInstructions,
  verifyDomainTxt,
} from "./domains";

beforeEach(() => resolveTxt.mockReset());

describe("planAllowsCustomDomain", () => {
  it("allows pro and enterprise only", () => {
    expect(planAllowsCustomDomain("pro")).toBe(true);
    expect(planAllowsCustomDomain("enterprise")).toBe(true);
    expect(planAllowsCustomDomain("free")).toBe(false);
    expect(planAllowsCustomDomain(null)).toBe(false);
    expect(planAllowsCustomDomain(undefined)).toBe(false);
  });
});

describe("isValidPublicHostname", () => {
  it("accepts real FQDNs", () => {
    expect(isValidPublicHostname("careers.acme.com")).toBe(true);
    expect(isValidPublicHostname("jobs.sub.acme.co.uk")).toBe(true);
  });
  it("rejects localhost, IPs, bare/invalid hosts", () => {
    expect(isValidPublicHostname("localhost")).toBe(false);
    expect(isValidPublicHostname("app.localhost")).toBe(false);
    expect(isValidPublicHostname("192.168.0.1")).toBe(false);
    expect(isValidPublicHostname("acme")).toBe(false); // no TLD
    expect(isValidPublicHostname("acme.123")).toBe(false); // numeric TLD
    expect(isValidPublicHostname("")).toBe(false);
  });
  it("normalizes scheme/path before validating", () => {
    expect(isValidPublicHostname("https://careers.acme.com/jobs")).toBe(true);
  });
});

describe("verifyTxtHost + dnsInstructions", () => {
  it("places the TXT record under _cb-verify", () => {
    expect(verifyTxtHost("careers.acme.com")).toBe("_cb-verify.careers.acme.com");
  });
  it("returns CNAME + TXT records", () => {
    const inst = dnsInstructions("careers.acme.com", "tok123");
    expect(inst.cname).toMatchObject({ type: "CNAME", host: "careers.acme.com" });
    expect(inst.txt).toMatchObject({ type: "TXT", host: "_cb-verify.careers.acme.com", value: "tok123" });
  });
});

describe("verifyDomainTxt", () => {
  it("returns true when the TXT record matches the token", async () => {
    resolveTxt.mockResolvedValueOnce([["tok123"]]);
    expect(await verifyDomainTxt("careers.acme.com", "tok123")).toBe(true);
  });
  it("matches across chunked TXT records", async () => {
    resolveTxt.mockResolvedValueOnce([["tok", "123"]]); // resolver may chunk
    expect(await verifyDomainTxt("careers.acme.com", "tok123")).toBe(true);
  });
  it("returns false when no record matches", async () => {
    resolveTxt.mockResolvedValueOnce([["something-else"]]);
    expect(await verifyDomainTxt("careers.acme.com", "tok123")).toBe(false);
  });
  it("returns false (no throw) when the lookup fails", async () => {
    resolveTxt.mockRejectedValueOnce(new Error("ENOTFOUND"));
    expect(await verifyDomainTxt("careers.acme.com", "tok123")).toBe(false);
  });
});
