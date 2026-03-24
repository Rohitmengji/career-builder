import { NextResponse } from "next/server";
import { getSession, getSessionReadOnly, validateCsrf } from "@/lib/auth";
import { publishQueue } from "@/lib/deployment/publishQueue";

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
