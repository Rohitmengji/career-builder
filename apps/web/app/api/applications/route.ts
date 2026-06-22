/*
 * GET /api/applications — candidate's own applications.
 *
 * Requires an authenticated candidate session. Returns all applications
 * for the candidate's email, scoped to their tenant.
 */

import { NextResponse } from "next/server";
import { getCandidateSession } from "@/lib/candidateAuth";
import { applicationRepo, eventRepo, adverseActionRepo } from "@career-builder/database";
import { isEnabled } from "@career-builder/shared/feature-flags";
import { candidateProjection } from "@career-builder/shared/adverse-action";

export async function GET() {
  const session = await getCandidateSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const applications = await applicationRepo.findByCandidateEmail(
    session.email,
    session.tenantId,
  );

  // Real status timeline (ADR-0005): candidate-visible events for the candidate's
  // OWN application ids only. Flag-gated; the projection already strips actor
  // identity + internal metadata.
  const timelineByApp: Record<string, { type: string; status: string | null; at: string }[]> = {};
  if (isEnabled("application_timeline") && applications.length > 0) {
    const events = await eventRepo.listCandidateVisible(
      session.tenantId,
      applications.map((a) => a.id),
    );
    for (const e of events) {
      (timelineByApp[e.applicationId] ??= []).push({
        type: e.type,
        status: e.toStatus,
        at: e.at.toISOString(),
      });
    }
  }

  // Rejection reason (ADR-0010): only shared records, only when the flag is on, only
  // the candidate-safe projection (never freeText). Gated twice (flag + per-record
  // sharedWithCandidate, which the repo already filters).
  const reasonByApp: Record<string, { category: string; message: string }> = {};
  if (isEnabled("adverse_action_disclosure") && applications.length > 0) {
    const rows = await adverseActionRepo.findCandidateVisible(
      session.tenantId,
      applications.map((a) => a.id),
    );
    for (const r of rows) {
      const proj = candidateProjection(r);
      if (proj) reasonByApp[r.applicationId] = proj;
    }
  }

  // Return only safe fields (no internal notes, ratings, etc.)
  const safe = applications.map((app) => ({
    id: app.id,
    status: app.status,
    submittedAt: app.submittedAt.toISOString(),
    updatedAt: app.updatedAt.toISOString(),
    job: {
      id: app.job.id,
      title: app.job.title,
      department: app.job.department,
      location: app.job.location,
    },
    timeline: timelineByApp[app.id] ?? [],
    rejectionReason: reasonByApp[app.id] ?? null,
  }));

  return NextResponse.json({ applications: safe });
}
