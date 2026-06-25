/*
 * @career-builder/ai-client/jd-bias — job-description bias detection (SERVER-ONLY).
 *
 * Flags potentially exclusionary language in a job description (gendered terms,
 * age proxies, ableist/unnecessary requirements) so a recruiter can fix it BEFORE
 * publishing — an EU AI-Act §6 (employment, high-risk) safeguard. Advisory + NON-
 * blocking: findings are suggestions, never an auto-reject. Same hardened contract
 * as matching.ts / resume.ts:
 *  - versioned prompt, deterministic (temperature 0);
 *  - schema-validated, FAIL-CLOSED — malformed output → { available: false };
 *  - fairness-scoped: flag ONLY language that could deter a protected group, never
 *    legitimate, job-related skill/experience requirements.
 */

import { z } from "zod";
import { callAi } from "./index";

export const JD_BIAS_PROMPT_VERSION = "jd-bias-v1";

export type BiasCategory = "gendered" | "age" | "ableist" | "exclusionary" | "other";

export interface BiasFinding {
  /** The exact phrase from the JD that may be exclusionary. */
  phrase: string;
  category: BiasCategory;
  /** A neutral, job-related rewrite suggestion. */
  suggestion: string;
}

export interface JdBiasResult {
  /** false when the check couldn't run / output was unsafe (fail-closed). */
  available: boolean;
  findings: BiasFinding[];
  promptVersion: string;
}

const MAX_JD_CHARS = 12_000;

const ModelOutput = z.object({
  findings: z
    .array(
      z.object({
        phrase: z.string().min(1).max(200),
        category: z.enum(["gendered", "age", "ableist", "exclusionary", "other"]),
        suggestion: z.string().min(1).max(400),
      }),
    )
    .max(40),
});

function unavailable(): JdBiasResult {
  return { available: false, findings: [], promptVersion: JD_BIAS_PROMPT_VERSION };
}

export const JD_BIAS_PROMPT = {
  version: JD_BIAS_PROMPT_VERSION,
  system(): string {
    return [
      "You review a JOB DESCRIPTION for language that could unfairly deter qualified",
      "candidates from protected groups, so the author can make it more inclusive.",
      "",
      "Flag ONLY exclusionary LANGUAGE, for example:",
      "- gendered terms ('he', 'salesman', 'rockstar/ninja', 'aggressive');",
      "- age proxies ('young', 'digital native', 'recent graduate', 'energetic');",
      "- ableist or unnecessary physical requirements not essential to the job;",
      "- culture/background gatekeeping ('culture fit', 'native English speaker').",
      "",
      "Do NOT flag legitimate, job-related skill, experience, or qualification",
      "requirements (e.g. '5 years of Go', 'must hold a CPA'). When unsure, do NOT flag.",
      "For each finding give the exact phrase, a category",
      "(gendered|age|ableist|exclusionary|other), and a neutral rewrite suggestion.",
      "",
      'Return STRICT JSON only: {"findings": [{"phrase": string,',
      ' "category": "gendered"|"age"|"ableist"|"exclusionary"|"other", "suggestion": string}]}',
      "An empty findings array means the description looks inclusive. No prose outside the JSON.",
    ].join("\n");
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
 * Detect potentially-biased language in a JD. Never throws; returns an
 * "unavailable" result on any failure (empty input, model error, malformed output).
 */
export async function detectJdBias(description: string, opts?: { timeoutMs?: number }): Promise<JdBiasResult> {
  const text = (description || "").trim();
  if (text.length < 30) return { available: true, findings: [], promptVersion: JD_BIAS_PROMPT_VERSION };

  let raw: string;
  try {
    raw = await callAi(JD_BIAS_PROMPT.system(), `JOB DESCRIPTION:\n${text.slice(0, MAX_JD_CHARS)}`, {
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
    findings: parsed.data.findings.map((f) => ({
      phrase: f.phrase.trim(),
      category: f.category,
      suggestion: f.suggestion.trim(),
    })),
    promptVersion: JD_BIAS_PROMPT_VERSION,
  };
}
