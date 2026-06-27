/*
 * Contract tests for devils-advocate.ts — argueAgainst(). callAi mocked.
 * Asserts: schema-validated happy path; FAIL-CLOSED on garbage/thrown; the prompt is
 * grounded + fairness-scoped (no protected attributes, no fabrication) and the user
 * prompt contains NO candidate PII (only requirements + scores).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const callAi = vi.fn();
vi.mock("./index", () => ({ callAi: (...a: unknown[]) => callAi(...a) }));

import { argueAgainst, selectGroundingCriteria, DEVILS_ADVOCATE_PROMPT, DEVILS_ADVOCATE_PROMPT_VERSION } from "./devils-advocate";

const INPUT = {
  proposedDecision: "reject" as const,
  jobTitle: "Backend Engineer",
  requirements: ["5 years Go", "Distributed systems"],
  criteria: [{ criterion: "Coding", average: 4.5 }, { criterion: "System design", average: 2 }],
  recommendationSummary: "1 yes, 2 no",
};

beforeEach(() => callAi.mockReset());

describe("argueAgainst — contract + fail-closed", () => {
  it("returns validated counter-points for well-formed output", async () => {
    callAi.mockResolvedValueOnce(JSON.stringify({ points: [{ argument: "Strong coding (4.5) exceeds the bar; system-design gap may be coachable.", basis: "Coding 4.5 vs requirements" }], caution: "System-design score is genuinely low." }));
    const res = await argueAgainst(INPUT);
    expect(res.available).toBe(true);
    expect(res.proposedDecision).toBe("reject");
    expect(res.points).toHaveLength(1);
    expect(res.promptVersion).toBe(DEVILS_ADVOCATE_PROMPT_VERSION);
  });

  it("strips a ```json fence", async () => {
    callAi.mockResolvedValueOnce('```json\n{"points":[],"caution":"Evidence supports the lean."}\n```');
    expect((await argueAgainst(INPUT)).available).toBe(true);
  });

  it("FAILS CLOSED on non-JSON and on a thrown call", async () => {
    callAi.mockResolvedValueOnce("Sure!");
    expect((await argueAgainst(INPUT)).available).toBe(false);
    callAi.mockRejectedValueOnce(new Error("timeout"));
    expect((await argueAgainst(INPUT)).available).toBe(false);
  });

  it("the prompt is fairness-scoped (no protected attrs, no fabrication, grounded)", () => {
    const sys = DEVILS_ADVOCATE_PROMPT.system();
    expect(sys).toMatch(/protected attributes/i);
    expect(sys).toMatch(/Do not invent/i);
    expect(sys).toMatch(/OPPOSITE/);
  });

  it("the user prompt carries NO candidate PII (only requirements + scores)", () => {
    const user = DEVILS_ADVOCATE_PROMPT.user(INPUT);
    expect(user).toMatch(/5 years Go/);
    expect(user).toMatch(/Coding: 4.5/);
    expect(user).not.toMatch(/@/); // no emails / handles
  });
});

describe("selectGroundingCriteria — PII guard (drop off-rubric labels)", () => {
  const rubric = ["Coding", "System design"];

  it("keeps only criterion labels that are members of the canonical rubric", () => {
    const out = selectGroundingCriteria(
      [
        { criterion: "Coding", average: 4.5 },
        { criterion: "System design", average: 2 },
        // a recruiter smuggled PII into a free-text criterion label — must be DROPPED
        { criterion: "John Doe john@acme.com weak on SQL", average: 1 },
      ],
      rubric,
    );
    expect(out.map((c) => c.criterion)).toEqual(["Coding", "System design"]);
    expect(JSON.stringify(out)).not.toMatch(/@|John Doe/);
  });

  it("drops everything when the job has no rubric (fail-safe, no per-criterion grounding)", () => {
    expect(selectGroundingCriteria([{ criterion: "anything", average: 3 }], [])).toEqual([]);
  });
});
