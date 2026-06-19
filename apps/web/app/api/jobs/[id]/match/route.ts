/*
 * POST /api/jobs/[id]/match — the candidate-facing "Right to Explanation" engine.
 *
 * A candidate pastes their background; we score it against THIS job's REAL
 * requirements (read server-side, tenant-scoped — never trusting client-supplied
 * requirements) and return an explainable, requirement-grounded fit estimate.
 *
 * Trust guarantees (Honest Hiring brief):
 *  - Private to the candidate: the result is not stored and never shown to the
 *    employer; it does not influence selection. It is purely informational.
 *  - Tenant-isolated: the job is fetched via the host-resolved tenant; a job from
 *    another tenant returns 404.
 *  - Flag-gated (ai_match_explanation, off in prod by default).
 *  - Fail-closed: any AI/parse failure returns { available: false }, never raw
 *    model text. (Enforced in @career-builder/ai-client/matching.)
 *  - Rate-limited on the expensive (AI) tier.
 *
 * Accepts: application/json { resumeText: string }
 * Returns: MatchResult ({ available, score, band, strengths[], gaps[], promptVersion })
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getJobProvider } from "@/lib/jobs/provider";
import { getWebTenantId } from "@/lib/tenant-runtime";
import { getRateLimiter, getClientIp } from "@career-builder/security/rate-limit";
import { safeParse } from "@career-builder/security/validate";
import { isEnabled } from "@career-builder/shared/feature-flags";
import { scoreMatch, type MatchResult } from "@career-builder/ai-client/matching";

const NO_STORE = { "Cache-Control": "no-store" } as const;

function json(body: MatchResult | { error: string }, status: number) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

/** Fail-closed shape mirroring the engine's "unavailable" result. */
const UNAVAILABLE: MatchResult = {
  available: false,
  score: null,
  band: null,
  strengths: [],
  gaps: [],
  promptVersion: "",
};

const matchSchema = z
  .object({
    resumeText: z.string().min(20, "Add a bit more about your experience.").max(8000),
  })
  .strict();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Feature flag — off in prod by default. When off, behave as if the route
    // does not exist: return the SAME 404 body as a missing job so the flag
    // state isn't observable to callers.
    if (!isEnabled("ai_match_explanation")) {
      return json({ error: "Job not found." }, 404);
    }

    const { id } = await params;

    // Tenant resolved from the host — the application/job is scoped to this only.
    const tenantId = await getWebTenantId();

    // Rate limit on the expensive tier (each call is a paid AI request).
    const limiter = getRateLimiter("upload");
    const ip = getClientIp(request) || "unknown";
    const rl = limiter.check(`match:${tenantId}:${ip}`);
    if (!rl.allowed) {
      return json({ error: "You're checking matches a lot — please try again in a few minutes." }, 429);
    }

    // Parse body.
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid request." }, 400);
    }
    const parsed = safeParse(matchSchema, body);
    if (!parsed.success) {
      // Generic, helpful message — don't echo the raw schema/validator output.
      return json({ error: "Please paste 20–8000 characters about your experience." }, 400);
    }

    // Fetch the job tenant-scoped. The REAL requirements come from the DB, never
    // from the client — so a candidate can't inject fake requirements to game
    // their own score, and can't read another tenant's job.
    const provider = getJobProvider();
    const result = await provider.getById(id, tenantId);
    if (!result.job) {
      return json({ error: "Job not found." }, 404);
    }

    const requirements = Array.isArray(result.job.requirements) ? result.job.requirements : [];
    const niceToHave = Array.isArray(result.job.niceToHave) ? result.job.niceToHave : [];

    // No requirements to score against → unavailable (not an error).
    if (requirements.length === 0 && niceToHave.length === 0) {
      return json(UNAVAILABLE, 200);
    }

    const match = await scoreMatch({
      resumeText: parsed.data.resumeText,
      requirements,
      niceToHave,
    });

    return json(match, 200);
  } catch (error) {
    console.error("[API /api/jobs/[id]/match] Error:", error);
    // Fail closed — never leak internals to a candidate. 503 (not 200) so an
    // unexpected server fault is distinguishable from the legitimate
    // "feature off / no requirements / AI unavailable" cases (which return 200
    // with available:false). The client renders the same generic error either way.
    return json(UNAVAILABLE, 503);
  }
}
