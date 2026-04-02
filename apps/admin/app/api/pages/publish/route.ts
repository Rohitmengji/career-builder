import { NextResponse } from "next/server";
import { publishPage, getPublishStatus } from "@/lib/store";
import { getSession, validateCsrf, writeAuditLog } from "@/lib/auth";
import { sanitizeSlug } from "@career-builder/security/sanitize";
import { withRequestLogging } from "@career-builder/observability/request-logger";
import { logger } from "@career-builder/observability/logger";
import { metrics, METRIC } from "@career-builder/observability/metrics";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  var __previewListeners: Set<(slug: string) => void> | undefined;
}

const log = logger.admin;

/**
 * POST /api/pages/publish — Publish a page (copy draft → live)
 *
 * Body: { slug: string }
 *
 * This copies the current draft blocks to publishedBlocks,
 * notifies SSE listeners, and returns the published version.
 */
export const POST = withRequestLogging(async (req: Request) => {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only admins and hiring managers can publish
  if (session.role === "viewer" || session.role === "recruiter") {
    return NextResponse.json({ error: "Insufficient permissions — only admins can publish" }, { status: 403 });
  }

  const csrfValid = await validateCsrf(req);
  if (!csrfValid) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const slug = body?.slug;
  if (!slug || typeof slug !== "string") {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  const sanitizedSlug = sanitizeSlug(slug);

  try {
    const result = await publishPage(sanitizedSlug, session.tenantId, session.userId, session.email);

    if (!result.success) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    metrics.increment(METRIC.PAGE_SAVES, { tenantId: session.tenantId, action: "publish" });

    // Audit log
    try {
      await writeAuditLog(
        session.userId,
        session.email,
        "update_page",
        `slug: ${sanitizedSlug}, action: publish, version: ${result.version}`,
      );
    } catch {
      // non-fatal
    }

    // NOW notify SSE listeners — this is the moment changes go live
    globalThis.__previewListeners?.forEach((cb: (slug: string) => void) => cb(sanitizedSlug));

    log.info("page_published", {
      slug: sanitizedSlug,
      tenantId: session.tenantId,
      version: result.version,
      userId: session.userId,
    });

    return NextResponse.json({
      success: true,
      version: result.version,
      publishedAt: result.publishedAt.toISOString(),
    });
  } catch (err) {
    log.error("page_publish_failed", {
      slug: sanitizedSlug,
      tenantId: session.tenantId,
      error: String(err),
    });
    return NextResponse.json({ error: "Failed to publish page" }, { status: 500 });
  }
});

/**
 * GET /api/pages/publish?slug=xxx — Get publish status for a page
 */
export const GET = withRequestLogging(async (req: Request) => {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  const status = await getPublishStatus(sanitizeSlug(slug), session.tenantId);
  if (!status) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 });
  }

  return NextResponse.json({
    version: status.version,
    publishedVersion: status.publishedVersion,
    hasUnpublishedChanges: status.hasUnpublishedChanges,
    publishedAt: status.publishedAt?.toISOString() ?? null,
  });
});
