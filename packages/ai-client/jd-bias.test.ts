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
