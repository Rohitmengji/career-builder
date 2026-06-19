import { describe, it, expect } from "vitest";
import { loginSchema, createApplicationSchema, saveTenantSchema, bulkApplicationActionSchema, safeParse } from "./validate";

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

  it("bulkApplicationActionSchema bounds the id list and validates the action", () => {
    expect(safeParse(bulkApplicationActionSchema, { ids: ["app_1", "app_2"], action: "export" }).success).toBe(true);
    expect(safeParse(bulkApplicationActionSchema, { ids: ["a"], action: "status", status: "screening" }).success).toBe(true);
    // empty id list rejected
    expect(safeParse(bulkApplicationActionSchema, { ids: [], action: "export" }).success).toBe(false);
    // unknown action rejected
    expect(safeParse(bulkApplicationActionSchema, { ids: ["a"], action: "nuke" }).success).toBe(false);
    // over the 100 cap rejected
    const tooMany = Array.from({ length: 101 }, (_, i) => `app_${i}`);
    expect(safeParse(bulkApplicationActionSchema, { ids: tooMany, action: "export" }).success).toBe(false);
  });
});
