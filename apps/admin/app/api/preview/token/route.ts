/*
 * GET /api/preview/token?slug=<slug> — mint a short-lived preview token for the
 * current tenant's draft of <slug>, and return the public web preview URL.
 *
 * Auth: any signed-in non-viewer (editors who can see the draft anyway).
 */

import { NextResponse } from "next/server";
import { getSessionReadOnly } from "@/lib/auth";
import { createPreviewToken } from "@career-builder/shared/preview-token";
import { sanitizeSlug } from "@career-builder/security/sanitize";

export async function GET(req: Request) {
  const session = await getSessionReadOnly();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const rawSlug = searchParams.get("slug");
  if (!rawSlug) {
    return NextResponse.json({ error: "slug is required" }, { status: 400 });
  }
  const slug = sanitizeSlug(rawSlug);
  if (!slug) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }

  const token = createPreviewToken(session.tenantId, slug);

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  const previewUrl = `${siteUrl}/preview/${encodeURIComponent(slug)}?token=${encodeURIComponent(token)}`;

  return NextResponse.json({ token, previewUrl });
}
