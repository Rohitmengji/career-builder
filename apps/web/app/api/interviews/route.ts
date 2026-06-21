/*
 * GET /api/interviews — the authenticated candidate's own interviews (ADR-0006).
 * Matched by application email + tenant; returns candidate-safe fields only
 * (no internal interviewer notes). Flag-gated.
 */

import { NextResponse } from "next/server";
import { getCandidateSession } from "@/lib/candidateAuth";
import { interviewRepo } from "@career-builder/database";
import { isEnabled } from "@career-builder/shared/feature-flags";

const NO_STORE = { "Cache-Control": "no-store" } as const;

export async function GET() {
  if (!isEnabled("interview_scheduling")) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  }
  const session = await getCandidateSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  }

  const interviews = await interviewRepo.listForCandidate(session.email, session.tenantId);
  const safe = interviews.map((i) => ({
    id: i.id,
    status: i.status,
    type: i.type,
    round: i.round,
    scheduledAt: i.scheduledAt.toISOString(),
    durationMins: i.durationMins,
    timezone: i.timezone,
    location: i.location,
    meetingUrl: i.meetingUrl,
    applicationId: i.applicationId,
    jobTitle: i.application?.job?.title ?? null,
  }));

  return NextResponse.json({ interviews: safe }, { headers: NO_STORE });
}
