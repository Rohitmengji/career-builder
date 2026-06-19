import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isEnabled } from "./feature-flags";

const SAVED = { ...process.env };

beforeEach(() => {
  // Clean slate so deploy-env + flag env vars are deterministic.
  delete process.env.VERCEL_ENV;
  process.env.NODE_ENV = "test";
});

afterEach(() => {
  process.env = { ...SAVED };
});

describe("feature-flags isEnabled", () => {
  it("multi_tenant_web is OFF by default (cutover is opt-in)", () => {
    expect(isEnabled("multi_tenant_web")).toBe(false);
  });

  it("env var overrides the default", () => {
    process.env.FEATURE_FLAG_MULTI_TENANT_WEB = "true";
    expect(isEnabled("multi_tenant_web")).toBe(true);
    process.env.FEATURE_FLAG_MULTI_TENANT_WEB = "0";
    expect(isEnabled("multi_tenant_web")).toBe(false);
  });

  it("per-tenant override wins over env + default", () => {
    process.env.FEATURE_FLAG_AI_CONTENT_GENERATION = "false";
    // env says false, tenant override says true → tenant wins
    expect(isEnabled("ai_content_generation", { ai_content_generation: true })).toBe(true);
    // env still applies when no tenant override for that flag
    expect(isEnabled("ai_content_generation")).toBe(false);
  });

  it("ignores a tenant override that isn't a boolean", () => {
    // a malformed settings blob shouldn't flip a flag
    expect(isEnabled("multi_tenant_web", { multi_tenant_web: undefined })).toBe(false);
  });

  it("unknown flags are disabled", () => {
    // @ts-expect-error — exercising the defensive default
    expect(isEnabled("does_not_exist")).toBe(false);
  });
});
