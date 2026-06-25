/*
 * GET /api/applications/[id]/feedback — the candidate's OWN anonymized interview
 * feedback (ADR-0012), only once a recruiter has released it. Returns per-criterion
 * averages + overall (NO interviewer identity, recommendation labels, or comments).
 * Own-only (email+tenant). Flag-gated.
 */

import { NextResponse } from "next/server";
import { getCandidateSession } from "@/lib/candidateAuth";
import { applicationRepo, scorecardRepo } from "@career-builder/database";
import { isEnabled } from "@career-builder/shared/feature-flags";
import { aggregateScorecards, candidateFeedbackProjection, parseScorecardCriteria, type ScorecardInput } from "@career-builder/shared/scorecard";

const NO_STORE = { "Cache-Control": "no-store" } as const;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isEnabled("interview_feedback")) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  const session = await getCandidateSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });

  const { id } = await params;
  const app = await applicationRepo.findByIdScoped(id, session.tenantId);
  // Own-only: the application must belong to this candidate (email+tenant, ADR-0001).
  if (!app || app.email.toLowerCase() !== session.email.toLowerCase()) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  }
  if (!app.feedbackReleasedAt) {
    return NextResponse.json({ feedback: null }, { headers: NO_STORE });
  }

  const rubric = parseScorecardCriteria((app.job as { scorecardCriteria?: unknown } | null)?.scorecardCriteria);
  const scorecards = await scorecardRepo.listForApplication(session.tenantId, id);
  const input: ScorecardInput[] = scorecards.map((sc) => ({
    interviewerId: sc.interviewerId,
    recommendation: sc.recommendation as ScorecardInput["recommendation"],
    ratings: sc.ratings.map((r) => ({ criterion: r.criterion, score: r.score })),
  }));

  return NextResponse.json({ feedback: candidateFeedbackProjection(aggregateScorecards(input, rubric)) }, { headers: NO_STORE });
}
