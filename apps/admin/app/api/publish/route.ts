import { NextResponse } from "next/server";
import { getSession, getSessionReadOnly, validateCsrf } from "@/lib/auth";
import { publishQueue } from "@/lib/deployment/publishQueue";

/*
 * /api/publish — drives the deployment publish queue for the career-site builder.
 *
 * WHAT: GET reports queue status; POST flushes the queue, publishing all pending page
 * changes immediately instead of waiting for the queue's normal cadence.
 *
 * WHY: Editors stage page edits which are batched by publishQueue; this endpoint lets
 * a recruiter trigger an on-demand publish (and inspect queue state from the UI).
 *
 * HOW it fits in:
 *   - GET is a read → getSessionReadOnly(); POST mutates → getSession() + validateCsrf().
 *   - POST is gated on role: "viewer" is read-only and gets 403 (other roles may publish).
 *   - Actual work lives in @/lib/deployment/publishQueue (a process-level singleton);
 *     this route is a thin auth/permission wrapper over it.
 *   - success is reported false if publishNow() returns any per-page errors, even on 200.
 */
/**
 * GET /api/publish — Get publish queue status.
 * POST /api/publish — Trigger immediate publish of all queued changes.
 */

export async function GET() {
  const session = await getSessionReadOnly();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    success: true,
    data: publishQueue.getStatus(),
  });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.role === "viewer") {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const csrfValid = await validateCsrf(req);
  if (!csrfValid) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  const result = await publishQueue.publishNow();

  return NextResponse.json({
    success: result.errors.length === 0,
    data: {
      published: result.published,
      errors: result.errors,
      status: publishQueue.getStatus(),
    },
  });
}
