/*
 * Application comments — internal hiring-team discussion (never visible to candidates).
 *
 * GET    /api/admin/applications/[id]/comments              — list
 * POST   /api/admin/applications/[id]/comments              — add (parses @mentions, notifies)
 * DELETE /api/admin/applications/[id]/comments?commentId=…  — author-only delete
 *
 * Recruiter+ only. Every path verifies the application belongs to session.tenantId,
 * and mention userIds are re-validated against the tenant's members before any
 * notification (no cross-tenant notify / user enumeration).
 */

import { NextResponse } from "next/server";
import { getSession, getSessionReadOnly, validateCsrf, writeAuditLog } from "@/lib/auth";
import { applicationRepo, commentRepo, userRepo, auditRepo } from "@career-builder/database";
import { createCommentSchema, safeParse } from "@career-builder/security/validate";
import { emailService } from "@career-builder/email";
import { extractMentionIds } from "@/lib/mentions";
import { getBlindHiringConfig } from "@/lib/blindHiring";
import { redactedLabel } from "@career-builder/shared/blind-hiring";

const WRITE_ROLES = ["super_admin", "admin", "hiring_manager", "recruiter"];

function parseMentionsJson(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ GET */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionReadOnly();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role === "viewer") return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });

  const { id } = await params;
  const app = await applicationRepo.findByIdScoped(id, session.tenantId);
  if (!app) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  // Record the recruiter's view of this candidate for the candidate-visible
  // "who viewed me" log (best-effort — never fail the read on an audit error).
  auditRepo.logProfileView(session.tenantId, id, session.userId).catch(() => {});

  const comments = await commentRepo.listByApplication(id, session.tenantId);
  return NextResponse.json(
    { comments: comments.map((c) => ({ ...c, mentions: parseMentionsJson(c.mentions) })) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/* ------------------------------------------------------------------ POST */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!WRITE_ROLES.includes(session.role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }
  if (!(await validateCsrf(req))) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });

  const { id } = await params;
  const app = await applicationRepo.findByIdScoped(id, session.tenantId);
  if (!app) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = safeParse(createCommentSchema, body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400 });

  // Mentions are derived from the body and re-validated against tenant members.
  const requestedIds = extractMentionIds(parsed.data.body);
  const teamUsers = requestedIds.length > 0 ? await userRepo.findByTenant(session.tenantId) : [];
  const byId = new Map(teamUsers.map((u) => [u.id, u]));
  const validMentionIds = requestedIds.filter((mid) => byId.has(mid));

  const comment = await commentRepo.create({
    tenantId: session.tenantId,
    applicationId: id,
    authorId: session.userId,
    body: parsed.data.body,
    mentions: validMentionIds,
  });
  await writeAuditLog(session.userId, session.email, "application_comment_add", `application: ${id}`);

  // Notify mentioned teammates (exclude the author). Fire-and-forget.
  const recipients = validMentionIds.filter((mid) => mid !== session.userId);
  if (recipients.length > 0) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.ADMIN_API_URL || "http://localhost:3001";
    const url = `${appUrl.replace(/\/$/, "")}/applications`;
    // Blind hiring: don't leak the candidate's name into mention emails (they
    // leave the app — provider, logs, archives). Use the redacted label.
    const blind = await getBlindHiringConfig(session.tenantId);
    const candidateName = blind.enabled ? redactedLabel(app.id) : `${app.firstName} ${app.lastName}`;
    const jobTitle = app.job?.title || "the position";
    Promise.allSettled(
      recipients.map((mid) => {
        const u = byId.get(mid)!;
        return emailService.sendMentionNotification({
          to: u.email,
          mentionedFirstName: u.name?.split(" ")[0],
          actorName: session.email,
          candidateName,
          jobTitle,
          excerpt: parsed.data.body,
          url,
        });
      }),
    ).catch((err) => console.error("[comments] mention emails failed:", err));
  }

  return NextResponse.json(
    { comment: { ...comment, mentions: validMentionIds } },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}

/* ------------------------------------------------------------------ DELETE */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role === "viewer") return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  if (!(await validateCsrf(req))) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });

  const { id } = await params;
  const commentId = new URL(req.url).searchParams.get("commentId") || "";
  if (!commentId) return NextResponse.json({ error: "Missing commentId." }, { status: 400 });

  // Verify the comment exists in this tenant AND belongs to the URL's application
  // (honor the route), then enforce author-only deletion — clean 404 vs 403.
  const comment = await commentRepo.findOwned(commentId, session.tenantId);
  if (!comment || comment.applicationId !== id) {
    return NextResponse.json({ error: "Comment not found." }, { status: 404 });
  }
  if (comment.authorId !== session.userId) {
    return NextResponse.json({ error: "You can only delete your own comments." }, { status: 403 });
  }

  const count = await commentRepo.deleteOwn(commentId, session.tenantId, session.userId);
  if (count === 0) return NextResponse.json({ error: "Comment not found." }, { status: 404 });
  await writeAuditLog(session.userId, session.email, "application_comment_delete", `comment: ${commentId}`);
  return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
}
