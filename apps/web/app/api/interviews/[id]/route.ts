/*
 * Candidate interview actions (ADR-0006), candidate-auth + own-interview only.
 *
 * POST /api/interviews/[id]   — confirm attendance
 * GET  /api/interviews/[id]   — download the .ics calendar file
 */

import { NextResponse } from "next/server";
import { getCandidateSession } from "@/lib/candidateAuth";
import { interviewRepo, eventRepo } from "@career-builder/database";
import { isEnabled } from "@career-builder/shared/feature-flags";
import { buildIcs } from "@career-builder/shared/ics";

const NO_STORE = { "Cache-Control": "no-store" } as const;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isEnabled("interview_scheduling")) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  }
  const session = await getCandidateSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });

  const { id } = await params;
  const iv = await interviewRepo.findForCandidate(id, session.email, session.tenantId);
  if (!iv) return NextResponse.json({ error: "Interview not found" }, { status: 404, headers: NO_STORE });
  if (iv.status === "cancelled") {
    return NextResponse.json({ error: "This interview was cancelled." }, { status: 409, headers: NO_STORE });
  }

  await interviewRepo.update(id, session.tenantId, { status: "confirmed" });
  eventRepo
    .record({
      tenantId: session.tenantId,
      applicationId: iv.applicationId,
      type: "interview_confirmed",
      actorType: "candidate",
      visibility: "candidate",
    })
    .catch((err) => console.error("[interviews] confirm event failed:", err));

  return NextResponse.json({ success: true }, { headers: NO_STORE });
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isEnabled("interview_scheduling")) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  }
  const session = await getCandidateSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });

  const { id } = await params;
  const iv = await interviewRepo.findForCandidate(id, session.email, session.tenantId);
  if (!iv) return NextResponse.json({ error: "Interview not found" }, { status: 404, headers: NO_STORE });

  const jobTitle = iv.application?.job?.title ?? "Interview";
  const ics = buildIcs({
    uid: `${iv.id}@careerbuilder`,
    start: iv.scheduledAt,
    durationMins: iv.durationMins,
    title: `Interview: ${jobTitle}`,
    description: iv.meetingUrl ? `Join: ${iv.meetingUrl}` : undefined,
    location: iv.location ?? undefined,
    url: iv.meetingUrl ?? undefined,
    attendeeEmail: session.email,
  });

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="interview-${iv.id}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
