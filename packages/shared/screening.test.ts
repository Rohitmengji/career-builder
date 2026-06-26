/*
 * Unit tests for ./screening — knockout screening question parsing + evaluation
 * (pure logic).
 *
 * WHY: screening questions are yes/no "gates" that decide whether an applicant
 * passes an automated knockout. Parsing comes from untrusted/stored JSON so it
 * must be defensive, and evaluation has to fail safe: an unanswered gate must
 * count as a FAIL so a candidate can never pass by simply omitting an answer.
 *
 * Behaviors asserted:
 *  - parseScreeningQuestions: parses JSON string or array, defaults requiredAnswer
 *    to "yes", drops malformed entries, trims + caps label length, caps the number
 *    of questions at MAX_SCREENING_QUESTIONS, and returns [] for garbage input;
 *  - parseScreeningAnswers: keeps only index-keyed entries with yes/no values
 *    (rejects extra keys, arrays, bad JSON);
 *  - evaluateScreening: passes only when every answer matches its requiredAnswer
 *    (mismatch in either direction fails), a missing answer is a failed gate, and
 *    an empty question set passes vacuously. `failed` lists the question text.
 */
import { describe, it, expect } from "vitest";
import {
  parseScreeningQuestions,
  parseScreeningAnswers,
  evaluateScreening,
  MAX_SCREENING_QUESTIONS,
  type ScreeningQuestion,
} from "./screening";

describe("parseScreeningQuestions", () => {
  it("parses a JSON string and defaults requiredAnswer to yes", () => {
    const qs = parseScreeningQuestions(JSON.stringify([{ q: "Authorized to work?" }, { q: "Sponsorship?", requiredAnswer: "no" }]));
    expect(qs).toEqual([
      { q: "Authorized to work?", requiredAnswer: "yes" },
      { q: "Sponsorship?", requiredAnswer: "no" },
    ]);
  });

  it("drops malformed entries and trims/caps", () => {
    const qs = parseScreeningQuestions([{ q: "  ok  " }, { q: "" }, { q: 5 }, { foo: "bar" }, { q: "x".repeat(500) }]);
    expect(qs.map((q) => q.q)).toEqual(["ok", "x".repeat(300)]);
  });

  it("caps the number of questions", () => {
    const many = Array.from({ length: MAX_SCREENING_QUESTIONS + 5 }, (_, i) => ({ q: `q${i}` }));
    expect(parseScreeningQuestions(many)).toHaveLength(MAX_SCREENING_QUESTIONS);
  });

  it("returns [] for garbage / non-array / bad JSON", () => {
    expect(parseScreeningQuestions("not json")).toEqual([]);
    expect(parseScreeningQuestions(null)).toEqual([]);
    expect(parseScreeningQuestions({})).toEqual([]);
  });
});

describe("parseScreeningAnswers", () => {
  it("keeps only index keys with yes/no values", () => {
    expect(parseScreeningAnswers({ "0": "yes", "1": "no", "2": "maybe", foo: "yes" })).toEqual({ "0": "yes", "1": "no" });
  });
  it("parses JSON string form; rejects arrays/garbage", () => {
    expect(parseScreeningAnswers('{"0":"no"}')).toEqual({ "0": "no" });
    expect(parseScreeningAnswers("[1,2]")).toEqual({});
    expect(parseScreeningAnswers("nope")).toEqual({});
  });
});

describe("evaluateScreening", () => {
  const questions: ScreeningQuestion[] = [
    { q: "Authorized to work?", requiredAnswer: "yes" },
    { q: "Require sponsorship?", requiredAnswer: "no" },
  ];

  it("passes when every answer matches the required answer", () => {
    expect(evaluateScreening(questions, { "0": "yes", "1": "no" })).toEqual({ passed: true, failed: [] });
  });

  it("fails the gates whose answer differs (either direction)", () => {
    expect(evaluateScreening(questions, { "0": "no", "1": "no" })).toEqual({ passed: false, failed: ["Authorized to work?"] });
    expect(evaluateScreening(questions, { "0": "yes", "1": "yes" })).toEqual({ passed: false, failed: ["Require sponsorship?"] });
  });

  it("treats a missing answer as a failed gate (can't pass unanswered)", () => {
    expect(evaluateScreening(questions, { "0": "yes" })).toEqual({ passed: false, failed: ["Require sponsorship?"] });
    expect(evaluateScreening(questions, {})).toEqual({ passed: false, failed: questions.map((q) => q.q) });
  });

  it("passes vacuously when there are no questions", () => {
    expect(evaluateScreening([], {})).toEqual({ passed: true, failed: [] });
  });
});
