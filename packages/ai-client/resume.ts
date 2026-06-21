/*
 * @career-builder/ai-client/resume — structured résumé parsing (SERVER-ONLY).
 *
 * Turns extracted résumé TEXT (see apps/web/lib/resume/extract.ts) into a
 * structured profile recruiters can scan and filter on: a short summary, skills,
 * titles held, total experience, and education. Same hardened contract as the
 * match engine (matching.ts):
 *  - versioned prompt (RESUME_PROMPT_VERSION), deterministic (temperature 0);
 *  - schema-validated, FAIL-CLOSED — malformed output → { available: false },
 *    never raw model text;
 *  - extraction-only: the model is told to use ONLY what's in the text and not
 *    invent skills/credentials;
 *  - contact PII (email/phone/urls) is stripped before the text leaves our server
 *    (recruiters already have contact details from the application record), and
 *    the model is told not to emit name/contact in the output.
 */

import { z } from "zod";
import { callAi } from "./index";
import { stripContactPii } from "./matching";

export const RESUME_PROMPT_VERSION = "resume-v1";

export interface ResumeEducation {
  credential: string;
  field?: string;
  institution?: string;
}

export interface ResumeInsights {
  /** false when structuring couldn't run / output was unsafe (fail-closed). */
  available: boolean;
  summary: string;
  skills: string[];
  titles: string[];
  totalYearsExperience: number | null;
  education: ResumeEducation[];
  promptVersion: string;
}

const MAX_RESUME_CHARS = 12_000;

const ModelOutput = z.object({
  summary: z.string().max(800),
  skills: z.array(z.string().min(1).max(60)).max(50),
  titles: z.array(z.string().min(1).max(120)).max(20),
  totalYearsExperience: z.number().min(0).max(60).nullable(),
  education: z
    .array(
      z.object({
        credential: z.string().min(1).max(160),
        field: z.string().max(160).optional(),
        institution: z.string().max(200).optional(),
      }),
    )
    .max(15),
});

function unavailable(): ResumeInsights {
  return {
    available: false,
    summary: "",
    skills: [],
    titles: [],
    totalYearsExperience: null,
    education: [],
    promptVersion: RESUME_PROMPT_VERSION,
  };
}

export const RESUME_PROMPT = {
  version: RESUME_PROMPT_VERSION,
  system(): string {
    return [
      "You extract a STRUCTURED PROFILE from a candidate's résumé/background text,",
      "to help a recruiter scan and filter. Use ONLY information present in the text.",
      "",
      "RULES:",
      "- Do NOT invent skills, titles, years, or schools. If something isn't stated,",
      "  omit it (and use null for totalYearsExperience when it can't be determined).",
      "- skills: short canonical names (e.g. 'TypeScript', 'Kubernetes'), de-duplicated.",
      "- titles: distinct job titles the person has held.",
      "- totalYearsExperience: a single number of total professional years if stated or",
      "  clearly inferable from dates; otherwise null.",
      "- education: each entry has a credential (e.g. 'BSc'), optional field, optional institution.",
      "- summary: 1–3 sentences about experience and strengths. Do NOT include the person's",
      "  name, email, phone, age, gender, or any contact/identifier.",
      "",
      "Return STRICT JSON only:",
      '{"summary": string, "skills": string[], "titles": string[],',
      ' "totalYearsExperience": number|null, "education": [{"credential": string,',
      ' "field"?: string, "institution"?: string}]}',
      "No prose outside the JSON.",
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

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const key = v.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(v.trim());
  }
  return out;
}

/**
 * Structure a résumé from its extracted text. Never throws; returns an
 * "unavailable" result on any failure (empty input, model error, malformed output).
 */
export async function structureResume(
  resumeText: string,
  opts?: { timeoutMs?: number },
): Promise<ResumeInsights> {
  const text = (resumeText || "").trim();
  if (text.length < 30) return unavailable();

  const cleaned = stripContactPii(text).slice(0, MAX_RESUME_CHARS);

  let raw: string;
  try {
    raw = await callAi(RESUME_PROMPT.system(), `RÉSUMÉ TEXT:\n${cleaned}`, {
      temperature: 0,
      maxTokens: 900,
      timeoutMs: opts?.timeoutMs ?? 20_000,
    });
  } catch {
    return unavailable();
  }

  const parsed = ModelOutput.safeParse(safeJson(raw));
  if (!parsed.success) return unavailable();

  const d = parsed.data;
  return {
    available: true,
    summary: d.summary.trim(),
    skills: dedupe(d.skills),
    titles: dedupe(d.titles),
    totalYearsExperience: d.totalYearsExperience,
    education: d.education.map((e) => ({
      credential: e.credential.trim(),
      ...(e.field ? { field: e.field.trim() } : {}),
      ...(e.institution ? { institution: e.institution.trim() } : {}),
    })),
    promptVersion: RESUME_PROMPT_VERSION,
  };
}
