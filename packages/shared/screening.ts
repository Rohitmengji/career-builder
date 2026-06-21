/*
 * @career-builder/shared/screening — pure screening / knockout-question logic.
 *
 * A job can define yes/no screening questions, each with the answer required to
 * PASS (the "knockout" answer). At apply time the candidate answers them; if any
 * answer doesn't match the required one, the application is flagged as having
 * failed screening so recruiters can triage instantly. Pure + framework-agnostic
 * so the rules are unit-testable and reusable by both apps.
 *
 * v1 is yes/no only (answers are non-identifying — safe to show under blind
 * hiring). Answers are keyed by question INDEX so the config can be edited
 * without breaking stored answers' linkage to their text.
 */

export type ScreeningAnswer = "yes" | "no";

export interface ScreeningQuestion {
  /** The question text shown to the candidate. */
  q: string;
  /** The answer the candidate must give to pass this gate. */
  requiredAnswer: ScreeningAnswer;
}

export interface ScreeningResult {
  /** true only when every question was answered with its required answer. */
  passed: boolean;
  /** Texts of the questions the candidate failed (for recruiter context). */
  failed: string[];
}

/** What we persist on the application (self-contained for display). */
export interface StoredScreening extends ScreeningResult {
  answers: Record<string, ScreeningAnswer>;
}

export const MAX_SCREENING_QUESTIONS = 15;
export const MAX_QUESTION_LEN = 300;

function isAnswer(v: unknown): v is ScreeningAnswer {
  return v === "yes" || v === "no";
}

/**
 * Parse + validate a screening-questions config from unknown input (JSON string
 * or array). Drops malformed entries; caps the count. Never throws.
 */
export function parseScreeningQuestions(raw: unknown): ScreeningQuestion[] {
  let value = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  const out: ScreeningQuestion[] = [];
  for (const item of value) {
    const q = (item as { q?: unknown })?.q;
    const requiredAnswer = (item as { requiredAnswer?: unknown })?.requiredAnswer;
    if (typeof q !== "string") continue;
    const text = q.trim().slice(0, MAX_QUESTION_LEN);
    if (!text) continue;
    out.push({ q: text, requiredAnswer: isAnswer(requiredAnswer) ? requiredAnswer : "yes" });
    if (out.length >= MAX_SCREENING_QUESTIONS) break;
  }
  return out;
}

/** Normalize an answers map (from client input) to a clean { index: "yes"|"no" }. */
export function parseScreeningAnswers(raw: unknown): Record<string, ScreeningAnswer> {
  let value = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, ScreeningAnswer> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (/^\d+$/.test(k) && isAnswer(v)) out[k] = v;
  }
  return out;
}

/**
 * Evaluate answers against the questions. A question fails if its answer is
 * missing or doesn't equal the required answer. Passing requires ALL gates met.
 */
export function evaluateScreening(
  questions: ScreeningQuestion[],
  answers: Record<string, ScreeningAnswer>,
): ScreeningResult {
  const failed: string[] = [];
  questions.forEach((question, i) => {
    if (answers[String(i)] !== question.requiredAnswer) failed.push(question.q);
  });
  return { passed: failed.length === 0, failed };
}
