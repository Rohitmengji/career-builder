/*
 * @career-builder/ai-client/matching — explainable candidate↔role match scoring.
 *
 * The engine behind the "Right-to-Explanation" feature: score a candidate's
 * background against a role's REAL requirements and return an explainable result
 * the candidate can see. SERVER-ONLY (uses callAi).
 *
 * Standards baked in (per the Honest Hiring brief §3.4):
 * - Versioned prompt + rubric (SCORING_PROMPT) — not an inline literal.
 * - Deterministic: temperature 0; same input → stable score.
 * - Structured output, schema-validated, FAIL-CLOSED: malformed/over-range
 *   output → an "unavailable" result, never raw model text shown to a candidate.
 * - Anti-hallucination: the model may only cite requirements that REALLY exist
 *   (by index); invented citations are dropped before display.
 * - Fairness by construction: the model is told to score ONLY skills/experience
 *   vs requirements and to IGNORE name/gender/age/photos; the engine never
 *   receives identity fields — only free-text background + the requirements.
 */

import { z } from "zod";
import { callAi } from "./index";

export const SCORING_PROMPT_VERSION = "match-v1";

/** A cited strength/gap, grounded in a real requirement (when applicable). */
export interface MatchHighlight {
  text: string;
  /** The exact requirement this maps to (verified to exist), if grounded. */
  requirement?: string;
}

export type MatchBand = "strong" | "good" | "partial" | "low";

export interface MatchResult {
  /** false when scoring couldn't run / output was unsafe (fail-closed). */
  available: boolean;
  score: number | null; // 0–100
  band: MatchBand | null;
  strengths: MatchHighlight[];
  gaps: MatchHighlight[];
  promptVersion: string;
}

export interface ScoreMatchInput {
  /** Candidate background as free text (pasted experience / resume text). */
  resumeText: string;
  /** The role's hard requirements (exact strings). */
  requirements: string[];
  /** The role's nice-to-haves (exact strings). */
  niceToHave?: string[];
}

// 6000: a deliberate safety margin below the route's 8000-char input cap. The
// route accepts up to 8000 (room to paste/edit); we score the first 6000 to
// bound token cost. Truncation is harmless — it only ever drops trailing text.
const MAX_RESUME_CHARS = 6000;
const MAX_REQUIREMENTS = 40;

/**
 * Strip direct contact identifiers from free text before it is sent to the AI
 * provider. These (email, phone, URLs, SSN-like ids) are never skill signals, so
 * removing them can't change a fair score — but it keeps a candidate's contact
 * details out of an external provider's logs (privacy + the brief's fairness
 * principle that identity must not enter the model input). Best-effort, conservative.
 */
export function stripContactPii(text: string): string {
  return text
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[contact removed]") // emails
    .replace(/\b(?:https?:\/\/|www\.)\S+/gi, "[link removed]") // urls
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[id removed]") // ssn-like
    .replace(/\+?\d[\d\s().\-]{7,}\d/g, "[contact removed]"); // long phone-like digit runs
}

// Strict model-output contract. Anything outside this fails closed.
const ModelOutput = z.object({
  score: z.number().int().min(0).max(100),
  strengths: z
    .array(z.object({ text: z.string().min(1).max(300), reqIndex: z.number().int().optional() }))
    .max(10),
  gaps: z
    .array(z.object({ text: z.string().min(1).max(300), reqIndex: z.number().int() }))
    .max(10),
});

function unavailable(): MatchResult {
  return { available: false, score: null, band: null, strengths: [], gaps: [], promptVersion: SCORING_PROMPT_VERSION };
}

function bandFor(score: number): MatchBand {
  if (score >= 80) return "strong";
  if (score >= 60) return "good";
  if (score >= 35) return "partial";
  return "low";
}

/** Versioned prompt + rubric. Requirements are presented as a numbered list so
 *  the model can cite them by index — and we validate those indices in code. */
export const SCORING_PROMPT = {
  version: SCORING_PROMPT_VERSION,
  system(requirements: string[]): string {
    const numbered = requirements.map((r, i) => `${i}. ${r}`).join("\n");
    return [
      "You are an impartial hiring assistant that scores how well a candidate's",
      "BACKGROUND matches a role's REQUIREMENTS, to give the candidate honest,",
      "useful feedback.",
      "",
      "FAIRNESS RULES (mandatory):",
      "- Judge ONLY skills, experience, and qualifications versus the requirements.",
      "- IGNORE and never reference name, gender, age, ethnicity, photos, schools,",
      "  or any personal/demographic attribute. They must not affect the score.",
      "",
      "GROUNDING RULES (mandatory):",
      "- You may ONLY reference the requirements listed below. Do NOT invent",
      "  requirements. Every 'gap' MUST cite a requirement by its number (reqIndex).",
      "- Strengths may cite a requirement number when directly relevant.",
      "",
      "REQUIREMENTS (numbered):",
      numbered,
      "",
      "Return STRICT JSON only, matching:",
      '{"score": <0-100 integer>, "strengths": [{"text": string, "reqIndex"?: number}],',
      ' "gaps": [{"text": string, "reqIndex": number}]}',
      "Keep each text under 300 chars, specific and non-generic. No prose outside the JSON.",
    ].join("\n");
  },
};

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    // tolerate a code-fence or surrounding text — extract the first {...} block
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
 * Score a candidate's background against a role. Never throws; returns an
 * "unavailable" result on any failure (missing input, model error, malformed
 * or out-of-contract output).
 */
export async function scoreMatch(input: ScoreMatchInput, opts?: { timeoutMs?: number }): Promise<MatchResult> {
  const resumeText = (input.resumeText || "").trim();
  // Combined, numbered requirement list (hard requirements first).
  const requirements = [...(input.requirements || []), ...(input.niceToHave || [])]
    .map((r) => String(r || "").trim())
    .filter(Boolean)
    .slice(0, MAX_REQUIREMENTS);

  if (!resumeText || requirements.length === 0) return unavailable();

  // Remove direct contact identifiers before the text leaves our server.
  const cleaned = stripContactPii(resumeText).slice(0, MAX_RESUME_CHARS);

  let raw: string;
  try {
    raw = await callAi(SCORING_PROMPT.system(requirements), `CANDIDATE BACKGROUND:\n${cleaned}`, {
      temperature: 0,
      maxTokens: 800,
      timeoutMs: opts?.timeoutMs ?? 20_000,
    });
  } catch {
    return unavailable();
  }

  const parsed = ModelOutput.safeParse(safeJson(raw));
  if (!parsed.success) return unavailable();

  const inRange = (i: number | undefined): i is number =>
    typeof i === "number" && Number.isInteger(i) && i >= 0 && i < requirements.length;

  // Anti-hallucination: a gap MUST cite a real requirement; drop invented ones.
  const gaps: MatchHighlight[] = parsed.data.gaps
    .filter((g) => inRange(g.reqIndex))
    .map((g) => ({ text: g.text, requirement: requirements[g.reqIndex] }));

  const strengths: MatchHighlight[] = parsed.data.strengths.map((s) => ({
    text: s.text,
    requirement: inRange(s.reqIndex) ? requirements[s.reqIndex] : undefined,
  }));

  return {
    available: true,
    score: parsed.data.score,
    band: bandFor(parsed.data.score),
    strengths,
    gaps,
    promptVersion: SCORING_PROMPT_VERSION,
  };
}
