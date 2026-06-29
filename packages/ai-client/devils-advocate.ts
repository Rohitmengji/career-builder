/*
 * @career-builder/ai-client/devils-advocate — pre-decision counter-argument (ADR-0032).
 *
 * NOVEL (no mainstream ATS): before a recruiter rejects or hires, this argues the
 * STRONGEST evidence-based case for the OPPOSITE decision — a structured antidote to
 * confirmation bias. Grounded ONLY in the job requirements + the structured interview
 * scores (NO candidate PII — no name, résumé text, or contact reaches the model). It
 * must NOT fabricate: if the evidence genuinely doesn't support the other side, it says
 * so. Advisory; never blocks a decision. Same hardened contract as the other engines:
 * versioned prompt, low temperature, schema-validated, FAIL-CLOSED. EU AI-Act-aligned.
 */

import { z } from "zod";
import { callAi } from "./index";

export const DEVILS_ADVOCATE_PROMPT_VERSION = "devils-advocate-v1";

export type ProposedDecision = "reject" | "hire";

export interface DevilsAdvocateInput {
  proposedDecision: ProposedDecision;
  jobTitle: string;
  requirements: string[];
  /** Per-criterion structured-interview averages (1-5). Non-identifying. */
  criteria: { criterion: string; average: number | null }[];
  /** A short non-identifying summary of the recommendation mix, e.g. "3 yes, 1 no". */
  recommendationSummary: string;
}

/**
 * PII GUARD (pure + tested). Keep ONLY per-criterion averages whose label is a member
 * of the canonical job rubric. Scorecard criterion labels are free text on the rating
 * rows and are NOT validated against the rubric at write time, so an off-rubric label
 * could smuggle candidate PII (a name/email) into the prompt — drop it rather than
 * forward it to the model. Rubric labels themselves are job-level (PII-safe like the
 * requirements). The single chokepoint every caller must pass criteria through.
 */
export function selectGroundingCriteria(
  perCriterion: { criterion: string; average: number | null }[],
  rubric: Iterable<string>,
): { criterion: string; average: number | null }[] {
  const allow = new Set(rubric);
  return perCriterion.filter((c) => allow.has(c.criterion)).map((c) => ({ criterion: c.criterion, average: c.average }));
}

export interface CounterPoint {
  argument: string;
  /** Which requirement / score the point is grounded in. */
  basis: string;
}

export interface DevilsAdvocateResult {
  available: boolean;
  /** The decision being challenged (the AI argues the opposite). */
  proposedDecision: ProposedDecision;
  points: CounterPoint[];
  /** A one-line honest caveat (e.g. "the evidence largely supports the decision"). */
  caution: string;
  promptVersion: string;
}

const ModelOutput = z.object({
  points: z.array(z.object({ argument: z.string().min(1).max(600), basis: z.string().min(1).max(300) })).max(8),
  caution: z.string().max(400).default(""),
});

function unavailable(proposedDecision: ProposedDecision): DevilsAdvocateResult {
  return { available: false, proposedDecision, points: [], caution: "", promptVersion: DEVILS_ADVOCATE_PROMPT_VERSION };
}

export const DEVILS_ADVOCATE_PROMPT = {
  version: DEVILS_ADVOCATE_PROMPT_VERSION,
  system(): string {
    return [
      "You are a fair, rigorous hiring devil's advocate. A hiring team is leaning toward a",
      "decision; your job is to argue the STRONGEST evidence-based case for the OPPOSITE,",
      "so the team checks its own confirmation bias before deciding.",
      "",
      "Rules:",
      "- Ground EVERY point ONLY in the provided job requirements and structured interview",
      "  scores. Do not invent facts about the candidate.",
      "- If the team leans REJECT, argue why this candidate might deserve to advance.",
      "  If they lean HIRE, argue the risks / what to verify before committing.",
      "- NEVER reference or infer protected attributes (gender, age, race, etc.).",
      "- Be honest: if the evidence genuinely supports the team's lean and there is little",
      "  to say for the other side, return few/no points and say so in 'caution'.",
      "- Each point: a concrete argument + the requirement/score it is grounded in.",
      "",
      'Return STRICT JSON only: {"points": [{"argument": string, "basis": string}],',
      ' "caution": string}. No prose outside the JSON.',
    ].join("\n");
  },
  user(input: DevilsAdvocateInput): string {
    const lines = [
      `The hiring team is leaning toward: ${input.proposedDecision.toUpperCase()}.`,
      `Role: ${input.jobTitle}`,
      `Recommendation mix: ${input.recommendationSummary}`,
      "",
      "Job requirements:",
      ...input.requirements.slice(0, 30).map((r) => `- ${r}`),
      "",
      "Structured interview scores (1-5 average per criterion):",
      ...input.criteria.map((c) => `- ${c.criterion}: ${c.average ?? "n/a"}`),
      "",
      `Argue the strongest evidence-based case for the OPPOSITE of ${input.proposedDecision}.`,
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

/** Argue against the proposed decision. Never throws; fail-closed on any error. */
export async function argueAgainst(input: DevilsAdvocateInput, opts?: { timeoutMs?: number }): Promise<DevilsAdvocateResult> {
  let raw: string;
  try {
    raw = await callAi(DEVILS_ADVOCATE_PROMPT.system(), DEVILS_ADVOCATE_PROMPT.user(input), {
      temperature: 0.2,
      maxTokens: 1200,
      timeoutMs: opts?.timeoutMs ?? 20_000,
    });
  } catch {
    return unavailable(input.proposedDecision);
  }
  const parsed = ModelOutput.safeParse(safeJson(raw));
  if (!parsed.success) return unavailable(input.proposedDecision);
  return {
    available: true,
    proposedDecision: input.proposedDecision,
    points: parsed.data.points.map((p) => ({ argument: p.argument.trim(), basis: p.basis.trim() })),
    caution: parsed.data.caution.trim(),
    promptVersion: DEVILS_ADVOCATE_PROMPT_VERSION,
  };
}
