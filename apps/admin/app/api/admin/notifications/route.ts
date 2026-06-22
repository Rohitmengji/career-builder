/*
 * Admin notification center (ADR-0009, Phase 4).
 *
 * GET   /api/admin/notifications   — the signed-in user's own notifications + unread count
 * PATCH /api/admin/notifications    — mark one ({id}) or all read (CSRF-guarded)
 *
 * Recipient-scoped by User id + tenant. Flag-gated; when off, GET returns an empty
 * feed so the dashboard bell stays quiet.
 */

import { NextResponse } from "next/server";
import { getSession, getSessionReadOnly, validateCsrf } from "@/lib/auth";
import { notificationRepo } from "@career-builder/database";
import { isEnabled } from "@career-builder/shared/feature-flags";

const NO_STORE = { "Cache-Control": "no-store" } as const;

export async function GET() {
  if (!isEnabled("notifications")) return NextResponse.json({ notifications: [], unread: 0 }, { headers: NO_STORE });
  const session = await getSessionReadOnly();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });

  const [notifications, unread] = await Promise.all([
    notificationRepo.listForRecipient(session.tenantId, "user", session.userId),
    notificationRepo.countUnread(session.tenantId, "user", session.userId),
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
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  if (!(await validateCsrf(req))) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403, headers: NO_STORE });

  let body: { id?: unknown } = {};
  try { body = await req.json(); } catch { /* mark-all */ }
  const now = new Date();
  if (typeof body?.id === "string" && body.id) {
    await notificationRepo.markRead(body.id, session.tenantId, "user", session.userId, now);
  } else {
    await notificationRepo.markAllRead(session.tenantId, "user", session.userId, now);
  }
  return NextResponse.json({ success: true }, { headers: NO_STORE });
}
