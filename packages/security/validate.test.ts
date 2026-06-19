import { describe, it, expect } from "vitest";
import { loginSchema, createApplicationSchema, saveTenantSchema, safeParse } from "./validate";

describe("validate schemas", () => {
  it("loginSchema accepts valid and rejects invalid", () => {
    expect(safeParse(loginSchema, { email: "a@b.com", password: "secret" }).success).toBe(true);
    expect(safeParse(loginSchema, { email: "nope", password: "" }).success).toBe(false);
  });

  it("createApplicationSchema requires core fields", () => {
    const ok = safeParse(createApplicationSchema, {
      jobId: "job_1", firstName: "Jane", lastName: "Doe", email: "jane@x.com",
    });
    expect(ok.success).toBe(true);
    expect(safeParse(createApplicationSchema, { firstName: "Jane" }).success).toBe(false);
  });

  it("saveTenantSchema strips unknown keys (no passthrough)", () => {
    const res = safeParse(saveTenantSchema, { id: "acme", name: "Acme", evil: "<script>", __proto__: {} });
    expect(res.success).toBe(true);
    if (res.success) {
      expect("evil" in (res.data as Record<string, unknown>)).toBe(false);
    }
  });
});
