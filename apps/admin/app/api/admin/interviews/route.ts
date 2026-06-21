/*
 * Admin Interviews API (ADR-0006). Recruiter+ only; tenant-scoped throughout.
 *
 * GET    /api/admin/interviews?applicationId=…   — list interviews for an application
 * POST   /api/admin/interviews                   — schedule an interview
 * PATCH  /api/admin/interviews                    — { id, action: cancel|complete|no_show }
 *
 * Every mutation writes an ApplicationEvent (candidate-visible for schedule/cancel)
 * + the compliance audit log, and (on schedule/cancel) emails the candidate.
 */

import { NextResponse } from "next/server";
import { getSession, getSessionReadOnly, validateCsrf, writeAuditLog } from "@/lib/auth";
import { applicationRepo, interviewRepo, eventRepo, userRepo } from "@career-builder/database";
import { createInterviewSchema, updateInterviewSchema, safeParse } from "@career-builder/security/validate";
import { sanitizeString } from "@career-builder/security/sanitize";
import { emailService } from "@career-builder/email";
import { isEnabled } from "@career-builder/shared/feature-flags";

const WRITE_ROLES = ["super_admin", "admin", "hiring_manager", "recruiter"];
const NO_STORE = { "Cache-Control": "no-store" } as const;
const flagOff = () => !isEnabled("interview_scheduling");

function formatWhen(d: Date, tz: string): string {
  const opts: Intl.DateTimeFormatOptions = {
    weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", timeZoneName: "short",
  };
  try {
    return new Intl.DateTimeFormat("en-US", { ...opts, timeZone: tz }).format(d);
  } catch {
    return new Intl.DateTimeFormat("en-US", opts).format(d);
  }
}

/* ----------------------------------------------------------------- GET */
export async function GET(req: Request) {
  if (flagOff()) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  const session = await getSessionReadOnly();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  if (session.role === "viewer") return NextResponse.json({ error: "Insufficient permissions" }, { status: 403, headers: NO_STORE });

  const applicationId = new URL(req.url).searchParams.get("applicationId");
  if (!applicationId) return NextResponse.json({ error: "applicationId is required" }, { status: 400, headers: NO_STORE });
  const app = await applicationRepo.findByIdScoped(applicationId, session.tenantId);
  if (!app) return NextResponse.json({ error: "Application not found" }, { status: 404, headers: NO_STORE });

  const interviews = await interviewRepo.listForApplication(session.tenantId, applicationId);
  return NextResponse.json({ interviews }, { headers: NO_STORE });
}

/* ---------------------------------------------------------------- POST */
export async function POST(req: Request) {
  if (flagOff()) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  if (!WRITE_ROLES.includes(session.role)) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403, headers: NO_STORE });
  if (!(await validateCsrf(req))) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403, headers: NO_STORE });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400, headers: NO_STORE }); }
  const parsed = safeParse(createInterviewSchema, body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });
  const d = parsed.data;

  const app = await applicationRepo.findByIdScoped(d.applicationId, session.tenantId);
  if (!app) return NextResponse.json({ error: "Application not found" }, { status: 404, headers: NO_STORE });

  // An assigned interviewer must belong to THIS tenant (no cross-tenant assignment).
  let interviewerId: string | null = null;
  if (d.interviewerId) {
    const members = await userRepo.findByTenant(session.tenantId);
    if (!members.some((u) => u.id === d.interviewerId)) {
      return NextResponse.json({ error: "Unknown interviewer." }, { status: 400, headers: NO_STORE });
    }
    interviewerId = d.interviewerId;
  }

  const scheduledAt = new Date(d.scheduledAt);
  const interview = await interviewRepo.create({
    tenantId: session.tenantId,
    applicationId: d.applicationId,
    jobId: app.job?.id ?? app.jobId ?? null,
    round: d.round,
    type: d.type,
    interviewerId,
    scheduledAt,
    durationMins: d.durationMins,
    timezone: d.timezone,
    location: d.location ? sanitizeString(d.location, 300) : null,
    meetingUrl: d.meetingUrl || null,
    notes: d.notes ? sanitizeString(d.notes, 2000) : null,
  });

  await writeAuditLog(session.userId, session.email, "interview_scheduled", `application ${d.applicationId.slice(-6)} round ${d.round}`);
  eventRepo
    .record({
      tenantId: session.tenantId,
      applicationId: d.applicationId,
      type: "interview_scheduled",
      actorId: session.userId,
      actorType: "recruiter",
      visibility: "candidate",
      metadata: { scheduledAt: d.scheduledAt, type: d.type, round: d.round },
    })
    .catch((err) => console.error("[interviews] event failed:", err));

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_WEB_URL || "http://localhost:3000";
  const companyName = process.env.NEXT_PUBLIC_COMPANY_NAME || "Our Company";
  emailService
    .sendInterviewInvitation({
      candidateFirstName: app.firstName,
      candidateEmail: app.email,
      jobTitle: app.job?.title || "the position",
      companyName,
      siteUrl,
      whenText: formatWhen(scheduledAt, d.timezone),
      interviewType: d.type,
      location: d.location || undefined,
      meetingUrl: d.meetingUrl || undefined,
    })
    .catch((err) => console.error("[interviews] invite email failed:", err));

  return NextResponse.json({ interview }, { status: 201, headers: NO_STORE });
}

/* --------------------------------------------------------------- PATCH */
export async function PATCH(req: Request) {
  if (flagOff()) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  if (!WRITE_ROLES.includes(session.role)) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403, headers: NO_STORE });
  if (!(await validateCsrf(req))) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403, headers: NO_STORE });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400, headers: NO_STORE }); }
  const parsed = safeParse(updateInterviewSchema, body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });
  const { id, action } = parsed.data;

  const existing = await interviewRepo.findByIdScoped(id, session.tenantId);
  if (!existing) return NextResponse.json({ error: "Interview not found" }, { status: 404, headers: NO_STORE });

  const statusByAction = { cancel: "cancelled", complete: "completed", no_show: "no_show" } as const;
  const status = statusByAction[action];
  const count = await interviewRepo.update(id, session.tenantId, { status });
  if (count === 0) return NextResponse.json({ error: "Interview not found" }, { status: 404, headers: NO_STORE });

  await writeAuditLog(session.userId, session.email, "interview_" + action, `interview ${id.slice(-6)}`);
  eventRepo
    .record({
      tenantId: session.tenantId,
      applicationId: existing.applicationId,
      type: action === "cancel" ? "interview_cancelled" : "interview_completed",
      actorId: session.userId,
      actorType: "recruiter",
      visibility: action === "cancel" ? "candidate" : "internal",
    })
    .catch((err) => console.error("[interviews] event failed:", err));

  if (action === "cancel") {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_WEB_URL || "http://localhost:3000";
    const companyName = process.env.NEXT_PUBLIC_COMPANY_NAME || "Our Company";
    emailService
      .sendInterviewInvitation({
        candidateFirstName: existing.application.firstName,
        candidateEmail: existing.application.email,
        jobTitle: existing.application.job?.title || "the position",
        companyName,
        siteUrl,
        whenText: formatWhen(existing.scheduledAt, existing.timezone),
        interviewType: existing.type,
        cancelled: true,
      })
      .catch((err) => console.error("[interviews] cancel email failed:", err));
  }

  return NextResponse.json({ success: true }, { headers: NO_STORE });
}
