/*
 * @career-builder/ai-client/interview-questions — rubric-grounded interview questions (ADR-0034).
 *
 * Generates structured, job-related interview questions aligned to a job's scorecard
 * rubric, so interviewers ask CONSISTENT, evidence-seeking questions instead of ad-hoc
 * ones — the single most reliable debiasing move in hiring research (structured > unstructured
 * interviews). Reinforces the scorecard (ADR-0007) + evidence-coverage (ADR-0031) thesis:
 * each question is tied to a rubric criterion and says what a strong, EVIDENCE-BASED answer
 * looks like. Input is JOB-LEVEL only (title/requirements/rubric) — NO candidate PII.
 *
 * Same hardened contract as the other engines: versioned prompt, low-ish temperature,
 * zod-schema-validated output, code-fence-tolerant, FAIL-CLOSED. Fairness-scoped: the
 * prompt forbids protected attributes and legally-risky (non-job-related) questions.
 */

import { z } from "zod";
import { callAi } from "./index";

export const INTERVIEW_QUESTIONS_PROMPT_VERSION = "interview-questions-v1";

export interface InterviewQuestionsInput {
  jobTitle: string;
  requirements: string[];
  /** Scorecard rubric criterion labels (ADR-0007) — questions are aligned to these. */
  rubricCriteria: string[];
  level?: string;
}

export interface InterviewQuestion {
  /** The rubric criterion this question assesses (or "general" for role-level). */
  criterion: string;
  question: string;
  /** What a strong, evidence-based answer demonstrates (anchors fair scoring). */
  lookFor: string;
}

export interface InterviewQuestionsResult {
  available: boolean;
  items: InterviewQuestion[];
  promptVersion: string;
}

const ModelOutput = z.object({
  items: z
    .array(
      z.object({
        criterion: z.string().min(1).max(120),
        question: z.string().min(1).max(500),
        lookFor: z.string().min(1).max(500),
      }),
    )
    .max(40),
});

function unavailable(): InterviewQuestionsResult {
  return { available: false, items: [], promptVersion: INTERVIEW_QUESTIONS_PROMPT_VERSION };
}

export const INTERVIEW_QUESTIONS_PROMPT = {
  version: INTERVIEW_QUESTIONS_PROMPT_VERSION,
  system(): string {
    return [
      "You write structured, fair, job-related interview questions for a hiring team.",
      "Goal: consistent, evidence-seeking questions tied to the job's evaluation rubric —",
      "structured interviews are the most reliable way to reduce hiring bias.",
      "",
      "Rules:",
      "- Produce 1-2 questions PER rubric criterion, each clearly assessing that criterion,",
      "  plus a few role-level questions (criterion: \"general\") grounded in the requirements.",
      "- Prefer behavioral / competency / work-sample questions ('Tell me about a time…',",
      "  'How would you approach…') over trivia.",
      "- For each, give 'lookFor': what a strong, EVIDENCE-BASED answer demonstrates, so",
      "  interviewers score on evidence, not gut feel.",
      "- STRICTLY job-related only. NEVER ask about (or hint at) protected or non-job",
      "  attributes: age, gender, race, religion, national origin, marital/family status,",
      "  pregnancy, disability, health, sexual orientation, or salary history.",
      "- Ground every question in the provided requirements/rubric; do not invent unrelated",
      "  technologies or facts.",
      "",
      'Return STRICT JSON only: {"items": [{"criterion": string, "question": string,',
      ' "lookFor": string}]}. No prose outside the JSON.',
    ].join("\n");
  },
  user(input: InterviewQuestionsInput): string {
    const lines = [
      `Role: ${input.jobTitle}${input.level ? ` (${input.level})` : ""}`,
      "",
      "Requirements:",
      ...input.requirements.slice(0, 30).map((r) => `- ${r}`),
      "",
      "Evaluation rubric criteria (write questions for each):",
      ...(input.rubricCriteria.length
        ? input.rubricCriteria.slice(0, 20).map((c) => `- ${c}`)
        : ["- (no rubric defined — produce role-level questions from the requirements)"]),
    ];
    return lines.join("\n").slice(0, 8000);
  },
};

function safeJson(raw: string): unknown {
  try { return JSON.parse(raw); } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try { return JSON.parse(m[0]); } catch { return null; }
  }
}

/** Generate rubric-grounded interview questions. Never throws; fail-closed on any error. */
export async function generateInterviewQuestions(
  input: InterviewQuestionsInput,
  opts?: { timeoutMs?: number },
): Promise<InterviewQuestionsResult> {
  let raw: string;
  try {
    raw = await callAi(INTERVIEW_QUESTIONS_PROMPT.system(), INTERVIEW_QUESTIONS_PROMPT.user(input), {
      temperature: 0.4,
      maxTokens: 1500,
      timeoutMs: opts?.timeoutMs ?? 20_000,
    });
  } catch {
    return unavailable();
  }
  const parsed = ModelOutput.safeParse(safeJson(raw));
  if (!parsed.success) return unavailable();
  // An empty list is a FAILED generation (the prompt always asks for ≥1 question per
  // criterion), not a legitimate "no questions" success. Treat it as unavailable so the
  // route never caches a degenerate empty result and the recruiter can retry.
  if (parsed.data.items.length === 0) return unavailable();
  return {
    available: true,
    items: parsed.data.items.map((q) => ({
      criterion: q.criterion.trim(),
      question: q.question.trim(),
      lookFor: q.lookFor.trim(),
    })),
    promptVersion: INTERVIEW_QUESTIONS_PROMPT_VERSION,
  };
}
