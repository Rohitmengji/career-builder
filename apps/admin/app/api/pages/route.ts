import { NextResponse } from "next/server";
import { savePage, loadPage, listPages, deletePage, publishPage, getPublishStatus } from "@/lib/store";
import { getSession, getSessionReadOnly, validateCsrf, writeAuditLog } from "@/lib/auth";
import { savePageSchema, safeParse } from "@career-builder/security/validate";
import { sanitizeSlug, sanitizeBlockProps } from "@career-builder/security/sanitize";
import { withRequestLogging } from "@career-builder/observability/request-logger";
import { logger } from "@career-builder/observability/logger";
import { metrics, METRIC } from "@career-builder/observability/metrics";
import { pageRepo } from "@career-builder/database";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  var __previewListeners: Set<(slug: string) => void> | undefined;
}

const log = logger.admin;

/** POST /api/pages — save a page (auth + CSRF required, editor role+) */
export const POST = withRequestLogging(async (req: Request) => {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Viewers cannot save
  if (session.role === "viewer") {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  // CSRF check
  const csrfValid = await validateCsrf(req);
  if (!csrfValid) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  const body = await req.json();

  // Validate with Zod schema
  const parsed = safeParse(savePageSchema, body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const slug = sanitizeSlug(parsed.data.slug);
  // Sanitize each block's props to prevent XSS in GrapesJS data
  const blocks = (parsed.data.blocks as any[]).map((block: any) => {
    if (block && typeof block === "object" && block.props) {
      try {
        return { ...block, props: sanitizeBlockProps(block.props) };
      } catch {
        return block;
      }
    }
    return block;
  });

  // Extract optional expectedVersion for conflict detection
  const expectedVersion = typeof body.expectedVersion === "number" ? body.expectedVersion : undefined;

  try {
    const result = await savePage(slug, blocks, session.tenantId, {
      expectedVersion,
      savedBy: session.userId,
      savedByEmail: session.email,
    });

    // Conflict detected — another user saved since this client last loaded
    if (result.conflict) {
      log.warn("page_save_conflict", {
        slug,
        tenantId: session.tenantId,
        expectedVersion,
        currentVersion: result.version,
        userId: session.userId,
      });
      return NextResponse.json({
        error: "Conflict: This page was modified by another user. Please reload and try again.",
        conflict: true,
        currentVersion: result.version,
        updatedAt: result.updatedAt.toISOString(),
      }, { status: 409 });
    }

    metrics.increment(METRIC.PAGE_SAVES, { tenantId: session.tenantId });

    // Audit log is best-effort — don't block the save response
    try {
      await writeAuditLog(session.userId, session.email, "page_save", `slug: ${slug}, blocks: ${blocks.length}, version: ${result.version}`);
    } catch {
      // non-fatal
    }

    // Check if this page has unpublished changes
    const pubStatus = await getPublishStatus(slug, session.tenantId);
    const hasUnpublishedChanges = pubStatus?.hasUnpublishedChanges ?? true;

    return NextResponse.json({
      success: true,
      version: result.version,
      updatedAt: result.updatedAt.toISOString(),
      hasUnpublishedChanges,
    });
  } catch (err) {
    log.error("page_save_failed", { slug, tenantId: session.tenantId, error: String(err) });
    return NextResponse.json({ error: "Failed to save page" }, { status: 500 });
  }
});

/** GET /api/pages — read a page
 *  - With session (admin editor): returns draft blocks + publish status
 *  - Without session (web app / public): returns published blocks only
 */
export const GET = withRequestLogging(async (req: Request) => {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  const source = searchParams.get("source"); // "published" for web app

  // Try to get tenant ID from session (admin), fall back to default for public access (web app)
  let tenantId: string | undefined;
  let isAdmin = false;
  try {
    const session = await getSessionReadOnly();
    tenantId = session?.tenantId;
    isAdmin = !!session;
  } catch {
    // Public access — use default tenant
  }

  if (slug) {
    // If request is from admin editor (has session and not requesting published), return draft
    if (isAdmin && source !== "published") {
      const result = await loadPage(slug, tenantId);
      const pubStatus = await getPublishStatus(slug, tenantId);
      return NextResponse.json({
        blocks: result.blocks,
        version: result.version,
        updatedAt: result.updatedAt.toISOString(),
        hasUnpublishedChanges: pubStatus?.hasUnpublishedChanges ?? false,
        publishedVersion: pubStatus?.publishedVersion ?? 0,
        publishedAt: pubStatus?.publishedAt?.toISOString() ?? null,
      });
    }

    // Public / web app — serve published blocks only
    const page = await pageRepo.findBySlug(slug, tenantId || process.env.TENANT_ID || "default");
    if (!page) {
      return NextResponse.json({ blocks: [] });
    }

    // Serve publishedBlocks if available, otherwise fall back to blocks
    // (backward compat: pages published before this feature have publishedBlocks = "[]")
    let publishedBlocks: unknown[] = [];
    try {
      const parsed = JSON.parse(page.publishedBlocks || "[]");
      if (Array.isArray(parsed) && parsed.length > 0) {
        publishedBlocks = parsed;
      } else {
        // Fallback: if publishedBlocks is empty, serve draft blocks
        // (backward compat for pages that existed before publish feature)
        publishedBlocks = JSON.parse(page.blocks || "[]");
      }
    } catch {
      try {
        publishedBlocks = JSON.parse(page.blocks || "[]");
      } catch {
        publishedBlocks = [];
      }
    }

    return NextResponse.json({ blocks: publishedBlocks });
  }

  // List all pages
  const pages = await listPages(tenantId);
  return NextResponse.json({ pages });
});

/** DELETE /api/pages?slug=xxx — delete a page (auth + CSRF required) */
export const DELETE = withRequestLogging(async (req: Request) => {
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

  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ error: "Missing slug parameter" }, { status: 400 });
  }

  try {
    await deletePage(sanitizeSlug(slug), session.tenantId);
    try {
      await writeAuditLog(session.userId, session.email, "page_delete", `slug: ${slug}`);
    } catch { /* non-fatal */ }
    return NextResponse.json({ success: true });
  } catch (err) {
    log.error("page_delete_failed", { slug, tenantId: session.tenantId, error: String(err) });
    return NextResponse.json({ error: "Failed to delete page" }, { status: 500 });
  }
});