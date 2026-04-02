import { NextResponse } from "next/server";
import { getSession, getSessionReadOnly, validateCsrf, writeAuditLog } from "@/lib/auth";
import { pageRepo, pageVersionRepo } from "@career-builder/database";
import { sanitizeSlug } from "@career-builder/security/sanitize";
import { withRequestLogging } from "@career-builder/observability/request-logger";
import { logger } from "@career-builder/observability/logger";

const log = logger.admin;

/**
 * GET /api/pages/versions?slug=xxx&limit=20&offset=0
 *
 * List version history for a page. Requires authenticated session.
 */
export const GET = withRequestLogging(async (req: Request) => {
  const session = await getSessionReadOnly();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ error: "Missing slug parameter" }, { status: 400 });
  }

  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 50);
  const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);

  try {
    const page = await pageRepo.findBySlug(sanitizeSlug(slug), session.tenantId);
    if (!page) {
      return NextResponse.json({ versions: [], total: 0 });
    }

    const [versions, total] = await Promise.all([
      pageVersionRepo.listByPage(page.id, session.tenantId, limit, offset),
      pageVersionRepo.countByPage(page.id, session.tenantId),
    ]);

    return NextResponse.json({ versions, total, currentVersion: page.version });
  } catch (err) {
    log.error("page_versions_list_failed", {
      slug,
      tenantId: session.tenantId,
      error: String(err),
    });
    return NextResponse.json({ error: "Failed to load version history" }, { status: 500 });
  }
});

/**
 * POST /api/pages/versions — Restore a specific version
 *
 * Body: { slug: string, version: number }
 *
 * Restores the page to a previous version's blocks content.
 * The restore itself creates a NEW version (it doesn't rewrite history).
 */
export const POST = withRequestLogging(async (req: Request) => {
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

  const body = await req.json();
  const slug = body?.slug;
  const version = body?.version;

  if (!slug || typeof slug !== "string") {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }
  if (typeof version !== "number" || version < 1) {
    return NextResponse.json({ error: "Invalid version number" }, { status: 400 });
  }

  try {
    const page = await pageRepo.findBySlug(sanitizeSlug(slug), session.tenantId);
    if (!page) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    // Load the target version
    const targetVersion = await pageVersionRepo.findByVersion(page.id, version, session.tenantId);
    if (!targetVersion) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    // Save the restored blocks as a new version (creates a new history entry)
    const result = await pageRepo.upsert(
      slug,
      session.tenantId,
      targetVersion.blocks,
      targetVersion.title || undefined,
      undefined, // Skip conflict check for restores
      session.userId,
      session.email,
    );

    // Audit log
    try {
      await writeAuditLog(
        session.userId,
        session.email,
        "page_restore",
        `slug: ${slug}, restored from version ${version} to version ${result.version}`,
      );
    } catch {
      // non-fatal
    }

    log.info("page_version_restored", {
      slug,
      tenantId: session.tenantId,
      fromVersion: version,
      toVersion: result.version,
      userId: session.userId,
    });

    // Parse restored blocks for client
    let blocks = [];
    try {
      blocks = JSON.parse(targetVersion.blocks);
    } catch {
      blocks = [];
    }

    return NextResponse.json({
      success: true,
      version: result.version,
      updatedAt: result.updatedAt.toISOString(),
      blocks,
    });
  } catch (err) {
    log.error("page_version_restore_failed", {
      slug,
      version,
      tenantId: session.tenantId,
      error: String(err),
    });
    return NextResponse.json({ error: "Failed to restore version" }, { status: 500 });
  }
});
