import { NextResponse } from "next/server";
import { savePage, loadPage, listPages, deletePage } from "@/lib/store";
import { getSession, getSessionReadOnly, validateCsrf, writeAuditLog } from "@/lib/auth";
import { savePageSchema, safeParse } from "@career-builder/security/validate";
import { sanitizeSlug, sanitizeBlockProps } from "@career-builder/security/sanitize";
import { withRequestLogging } from "@career-builder/observability/request-logger";
import { logger } from "@career-builder/observability/logger";
import { metrics, METRIC } from "@career-builder/observability/metrics";

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

  try {
    await savePage(slug, blocks, session.tenantId);
    metrics.increment(METRIC.PAGE_SAVES, { tenantId: session.tenantId });
  } catch (err) {
    log.error("page_save_failed", { slug, tenantId: session.tenantId, error: String(err) });
    return NextResponse.json({ error: "Failed to save page" }, { status: 500 });
  }

  // Audit log is best-effort — don't block the save response
  try {
    await writeAuditLog(session.userId, session.email, "page_save", `slug: ${slug}, blocks: ${blocks.length}`);
  } catch {
    // non-fatal
  }

  // Notify SSE listeners (preview sync)
  globalThis.__previewListeners?.forEach((cb: (slug: string) => void) => cb(slug));

  return NextResponse.json({ success: true });
});

/** GET /api/pages — read a page (public — web app needs this) */
export const GET = withRequestLogging(async (req: Request) => {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");

  // Try to get tenant ID from session (admin), fall back to default for public access (web app)
  let tenantId: string | undefined;
  try {
    const session = await getSessionReadOnly();
    tenantId = session?.tenantId;
  } catch {
    // Public access — use default tenant
  }

  if (slug) {
    const blocks = await loadPage(slug, tenantId);
    return NextResponse.json({ blocks });
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