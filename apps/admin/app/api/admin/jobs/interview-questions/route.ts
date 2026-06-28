/*
 * POST /api/admin/jobs/interview-questions — rubric-grounded interview questions (ADR-0034).
 *
 * Advisory recruiter aid: given a job's title + requirements + scorecard rubric (from the
 * editor's current form state — works on unsaved drafts, like the JD bias check), returns
 * structured, fair, job-related interview questions aligned to each rubric criterion.
 * Input is JOB-LEVEL only — no candidate PII. Recruiter+; flag-gated (ai_interview_questions);
 * CSRF; fail-closed. KV-cached on the input content hash + prompt version. Records an
 * ai_oversight audit entry (EU AI-Act §14).
 */

import { NextResponse } from "next/server";
import { getSession, validateCsrf, writeAuditLog } from "@/lib/auth";
import { isEnabled } from "@career-builder/shared/feature-flags";
import { getKV } from "@career-builder/shared/kv";
import { sha256 } from "@career-builder/security/crypto";
import { sanitizeString } from "@career-builder/security/sanitize";
import { generateInterviewQuestions, INTERVIEW_QUESTIONS_PROMPT_VERSION, type InterviewQuestionsResult } from "@career-builder/ai-client/interview-questions";

const NO_STORE = { "Cache-Control": "no-store" } as const;
const WRITE_ROLES = ["super_admin", "admin", "hiring_manager", "recruiter"];
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 7;

/** Coerce a string[] | newline-string into a bounded, sanitized string[]. */
function toList(v: unknown, max: number): string[] {
  const raw = Array.isArray(v) ? v : typeof v === "string" ? v.split("\n") : [];
  return raw.map((x) => sanitizeString(String(x), 300)).filter(Boolean).slice(0, max);
}

export async function POST(req: Request) {
  if (!isEnabled("ai_interview_questions")) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  if (!WRITE_ROLES.includes(session.role)) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403, headers: NO_STORE });
  if (!(await validateCsrf(req))) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403, headers: NO_STORE });

  let body: { jobTitle?: unknown; requirements?: unknown; rubricCriteria?: unknown; level?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400, headers: NO_STORE }); }

  const input = {
    jobTitle: sanitizeString(typeof body?.jobTitle === "string" ? body.jobTitle : "", 200) || "this role",
    requirements: toList(body?.requirements, 30),
    rubricCriteria: toList(body?.rubricCriteria, 20),
    level: sanitizeString(typeof body?.level === "string" ? body.level : "", 60) || undefined,
  };

  const contentHash = sha256(JSON.stringify(input)).slice(0, 16);
  const kv = getKV();
  const cacheKey = `interview-questions:${session.tenantId}:${INTERVIEW_QUESTIONS_PROMPT_VERSION}:${contentHash}`;
  let result: InterviewQuestionsResult | null = null;
  try {
    const cached = await kv.get(cacheKey);
    if (cached) result = JSON.parse(cached) as InterviewQuestionsResult;
  } catch { /* cache miss */ }

  if (!result) {
    result = await generateInterviewQuestions(input);
    if (result.available) {
      try { await kv.set(cacheKey, JSON.stringify(result), CACHE_TTL_SECONDS); } catch { /* best-effort */ }
    }
  }

  await writeAuditLog(session.userId, session.email, "ai_oversight", `interview_questions (${result.available ? result.items.length + " questions" : "unavailable"})`, session.tenantId);
  return NextResponse.json(result, { headers: NO_STORE });
}
