/*
 * Tests for shared/saved-view — the filter whitelist + sanitizer.
 * Asserts the security contract: only whitelisted keys survive, types are
 * coerced, tags are bounded/deduped, and garbage JSON parses to {} (never throws).
 */

import { describe, it, expect } from "vitest";
import { pickViewFilters, parseViewFilters, serializeViewFilters, SAVED_VIEW_FILTER_KEYS } from "./saved-view";

describe("pickViewFilters", () => {
  it("keeps only whitelisted keys and drops everything else", () => {
    const out = pickViewFilters({
      status: "interview",
      jobId: "job_1",
      q: "react",
      department: "Eng",
      tags: ["t1", "t2"],
      // hostile / unknown keys must be dropped:
      tenantId: "other-tenant",
      OR: [{ email: "x" }],
      __proto__: { polluted: true },
    });
    expect(Object.keys(out).sort()).toEqual(["department", "jobId", "q", "status", "tags"]);
    expect(out.tags).toEqual(["t1", "t2"]);
  });

  it("drops empty/whitespace strings and bad types", () => {
    const out = pickViewFilters({ status: "   ", jobId: 42, q: "", department: null });
    expect(out).toEqual({});
  });

  it("bounds, trims, and de-dupes tags", () => {
    const out = pickViewFilters({ tags: [" a ", "a", "b", 7, "", "c"] });
    expect(out.tags).toEqual(["a", "b", "c"]);
  });

  it("returns {} for non-objects", () => {
    expect(pickViewFilters(null)).toEqual({});
    expect(pickViewFilters("nope")).toEqual({});
    expect(pickViewFilters(123)).toEqual({});
  });

  it("the whitelist is exactly the documented set", () => {
    expect([...SAVED_VIEW_FILTER_KEYS].sort()).toEqual(["department", "jobId", "q", "status", "tags"]);
  });
});

describe("parseViewFilters", () => {
  it("round-trips a serialized view", () => {
    const json = serializeViewFilters({ status: "hired", tags: ["x"] });
    expect(parseViewFilters(json)).toEqual({ status: "hired", tags: ["x"] });
  });
  it("returns {} on null/garbage (never throws)", () => {
    expect(parseViewFilters(null)).toEqual({});
    expect(parseViewFilters("{not json")).toEqual({});
  });
});
