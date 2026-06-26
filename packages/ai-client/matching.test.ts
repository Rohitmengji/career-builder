/*
 * Contract tests for matching.ts — the candidate↔role match-scoring engine
 * behind the "Right-to-Explanation" feature.
 *
 * WHY: scoreMatch() drives a candidate-facing explanation, so its AI-provider
 * contract must be locked down. These tests pin the four standards from the
 * Honest Hiring brief §3.4 so a regression in the prompt/parse layer can't ship.
 *
 * HOW: callAi (from ./index, the server-only provider caller) is mocked so we
 * exercise the prompt-build + parse + validate pipeline without a real network
 * call. Behaviors asserted:
 *  - Schema-validated happy path: well-formed JSON → validated result, score
 *    banded (>=80 strong / 60–79 good), citations resolved to requirement text.
 *  - Tolerant parse: strips code-fences / surrounding prose before JSON.parse.
 *  - FAIL-CLOSED: non-JSON, out-of-range/wrong-type/missing fields, or a thrown
 *    AI call all yield available:false with nulls — raw model text is NEVER
 *    surfaced to a candidate.
 *  - Anti-hallucination: gaps/strengths citing a reqIndex outside the real
 *    (requirements + niceToHave) list are dropped (gaps) or kept text-only
 *    (strengths); index maps across the combined list.
 *  - Fairness/input guards: no identity fields reach the model, contact PII is
 *    stripped first, temperature 0 (deterministic), and empty background or a
 *    role with no requirements short-circuits with NO AI call.
 *  - Versioned prompt embeds requirements as a numbered, citable 0-based list.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the AI caller before importing the scoring service (hoisted by vitest).
// The factory references `callAi` lazily — by test runtime it is initialized.
const callAi = vi.fn();
vi.mock("./index", () => ({
  callAi: (...args: unknown[]) => callAi(...args),
}));

import { scoreMatch, stripContactPii, SCORING_PROMPT, SCORING_PROMPT_VERSION } from "./matching";

const REQS = ["10+ years TypeScript", "Built distributed systems", "Led a team"];
const NICE = ["Open-source contributions"];

beforeEach(() => {
  callAi.mockReset();
});

describe("scoreMatch — AI contract (schema-validated, fail-closed)", () => {
  it("returns a validated result for well-formed model output", async () => {
    callAi.mockResolvedValueOnce(
      JSON.stringify({
        score: 72,
        strengths: [{ text: "Strong TS background", reqIndex: 0 }],
        gaps: [{ text: "No team leadership shown", reqIndex: 2 }],
      }),
    );
    const res = await scoreMatch({ resumeText: "Senior engineer, 6 years TS.", requirements: REQS, niceToHave: NICE });
    expect(res.available).toBe(true);
    expect(res.score).toBe(72);
    expect(res.band).toBe("good"); // 60–79
    expect(res.strengths).toEqual([{ text: "Strong TS background", requirement: "10+ years TypeScript" }]);
    expect(res.gaps).toEqual([{ text: "No team leadership shown", requirement: "Led a team" }]);
    expect(res.promptVersion).toBe(SCORING_PROMPT_VERSION);
  });

  it("tolerates a code-fence / surrounding prose around the JSON", async () => {
    callAi.mockResolvedValueOnce(
      'Here is the result:\n```json\n{"score": 90, "strengths": [], "gaps": []}\n```',
    );
    const res = await scoreMatch({ resumeText: "x".repeat(40), requirements: REQS });
    expect(res.available).toBe(true);
    expect(res.score).toBe(90);
    expect(res.band).toBe("strong"); // >= 80
  });

  it("FAILS CLOSED on non-JSON output (never surfaces raw model text)", async () => {
    callAi.mockResolvedValueOnce("I cannot help with that.");
    const res = await scoreMatch({ resumeText: "x".repeat(40), requirements: REQS });
    expect(res.available).toBe(false);
    expect(res.score).toBeNull();
    expect(res.band).toBeNull();
    expect(res.strengths).toEqual([]);
    expect(res.gaps).toEqual([]);
  });

  it("FAILS CLOSED on out-of-contract output (score over range / wrong types)", async () => {
    callAi.mockResolvedValueOnce(JSON.stringify({ score: 150, strengths: [], gaps: [] }));
    const over = await scoreMatch({ resumeText: "x".repeat(40), requirements: REQS });
    expect(over.available).toBe(false);

    callAi.mockResolvedValueOnce(JSON.stringify({ score: "high", strengths: [], gaps: [] }));
    const wrongType = await scoreMatch({ resumeText: "x".repeat(40), requirements: REQS });
    expect(wrongType.available).toBe(false);

    callAi.mockResolvedValueOnce(JSON.stringify({ strengths: [], gaps: [] })); // missing score
    const missing = await scoreMatch({ resumeText: "x".repeat(40), requirements: REQS });
    expect(missing.available).toBe(false);
  });

  it("FAILS CLOSED when the AI call throws (timeout / provider error / no key)", async () => {
    callAi.mockRejectedValueOnce(new Error("AI request timed out. Please try again."));
    const res = await scoreMatch({ resumeText: "x".repeat(40), requirements: REQS });
    expect(res.available).toBe(false);
    expect(res.score).toBeNull();
  });
});

describe("scoreMatch — anti-hallucination (citations must be real)", () => {
  it("drops gaps that cite a requirement index outside the real list", async () => {
    callAi.mockResolvedValueOnce(
      JSON.stringify({
        score: 50,
        strengths: [],
        gaps: [
          { text: "Real gap", reqIndex: 1 },
          { text: "Invented requirement", reqIndex: 99 }, // out of range — must be dropped
          { text: "Negative index", reqIndex: -1 }, // invalid — must be dropped
        ],
      }),
    );
    const res = await scoreMatch({ resumeText: "x".repeat(40), requirements: REQS });
    expect(res.available).toBe(true);
    expect(res.gaps).toEqual([{ text: "Real gap", requirement: "Built distributed systems" }]);
  });

  it("keeps strengths but strips an out-of-range citation (text survives, requirement omitted)", async () => {
    callAi.mockResolvedValueOnce(
      JSON.stringify({
        score: 65,
        strengths: [
          { text: "Grounded strength", reqIndex: 0 },
          { text: "Ungrounded strength", reqIndex: 42 },
          { text: "No citation strength" },
        ],
        gaps: [],
      }),
    );
    const res = await scoreMatch({ resumeText: "x".repeat(40), requirements: REQS });
    expect(res.strengths).toEqual([
      { text: "Grounded strength", requirement: "10+ years TypeScript" },
      { text: "Ungrounded strength", requirement: undefined },
      { text: "No citation strength", requirement: undefined },
    ]);
  });

  it("maps citation indices across the combined requirements + niceToHave list", async () => {
    // index 3 = first niceToHave entry (after 3 hard requirements)
    callAi.mockResolvedValueOnce(
      JSON.stringify({ score: 80, strengths: [{ text: "OSS", reqIndex: 3 }], gaps: [] }),
    );
    const res = await scoreMatch({ resumeText: "x".repeat(40), requirements: REQS, niceToHave: NICE });
    expect(res.strengths[0]).toEqual({ text: "OSS", requirement: "Open-source contributions" });
  });
});

describe("scoreMatch — fairness & input guards (no identity, deterministic)", () => {
  it("never passes identity fields to the model — only background + requirements", async () => {
    callAi.mockResolvedValueOnce(JSON.stringify({ score: 50, strengths: [], gaps: [] }));
    await scoreMatch({ resumeText: "8 years building APIs", requirements: REQS });

    const [system, user, opts] = callAi.mock.calls[0];
    // The system prompt instructs the model to ignore demographics...
    expect(system).toMatch(/IGNORE/i);
    expect(system).toMatch(/name, gender, age/i);
    // ...and the inputs contain ONLY the role requirements + the pasted background.
    expect(user).toContain("8 years building APIs");
    expect(system).toContain("10+ years TypeScript");
    // Deterministic scoring.
    expect(opts).toMatchObject({ temperature: 0 });
  });

  it("strips contact identifiers from the text before it reaches the model", async () => {
    callAi.mockResolvedValueOnce(JSON.stringify({ score: 50, strengths: [], gaps: [] }));
    await scoreMatch({
      resumeText:
        "Jane Doe — jane.doe@example.com, +1 (555) 123-4567. https://janedoe.dev. 8 years building APIs.",
      requirements: REQS,
    });
    const [, user] = callAi.mock.calls[0];
    expect(user).not.toContain("jane.doe@example.com");
    expect(user).not.toContain("555");
    expect(user).not.toContain("janedoe.dev");
    // The actual experience signal survives.
    expect(user).toContain("8 years building APIs");
  });

  it("stripContactPii removes emails, phones, urls, and ssn — keeps skills", () => {
    const cleaned = stripContactPii(
      "Contact: a.b+x@mail.co, tel 555-123-4567, ssn 123-45-6789, site www.me.io — Senior Go engineer",
    );
    expect(cleaned).not.toMatch(/a\.b\+x@mail\.co/);
    expect(cleaned).not.toMatch(/555-123-4567/);
    expect(cleaned).not.toMatch(/123-45-6789/);
    expect(cleaned).not.toMatch(/www\.me\.io/);
    expect(cleaned).toContain("Senior Go engineer");
  });

  it("returns unavailable (no AI call) when there is no background text", async () => {
    const res = await scoreMatch({ resumeText: "   ", requirements: REQS });
    expect(res.available).toBe(false);
    expect(callAi).not.toHaveBeenCalled();
  });

  it("returns unavailable (no AI call) when the role has no requirements", async () => {
    const res = await scoreMatch({ resumeText: "x".repeat(40), requirements: [], niceToHave: [] });
    expect(res.available).toBe(false);
    expect(callAi).not.toHaveBeenCalled();
  });

  it("versioned prompt embeds the requirements as a numbered, citable list", () => {
    const sys = SCORING_PROMPT.system(REQS);
    expect(SCORING_PROMPT.version).toBe(SCORING_PROMPT_VERSION);
    expect(sys).toContain("0. 10+ years TypeScript");
    expect(sys).toContain("2. Led a team");
  });
});
