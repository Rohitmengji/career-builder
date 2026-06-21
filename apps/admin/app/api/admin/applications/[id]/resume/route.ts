/*
 * GET /api/admin/applications/[id]/resume — recruiter résumé view + AI insights.
 *
 * Returns the applicant's extracted résumé text and a structured profile
 * (skills/titles/experience/education). Recruiter+ only; tenant-scoped.
 *
 * Blind Hiring synergy: when enabled, the raw text and the free-text summary are
 * withheld (identity-rich), but the structured skills/titles/experience/education
 * ARE returned — skills-first review without exposing who the candidate is.
 *
 * Flag-gated (ai_resume_insights). AI cost is bounded by a KV cache keyed on the
 * application id + prompt version (résumé text is immutable after apply).
 */

import { NextResponse } from "next/server";
import { getSessionReadOnly } from "@/lib/auth";
import { applicationRepo, auditRepo } from "@career-builder/database";
import { getBlindHiringConfig } from "@/lib/blindHiring";
import { isEnabled } from "@career-builder/shared/feature-flags";
import { getKV } from "@career-builder/shared/kv";
import { structureResume, RESUME_PROMPT_VERSION, type ResumeInsights } from "@career-builder/ai-client/resume";

const NO_STORE = { "Cache-Control": "no-store" } as const;
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 30;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  // Off → behave as if the route doesn't exist.
  if (!isEnabled("ai_resume_insights")) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  }

  const session = await getSessionReadOnly();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  if (session.role === "viewer") {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403, headers: NO_STORE });
  }

  const { id } = await params;
  const app = await applicationRepo.findByIdScoped(id, session.tenantId);
  if (!app) return NextResponse.json({ error: "Application not found" }, { status: 404, headers: NO_STORE });

  // Recruiter viewed this candidate → candidate-visible "who viewed me" log.
  auditRepo.logProfileView(session.tenantId, id, session.userId).catch(() => {});

  const blind = await getBlindHiringConfig(session.tenantId);
  const resumeText = app.resumeText;

  if (!resumeText) {
    return NextResponse.json(
      { available: false, blindHiring: blind.enabled, resumeText: null, insights: null },
      { headers: NO_STORE },
    );
  }

  // KV cache: résumé text never changes after apply, so key on id + prompt version.
  const kv = getKV();
  const cacheKey = `resume-insights:${session.tenantId}:${id}:${RESUME_PROMPT_VERSION}`;
  let insights: ResumeInsights | null = null;
  try {
    const cached = await kv.get(cacheKey);
    if (cached) insights = JSON.parse(cached) as ResumeInsights;
  } catch {
    /* cache miss / unavailable */
  }
  if (!insights) {
    insights = await structureResume(resumeText);
    if (insights.available) {
      try {
        await kv.set(cacheKey, JSON.stringify(insights), CACHE_TTL_SECONDS);
      } catch {
        /* best-effort */
      }
    }
  }

  // Blind Hiring: withhold the identity-rich raw text + free-text summary; the
  // structured skills/titles/experience/education are non-identifying and the
  // whole point of skills-first review.
  if (blind.enabled) {
    return NextResponse.json(
      {
        available: insights.available,
        blindHiring: true,
        resumeText: null,
        insights: insights.available ? { ...insights, summary: "" } : null,
      },
      { headers: NO_STORE },
    );
  }

  return NextResponse.json(
    {
      available: insights.available,
      blindHiring: false,
      resumeText,
      insights: insights.available ? insights : null,
    },
    { headers: NO_STORE },
  );
}
