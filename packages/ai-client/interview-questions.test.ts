/*
 * Contract tests for interview-questions.ts — generateInterviewQuestions(). callAi mocked.
 * Asserts: schema-validated happy path; fence tolerance; FAIL-CLOSED on garbage/throw;
 * prompt is fairness-scoped (forbids protected attributes, structured/evidence-based,
 * rubric-grounded) and the user prompt carries NO candidate PII.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const callAi = vi.fn();
vi.mock("./index", () => ({ callAi: (...a: unknown[]) => callAi(...a) }));

import { generateInterviewQuestions, INTERVIEW_QUESTIONS_PROMPT, INTERVIEW_QUESTIONS_PROMPT_VERSION } from "./interview-questions";

const INPUT = {
  jobTitle: "Backend Engineer",
  requirements: ["5 years Go", "Distributed systems"],
  rubricCriteria: ["Coding", "System design"],
  level: "senior",
};

beforeEach(() => callAi.mockReset());

describe("generateInterviewQuestions — contract + fail-closed", () => {
  it("returns validated questions for well-formed output", async () => {
    callAi.mockResolvedValueOnce(JSON.stringify({ items: [
      { criterion: "Coding", question: "Walk through a recent Go service you built.", lookFor: "Concrete design choices + trade-offs." },
    ] }));
    const res = await generateInterviewQuestions(INPUT);
    expect(res.available).toBe(true);
    expect(res.items).toHaveLength(1);
    expect(res.items[0].criterion).toBe("Coding");
    expect(res.promptVersion).toBe(INTERVIEW_QUESTIONS_PROMPT_VERSION);
  });

  it("tolerates a ```json fence", async () => {
    callAi.mockResolvedValueOnce('```json\n{"items":[{"criterion":"Coding","question":"Q?","lookFor":"evidence"}]}\n```');
    expect((await generateInterviewQuestions(INPUT)).available).toBe(true);
  });

  it("FAILS CLOSED on non-JSON, a thrown call, AND an empty item list", async () => {
    callAi.mockResolvedValueOnce("Sure, here are some questions!");
    expect((await generateInterviewQuestions(INPUT)).available).toBe(false);
    callAi.mockRejectedValueOnce(new Error("timeout"));
    expect((await generateInterviewQuestions(INPUT)).available).toBe(false);
    // Empty list = failed generation, not a success → unavailable (so it's never cached).
    callAi.mockResolvedValueOnce(JSON.stringify({ items: [] }));
    expect((await generateInterviewQuestions(INPUT)).available).toBe(false);
  });

  it("prompt is fairness-scoped (forbids protected attributes; structured + grounded)", () => {
    const sys = INTERVIEW_QUESTIONS_PROMPT.system();
    expect(sys).toMatch(/protected/i);
    expect(sys).toMatch(/age, gender, race/i);
    expect(sys).toMatch(/salary history/i);
    expect(sys).toMatch(/rubric/i);
  });

  it("user prompt carries the rubric + requirements but NO candidate PII", () => {
    const user = INTERVIEW_QUESTIONS_PROMPT.user(INPUT);
    expect(user).toMatch(/5 years Go/);
    expect(user).toMatch(/System design/);
    expect(user).not.toMatch(/@/); // no emails / handles
  });

  it("handles a job with no rubric (role-level questions from requirements)", () => {
    const user = INTERVIEW_QUESTIONS_PROMPT.user({ ...INPUT, rubricCriteria: [] });
    expect(user).toMatch(/no rubric defined/i);
  });
});
