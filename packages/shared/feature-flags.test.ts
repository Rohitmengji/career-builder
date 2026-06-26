/*
 * Unit tests for isEnabled in ./feature-flags — the flag-gating helper every
 * new feature ships behind (default-OFF; see CLAUDE.md / packages/shared
 * feature-flags pattern).
 *
 * WHY: features must be off by default and only turned on deliberately, and a
 * per-tenant setting must be able to override the global env. Getting the
 * resolution order wrong would either leak unfinished features or make a tenant
 * opt-in silently ineffective.
 *
 * Behaviors asserted (resolution precedence: tenant override > env var > default):
 *  - flags are OFF by default (multi_tenant_web cutover is opt-in);
 *  - a FEATURE_FLAG_* env var overrides the default ("true" on, "0" off);
 *  - a per-tenant override beats both env and default, but env still applies to
 *    flags the tenant didn't override;
 *  - a non-boolean tenant override is ignored (a malformed settings blob can't
 *    flip a flag);
 *  - unknown flag keys resolve to disabled (defensive default).
 *
 * beforeEach/afterEach snapshot and restore process.env so env-driven cases are
 * deterministic and isolated from the real environment.
 */
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
