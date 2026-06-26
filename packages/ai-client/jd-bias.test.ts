/*
 * Contract tests for jd-bias.ts — detectJdBias(), which flags biased phrasing
 * (age/gendered/etc.) in a job description via the AI provider.
 *
 * WHY: findings are shown to recruiters editing a JD, so the provider contract
 * must be validated against a closed category enum and fail closed on garbage.
 *
 * HOW: callAi (./index) is mocked to exercise prompt-build + parse + validate
 * without a network call. Behaviors asserted:
 *  - Schema-validated happy path → available:true with the findings array.
 *  - Tolerant parse: strips a ```json code-fence before JSON.parse.
 *  - FAIL-CLOSED: non-JSON, an out-of-enum `category`, or a thrown AI call all
 *    yield available:false.
 *  - Short/empty input is a no-op SUCCESS (available:true, findings:[]) with NO
 *    AI call — note this differs from the other engines, which return
 *    unavailable on empty input.
 *  - The prompt scopes fairness: instructs the model NOT to flag legitimate
 *    requirements and to target protected-group bias.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const callAi = vi.fn();
vi.mock("./index", () => ({ callAi: (...a: unknown[]) => callAi(...a) }));

import { detectJdBias, JD_BIAS_PROMPT, JD_BIAS_PROMPT_VERSION } from "./jd-bias";

const JD = "We're looking for a young, energetic salesman who is a culture fit. 5 years of Go required.";

beforeEach(() => callAi.mockReset());

describe("detectJdBias — contract + fail-closed", () => {
  it("returns validated findings for well-formed output", async () => {
    callAi.mockResolvedValueOnce(
      JSON.stringify({
        findings: [
          { phrase: "young", category: "age", suggestion: "Remove age descriptors." },
          { phrase: "salesman", category: "gendered", suggestion: "Use 'salesperson'." },
        ],
      }),
    );
    const res = await detectJdBias(JD);
    expect(res.available).toBe(true);
    expect(res.findings).toHaveLength(2);
    expect(res.findings[0]).toEqual({ phrase: "young", category: "age", suggestion: "Remove age descriptors." });
    expect(res.promptVersion).toBe(JD_BIAS_PROMPT_VERSION);
  });

  it("tolerates a code-fence around the JSON", async () => {
    callAi.mockResolvedValueOnce('```json\n{"findings":[]}\n```');
    const res = await detectJdBias(JD);
    expect(res.available).toBe(true);
    expect(res.findings).toEqual([]);
  });

  it("FAILS CLOSED on non-JSON / malformed / out-of-enum output", async () => {
    callAi.mockResolvedValueOnce("I cannot help with that.");
    expect((await detectJdBias(JD)).available).toBe(false);
    callAi.mockResolvedValueOnce(JSON.stringify({ findings: [{ phrase: "x", category: "totally_made_up", suggestion: "y" }] }));
    expect((await detectJdBias(JD)).available).toBe(false);
  });

  it("FAILS CLOSED (available:false) when the model call throws", async () => {
    callAi.mockRejectedValueOnce(new Error("timeout"));
    expect((await detectJdBias(JD)).available).toBe(false);
  });

  it("short/empty input returns available with no findings (no model call)", async () => {
    const res = await detectJdBias("  ");
    expect(res).toEqual({ available: true, findings: [], promptVersion: JD_BIAS_PROMPT_VERSION });
    expect(callAi).not.toHaveBeenCalled();
  });

  it("the prompt instructs fairness scoping (don't flag legitimate requirements)", () => {
    const sys = JD_BIAS_PROMPT.system();
    expect(sys).toMatch(/Do NOT flag legitimate/i);
    expect(sys).toMatch(/protected group/i);
  });
});
