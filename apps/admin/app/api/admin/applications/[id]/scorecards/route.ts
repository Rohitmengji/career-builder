/*
 * Admin Scorecards API (ADR-0007). Recruiter+ only; tenant-scoped throughout.
 *
 * GET   /api/admin/applications/[id]/scorecards   — rubric + all scorecards +
 *                                                   aggregated decision view +
 *                                                   the caller's own submission.
 * POST  /api/admin/applications/[id]/scorecards   — submit/replace MY scorecard.
 *
 * Scorecards are INTERNAL: they carry interviewer identity + scores, never the
 * applicant's PII, so Blind Hiring redaction happens at the applicant-display
 * layer (the applications row/dialog), not here. A scorecard_submitted event
 * (visibility:internal) is recorded for the recruiter timeline/notifications.
 */

import { NextResponse } from "next/server";
import { getSession, getSessionReadOnly, validateCsrf, writeAuditLog } from "@/lib/auth";
import { applicationRepo, scorecardRepo, eventRepo } from "@career-builder/database";
import { submitScorecardSchema, safeParse } from "@career-builder/security/validate";
import { sanitizeString } from "@career-builder/security/sanitize";
import { isEnabled } from "@career-builder/shared/feature-flags";
import { aggregateScorecards, parseScorecardCriteria, type ScorecardInput } from "@career-builder/shared/scorecard";

const WRITE_ROLES = ["super_admin", "admin", "hiring_manager", "recruiter"];
const NO_STORE = { "Cache-Control": "no-store" } as const;
const flagOff = () => !isEnabled("interview_scorecards");

type ScorecardRow = Awaited<ReturnType<typeof scorecardRepo.listForApplication>>[number];

/** Shape sent to the client: interviewer name + recommendation + ratings (no internal ids beyond what the UI needs). */
function serialize(sc: ScorecardRow) {
  return {
    id: sc.id,
    interviewerId: sc.interviewerId,
    interviewerName: sc.interviewer?.name || sc.interviewer?.email || "Interviewer",
    recommendation: sc.recommendation,
    overallNotes: sc.overallNotes,
    submittedAt: sc.submittedAt,
    ratings: sc.ratings.map((r) => ({ criterion: r.criterion, score: r.score, comment: r.comment })),
  };
}

/* ------------------------------------------------------------------ GET */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (flagOff()) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  const session = await getSessionReadOnly();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  if (session.role === "viewer") return NextResponse.json({ error: "Insufficient permissions" }, { status: 403, headers: NO_STORE });

  const { id } = await params;
  const app = await applicationRepo.findByIdScoped(id, session.tenantId);
  if (!app) return NextResponse.json({ error: "Application not found" }, { status: 404, headers: NO_STORE });

  const rubric = parseScorecardCriteria((app.job as { scorecardCriteria?: unknown } | null)?.scorecardCriteria);
  const scorecards = await scorecardRepo.listForApplication(session.tenantId, id);

  const aggregateInput: ScorecardInput[] = scorecards.map((sc) => ({
    interviewerId: sc.interviewerId,
    recommendation: sc.recommendation as ScorecardInput["recommendation"],
    ratings: sc.ratings.map((r) => ({ criterion: r.criterion, score: r.score })),
  }));

  return NextResponse.json(
    {
      rubric,
      scorecards: scorecards.map(serialize),
      aggregate: aggregateScorecards(aggregateInput, rubric),
      // The caller's own scorecard id (so the UI can show "edit yours" vs "add yours").
      mySubmissionId: scorecards.find((sc) => sc.interviewerId === session.userId)?.id ?? null,
      // Whether an anonymized summary has been released to the candidate (ADR-0012).
      feedbackReleased: !!(app as { feedbackReleasedAt?: Date | null }).feedbackReleasedAt,
      feedbackEnabled: isEnabled("interview_feedback"),
    },
    { headers: NO_STORE },
  );
}

/* ---------------------------------------------------------------- PATCH */
/** Release / un-release the candidate-visible feedback summary (ADR-0012). Recruiter+, CSRF, flag interview_feedback. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isEnabled("interview_feedback")) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  if (!WRITE_ROLES.includes(session.role)) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403, headers: NO_STORE });
  if (!(await validateCsrf(req))) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403, headers: NO_STORE });

  const { id } = await params;
  let body: { action?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400, headers: NO_STORE }); }
  if (body?.action !== "release" && body?.action !== "unrelease") {
    return NextResponse.json({ error: "action must be release|unrelease." }, { status: 400, headers: NO_STORE });
  }

  const app = await applicationRepo.findByIdScoped(id, session.tenantId);
  if (!app) return NextResponse.json({ error: "Application not found" }, { status: 404, headers: NO_STORE });

  const releasedAt = body.action === "release" ? new Date() : null;
  await applicationRepo.setFeedbackReleased(id, session.tenantId, releasedAt);
  await writeAuditLog(session.userId, session.email, `interview_feedback_${body.action}`, `application ${id.slice(-6)}`);
  return NextResponse.json({ success: true, feedbackReleased: releasedAt !== null }, { headers: NO_STORE });
}

/* ----------------------------------------------------------------- POST */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (flagOff()) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  if (!WRITE_ROLES.includes(session.role)) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403, headers: NO_STORE });
  if (!(await validateCsrf(req))) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403, headers: NO_STORE });

  const { id } = await params;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400, headers: NO_STORE }); }
  const parsed = safeParse(submitScorecardSchema, body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });
  const d = parsed.data;

  // The URL path is the source of truth for which application this belongs to.
  if (d.applicationId !== id) return NextResponse.json({ error: "Application id mismatch." }, { status: 400, headers: NO_STORE });

  const app = await applicationRepo.findByIdScoped(id, session.tenantId);
  if (!app) return NextResponse.json({ error: "Application not found" }, { status: 404, headers: NO_STORE });

  const scorecard = await scorecardRepo.submit({
    tenantId: session.tenantId,
    applicationId: id,
    interviewerId: session.userId, // the scorecard is always the CALLER's — never spoofable
    interviewId: d.interviewId ?? null,
    recommendation: d.recommendation,
    overallNotes: d.overallNotes ? sanitizeString(d.overallNotes, 5000) : null,
    ratings: d.ratings.map((r) => ({
      criterion: sanitizeString(r.criterion, 120),
      score: r.score,
      comment: r.comment ? sanitizeString(r.comment, 1000) : null,
    })),
  });

  await writeAuditLog(session.userId, session.email, "scorecard_submitted", `application ${id.slice(-6)} (${d.recommendation})`);
  eventRepo
    .record({
      tenantId: session.tenantId,
      applicationId: id,
      type: "scorecard_submitted",
      actorId: session.userId,
      actorType: "recruiter",
      visibility: "internal", // never candidate-visible
      metadata: { recommendation: d.recommendation },
    })
    .catch((err) => console.error("[scorecards] event failed:", err));

  return NextResponse.json({ scorecard: serialize(scorecard as ScorecardRow) }, { status: 201, headers: NO_STORE });
}
