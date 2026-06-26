/*
 * @career-builder/ai-client/scorecard-audit — interview scorecard bias & consistency
 * linter (SERVER-ONLY). NOVEL: no mainstream ATS audits the EVALUATION itself.
 *
 * Reads an interviewer's OWN written scorecard (per-criterion scores + comments +
 * overall recommendation/notes) and flags fairness/quality problems so the evaluator
 * can fix them BEFORE a decision is made:
 *  - biased_language    — bias-coded wording with no job-related evidence ("culture
 *                         fit", "aggressive", "not a team player", gendered/age/ableist);
 *  - score_comment_mismatch — the words and the number disagree (glowing text, low
 *                         score, or vice-versa);
 *  - vague              — a judgment with no concrete, job-related evidence/example;
 *  - unprofessional     — wording inappropriate for a hiring record.
 *
 * This extends ADR-0014 JD-bias detection from the job POSTING to the EVALUATION — an
 * EU AI-Act (employment, high-risk) fairness safeguard. INTERNAL-ONLY (never shown to
 * candidates). Same hardened contract as jd-bias.ts / matching.ts:
 *  - versioned prompt, deterministic (temperature 0);
 *  - schema-validated, FAIL-CLOSED — malformed output → { available: false };
 *  - advisory + NON-blocking: flags are nudges, never an auto-action;
 *  - it analyzes RECRUITER-authored text + scores only — NO candidate PII is required
 *    or sent (the caller passes evaluation content, not candidate identity).
 */

import { z } from "zod";
import { callAi } from "./index";

export const SCORECARD_AUDIT_PROMPT_VERSION = "scorecard-audit-v1";

export type ScorecardFlagType =
  | "biased_language"
  | "score_comment_mismatch"
  | "vague"
  | "unprofessional";

export interface ScorecardFlag {
  type: ScorecardFlagType;
  severity: "low" | "medium" | "high";
  /** The exact span from the evaluation the flag refers to (recruiter text). */
  excerpt: string;
  /** Why it's a concern (one sentence). */
  why: string;
  /** A concrete, evidence-based rewrite/next step. */
  suggestion: string;
}

export interface ScorecardAuditResult {
  /** false when the check couldn't run / output was unsafe (fail-closed). */
  available: boolean;
  flags: ScorecardFlag[];
  promptVersion: string;
}

export interface ScorecardAuditInput {
  ratings: { criterion: string; score: number; comment?: string | null }[];
  recommendation: string;
  overallNotes?: string | null;
}

const MAX_CHARS = 8_000;

const ModelOutput = z.object({
  flags: z
    .array(
      z.object({
        type: z.enum(["biased_language", "score_comment_mismatch", "vague", "unprofessional"]),
        severity: z.enum(["low", "medium", "high"]),
        excerpt: z.string().min(1).max(400),
        why: z.string().min(1).max(400),
        suggestion: z.string().min(1).max(400),
      }),
    )
    .max(40),
});

function unavailable(): ScorecardAuditResult {
  return { available: false, flags: [], promptVersion: SCORECARD_AUDIT_PROMPT_VERSION };
}

export const SCORECARD_AUDIT_PROMPT = {
  version: SCORECARD_AUDIT_PROMPT_VERSION,
  system(): string {
    return [
      "You are a fairness reviewer for a hiring team. You read ONE interviewer's",
      "structured scorecard (per-criterion 1-5 scores + written comments + an overall",
      "recommendation) and flag fairness or quality problems so the interviewer can",
      "improve it BEFORE a hiring decision. You are advisory only.",
      "",
      "Flag these problems:",
      "- biased_language: bias-coded wording not tied to job-related evidence — e.g.",
      "  'culture fit', 'not one of us', 'aggressive', 'abrasive', 'too junior-sounding',",
      "  gendered/age/ableist descriptors, or judging accent/background/personality;",
      "- score_comment_mismatch: the comment and the numeric score contradict each other",
      "  (e.g. praise with a low score, or harsh text with a high score);",
      "- vague: a conclusion with no concrete, job-related evidence or example;",
      "- unprofessional: wording inappropriate for a permanent hiring record.",
      "",
      "Do NOT flag legitimate, evidence-based, job-related assessments (e.g. 'failed the",
      "SQL exercise: couldn't write a JOIN'). Do NOT infer or mention the candidate's",
      "protected attributes yourself. When unsure, do NOT flag. Quote the exact text in",
      "'excerpt'. Keep 'why' and 'suggestion' to one sentence each; suggestions must push",
      "toward concrete, job-related evidence.",
      "",
      'Return STRICT JSON only: {"flags": [{"type": "biased_language"|"score_comment_mismatch"',
      '|"vague"|"unprofessional", "severity": "low"|"medium"|"high", "excerpt": string,',
      ' "why": string, "suggestion": string}]}',
      "An empty flags array means the evaluation looks fair and well-evidenced. No prose outside the JSON.",
    ].join("\n");
  },
  user(input: ScorecardAuditInput): string {
    const lines = ["SCORECARD UNDER REVIEW:", `Overall recommendation: ${input.recommendation}`];
    if (input.overallNotes && input.overallNotes.trim()) lines.push(`Overall notes: ${input.overallNotes.trim()}`);
    lines.push("", "Per-criterion:");
    for (const r of input.ratings) {
      lines.push(`- ${r.criterion} — score ${r.score}/5${r.comment && r.comment.trim() ? `: ${r.comment.trim()}` : " (no comment)"}`);
    }
    return lines.join("\n").slice(0, MAX_CHARS);
  },
};

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]);
    } catch {
      return null;
    }
  }
}

/**
 * Audit one scorecard for bias/consistency. Never throws — returns an "unavailable"
 * result on any failure (no content, model error, malformed output).
 */
export async function auditScorecard(input: ScorecardAuditInput, opts?: { timeoutMs?: number }): Promise<ScorecardAuditResult> {
  // Nothing to review if there is no written commentary at all.
  const hasText = (input.overallNotes && input.overallNotes.trim().length > 0) || input.ratings.some((r) => r.comment && r.comment.trim().length > 0);
  if (!hasText) return { available: true, flags: [], promptVersion: SCORECARD_AUDIT_PROMPT_VERSION };

  let raw: string;
  try {
    raw = await callAi(SCORECARD_AUDIT_PROMPT.system(), SCORECARD_AUDIT_PROMPT.user(input), {
      temperature: 0,
      maxTokens: 1200,
      timeoutMs: opts?.timeoutMs ?? 20_000,
    });
  } catch {
    return unavailable();
  }

  const parsed = ModelOutput.safeParse(safeJson(raw));
  if (!parsed.success) return unavailable();

  return {
    available: true,
    flags: parsed.data.flags.map((f) => ({
      type: f.type,
      severity: f.severity,
      excerpt: f.excerpt.trim(),
      why: f.why.trim(),
      suggestion: f.suggestion.trim(),
    })),
    promptVersion: SCORECARD_AUDIT_PROMPT_VERSION,
  };
}
