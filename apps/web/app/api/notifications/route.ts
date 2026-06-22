/*
 * Candidate notification center (ADR-0009, Phase 4).
 *
 * GET   /api/notifications   — the candidate's own notifications + unread count
 * PATCH /api/notifications   — mark one ({id}) or all read
 *
 * Recipient-scoped by email + tenant (ADR-0001). CSRF is enforced by the web
 * middleware (same-origin). Flag-gated; when off, GET returns an empty feed so the
 * always-mounted header bell stays quiet rather than erroring.
 */

import { NextResponse } from "next/server";
import { getCandidateSession } from "@/lib/candidateAuth";
import { notificationRepo } from "@career-builder/database";
import { isEnabled } from "@career-builder/shared/feature-flags";

const NO_STORE = { "Cache-Control": "no-store" } as const;

export async function GET() {
  if (!isEnabled("notifications")) return NextResponse.json({ notifications: [], unread: 0 }, { headers: NO_STORE });
  const session = await getCandidateSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });

  const [notifications, unread] = await Promise.all([
    notificationRepo.listForRecipient(session.tenantId, "candidate", session.email),
    notificationRepo.countUnread(session.tenantId, "candidate", session.email),
  ]);
  const safe = notifications.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    link: n.link,
    readAt: n.readAt ? n.readAt.toISOString() : null,
    createdAt: n.createdAt.toISOString(),
  }));
  return NextResponse.json({ notifications: safe, unread }, { headers: NO_STORE });
}

export async function PATCH(req: Request) {
  if (!isEnabled("notifications")) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  const session = await getCandidateSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });

  let body: { id?: unknown } = {};
  try { body = await req.json(); } catch { /* mark-all */ }
  const now = new Date();
  if (typeof body?.id === "string" && body.id) {
    await notificationRepo.markRead(body.id, session.tenantId, "candidate", session.email, now);
  } else {
    await notificationRepo.markAllRead(session.tenantId, "candidate", session.email, now);
  }
  return NextResponse.json({ success: true }, { headers: NO_STORE });
}
