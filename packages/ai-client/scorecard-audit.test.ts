/*
 * Contract tests for scorecard-audit.ts — auditScorecard(), which flags bias/
 * consistency problems in an interviewer's scorecard via the AI provider.
 *
 * WHY: flags nudge recruiters on a high-risk (employment) decision, so the provider
 * contract must be validated against a closed type/severity enum and FAIL CLOSED on
 * garbage. callAi is mocked to exercise prompt-build + parse + validate offline.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const callAi = vi.fn();
vi.mock("./index", () => ({ callAi: (...a: unknown[]) => callAi(...a) }));

import { auditScorecard, SCORECARD_AUDIT_PROMPT, SCORECARD_AUDIT_PROMPT_VERSION } from "./scorecard-audit";

const INPUT = {
  recommendation: "no",
  overallNotes: "Not a culture fit, gave me a bad vibe.",
  ratings: [{ criterion: "Coding", score: 5, comment: "Aced the exercise" }],
};

beforeEach(() => callAi.mockReset());

describe("auditScorecard — contract + fail-closed", () => {
  it("returns validated flags for well-formed output", async () => {
    callAi.mockResolvedValueOnce(
      JSON.stringify({
        flags: [
          { type: "biased_language", severity: "high", excerpt: "culture fit", why: "Not job-related.", suggestion: "Cite a specific job-related behavior." },
          { type: "score_comment_mismatch", severity: "medium", excerpt: "Aced the exercise / score 5 but overall 'no'", why: "Strong score, negative overall.", suggestion: "Reconcile the recommendation with the evidence." },
        ],
      }),
    );
    const res = await auditScorecard(INPUT);
    expect(res.available).toBe(true);
    expect(res.flags).toHaveLength(2);
    expect(res.flags[0].type).toBe("biased_language");
    expect(res.promptVersion).toBe(SCORECARD_AUDIT_PROMPT_VERSION);
  });

  it("strips a ```json code-fence before parsing", async () => {
    callAi.mockResolvedValueOnce('```json\n{"flags":[]}\n```');
    const res = await auditScorecard(INPUT);
    expect(res.available).toBe(true);
    expect(res.flags).toEqual([]);
  });

  it("FAILS CLOSED on non-JSON output", async () => {
    callAi.mockResolvedValueOnce("Sure, here is my analysis...");
    expect((await auditScorecard(INPUT)).available).toBe(false);
  });

  it("FAILS CLOSED on an out-of-enum flag type", async () => {
    callAi.mockResolvedValueOnce(JSON.stringify({ flags: [{ type: "made_up", severity: "high", excerpt: "x", why: "y", suggestion: "z" }] }));
    expect((await auditScorecard(INPUT)).available).toBe(false);
  });

  it("FAILS CLOSED when the AI call throws", async () => {
    callAi.mockRejectedValueOnce(new Error("timeout"));
    expect((await auditScorecard(INPUT)).available).toBe(false);
  });

  it("no written commentary → SUCCESS no-op with NO AI call", async () => {
    const res = await auditScorecard({ recommendation: "yes", overallNotes: "", ratings: [{ criterion: "Coding", score: 4, comment: "" }] });
    expect(res.available).toBe(true);
    expect(res.flags).toEqual([]);
    expect(callAi).not.toHaveBeenCalled();
  });

  it("the prompt scopes fairness (don't flag evidence-based; don't infer protected attrs)", () => {
    const sys = SCORECARD_AUDIT_PROMPT.system();
    expect(sys).toMatch(/job-related/i);
    expect(sys).toMatch(/protected attributes/i);
    expect(sys).toMatch(/When unsure, do NOT flag/i);
  });

  it("the user prompt includes scores + comments but is built from evaluation content only", () => {
    const user = SCORECARD_AUDIT_PROMPT.user(INPUT);
    expect(user).toMatch(/score 5\/5/);
    expect(user).toMatch(/culture fit/);
  });
});
