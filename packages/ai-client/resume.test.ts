import { describe, it, expect, vi, beforeEach } from "vitest";

const callAi = vi.fn();
vi.mock("./index", () => ({ callAi: (...a: unknown[]) => callAi(...a) }));

import { structureResume, RESUME_PROMPT, RESUME_PROMPT_VERSION } from "./resume";

const RESUME =
  "Jane Doe — jane@example.com — +1 555 123 4567\n" +
  "Senior Software Engineer with 8 years building distributed systems in Go and TypeScript.\n" +
  "BSc Computer Science, MIT.";

beforeEach(() => callAi.mockReset());

describe("structureResume — contract + fail-closed", () => {
  it("returns a validated, structured profile for well-formed output", async () => {
    callAi.mockResolvedValueOnce(
      JSON.stringify({
        summary: "Senior engineer focused on distributed systems.",
        skills: ["Go", "TypeScript", "Distributed Systems"],
        titles: ["Senior Software Engineer"],
        totalYearsExperience: 8,
        education: [{ credential: "BSc", field: "Computer Science", institution: "MIT" }],
      }),
    );
    const res = await structureResume(RESUME);
    expect(res.available).toBe(true);
    expect(res.skills).toContain("Go");
    expect(res.titles).toEqual(["Senior Software Engineer"]);
    expect(res.totalYearsExperience).toBe(8);
    expect(res.education[0]).toEqual({ credential: "BSc", field: "Computer Science", institution: "MIT" });
    expect(res.promptVersion).toBe(RESUME_PROMPT_VERSION);
  });

  it("tolerates a code-fence around the JSON", async () => {
    callAi.mockResolvedValueOnce('```json\n{"summary":"x","skills":[],"titles":[],"totalYearsExperience":null,"education":[]}\n```');
    const res = await structureResume(RESUME);
    expect(res.available).toBe(true);
    expect(res.totalYearsExperience).toBeNull();
  });

  it("FAILS CLOSED on non-JSON / malformed / out-of-range output", async () => {
    callAi.mockResolvedValueOnce("I can't do that.");
    expect((await structureResume(RESUME)).available).toBe(false);

    callAi.mockResolvedValueOnce(JSON.stringify({ summary: "x", skills: [], titles: [], totalYearsExperience: 999, education: [] }));
    expect((await structureResume(RESUME)).available).toBe(false); // years > 60

    callAi.mockResolvedValueOnce(JSON.stringify({ skills: [], titles: [] })); // missing fields
    expect((await structureResume(RESUME)).available).toBe(false);
  });

  it("FAILS CLOSED when the AI call throws", async () => {
    callAi.mockRejectedValueOnce(new Error("timeout"));
    expect((await structureResume(RESUME)).available).toBe(false);
  });

  it("returns unavailable (no AI call) for too-short input", async () => {
    const res = await structureResume("   short ");
    expect(res.available).toBe(false);
    expect(callAi).not.toHaveBeenCalled();
  });
});

describe("structureResume — privacy + hygiene", () => {
  it("strips contact PII before the text reaches the model + tells it to omit identity", async () => {
    callAi.mockResolvedValueOnce(JSON.stringify({ summary: "x", skills: [], titles: [], totalYearsExperience: null, education: [] }));
    await structureResume(RESUME);
    const [system, user, opts] = callAi.mock.calls[0];
    expect(user).not.toContain("jane@example.com");
    expect(user).not.toContain("555");
    expect(user).toContain("distributed systems");
    expect(system).toMatch(/do not include the person's name|name, email, phone/i);
    expect(opts).toMatchObject({ temperature: 0 });
  });

  it("de-duplicates skills and titles case-insensitively", async () => {
    callAi.mockResolvedValueOnce(
      JSON.stringify({
        summary: "x",
        skills: ["Go", "go", "GO", "TypeScript"],
        titles: ["Engineer", "engineer"],
        totalYearsExperience: null,
        education: [],
      }),
    );
    const res = await structureResume(RESUME);
    expect(res.skills).toEqual(["Go", "TypeScript"]);
    expect(res.titles).toEqual(["Engineer"]);
  });

  it("exposes a versioned prompt", () => {
    expect(RESUME_PROMPT.version).toBe(RESUME_PROMPT_VERSION);
    expect(RESUME_PROMPT.system()).toMatch(/STRUCTURED PROFILE/i);
  });
});
