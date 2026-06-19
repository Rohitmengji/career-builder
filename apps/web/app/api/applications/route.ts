/*
 * GET /api/applications — candidate's own applications.
 *
 * Requires an authenticated candidate session. Returns all applications
 * for the candidate's email, scoped to their tenant.
 */

import { NextResponse } from "next/server";
import { getCandidateSession } from "@/lib/candidateAuth";
import { applicationRepo } from "@career-builder/database";

export async function GET() {
  const session = await getCandidateSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const applications = await applicationRepo.findByCandidateEmail(
    session.email,
    session.tenantId,
  );

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
  }));

  return NextResponse.json({ applications: safe });
}
