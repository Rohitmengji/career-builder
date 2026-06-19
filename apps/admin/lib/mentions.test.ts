import { describe, it, expect } from "vitest";
import { extractMentions, extractMentionIds, renderSegments, mentionToken } from "./mentions";

describe("extractMentions", () => {
  it("parses @[Name](id) tokens, deduping by userId", () => {
    const body = "cc @[Jane Doe](u_1) and @[Bob](u_2), again @[Jane Doe](u_1)";
    expect(extractMentions(body)).toEqual([
      { name: "Jane Doe", userId: "u_1" },
      { name: "Bob", userId: "u_2" },
    ]);
    expect(extractMentionIds(body)).toEqual(["u_1", "u_2"]);
  });

  it("returns nothing for plain text", () => {
    expect(extractMentions("just a normal note")).toEqual([]);
  });

  it("ignores a malformed token (no id)", () => {
    expect(extractMentions("hi @[Jane] not a real mention")).toEqual([]);
  });
});

describe("renderSegments", () => {
  it("splits body into text + mention segments in order", () => {
    expect(renderSegments("hi @[Jane](u_1)!")).toEqual([
      { type: "text", value: "hi " },
      { type: "mention", name: "Jane", userId: "u_1" },
      { type: "text", value: "!" },
    ]);
  });

  it("handles a body that is only a mention", () => {
    expect(renderSegments("@[Jane](u_1)")).toEqual([{ type: "mention", name: "Jane", userId: "u_1" }]);
  });
});

describe("mentionToken", () => {
  it("builds a token and strips bracket/paren chars from the name (no token breakout)", () => {
    expect(mentionToken("Jane (PM)]", "u_1")).toBe("@[Jane PM](u_1)");
  });
  it("falls back to 'user' when the name is empty after sanitizing", () => {
    expect(mentionToken("()]", "u_1")).toBe("@[user](u_1)");
  });
});
