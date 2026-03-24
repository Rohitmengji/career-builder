/**
 * Site Generator API — POST /api/ai/site
 *
 * Generates a complete multi-page career site using AI.
 * Auth-protected, subscription-gated, rate-limited.
 *
 * Request body: SiteGenerationInput
 * Response: GeneratedSite (for preview — NOT auto-applied)
 *
 * POST /api/ai/site                → generate full site
 * POST /api/ai/site?action=apply   → save all pages to DB
 * POST /api/ai/site?action=regen   → regenerate one page
 */

import { NextRequest, NextResponse } from "next/server";
import { generateSite, regeneratePage, type SiteGenerationInput, type GeneratedSite } from "@/lib/ai/site-generator";
import { subscriptionRepo, prisma } from "@career-builder/database";
import { savePage, loadPage } from "@/lib/store";
import { getSession, validateCsrf, writeAuditLog } from "@/lib/auth";

/* ================================================================== */
/*  Rate limiter (shared with /api/ai but separate bucket)             */
/* ================================================================== */

const siteRateLimits = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = siteRateLimits.get(ip);
  // 3 site generations per 10 minutes
  if (!entry || now > entry.resetAt) {
    siteRateLimits.set(ip, { count: 1, resetAt: now + 600_000 });
    return false;
  }
  entry.count++;
  return entry.count > 3;
}

/* ================================================================== */
/*  Auth helper                                                        */
/* ================================================================== */

async function getAuthUser(req: NextRequest): Promise<{ id: string; role: string } | null> {
  try {
    const cookieHeader = req.headers.get("cookie") || "";
    const res = await fetch(new URL("/api/auth", req.url), {
      headers: { cookie: cookieHeader },
    });
    const data = await res.json();
    if (data.authenticated && data.user) return data.user;
  } catch {}
  return null;
}

/* ================================================================== */
/*  POST handler                                                       */
/* ================================================================== */

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";

  // 1. Auth
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }
  if (user.role === "viewer") {
    return NextResponse.json({ success: false, error: "Insufficient permissions" }, { status: 403 });
  }

  // 2. Subscription check — site generation costs 5 credits
  const SITE_GEN_CREDITS = 5;
  const aiCheck = await subscriptionRepo.canUseAi(user.id);
  if (!aiCheck.allowed) {
    return NextResponse.json({
      success: false,
      error: aiCheck.reason || "AI features require a Pro or Enterprise plan.",
    }, { status: 403 });
  }

  // 3. Parse body
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  // ─── ACTION: APPLY — save generated site to database ──────────
  if (action === "apply") {
    return handleApply(req, body, user);
  }

  // ─── ACTION: REGEN — regenerate one page ──────────────────────
  if (action === "regen") {
    return handleRegen(req, body, user, ip);
  }

  // ─── DEFAULT: GENERATE full site ──────────────────────────────

  // Rate limit
  if (isRateLimited(ip)) {
    return NextResponse.json({
      success: false,
      error: "Rate limit exceeded — max 3 site generations per 10 minutes.",
    }, { status: 429 });
  }

  // Validate input
  const input: SiteGenerationInput = {
    companyName: body.companyName?.trim() || "",
    industry: body.industry || "technology",
    companyType: body.companyType || "startup",
    tone: body.tone || "professional",
    hiringGoals: body.hiringGoals?.trim() || "",
    audience: body.audience || "general",
    prompt: body.prompt?.trim()?.slice(0, 2000) || "",
  };

  // Inject tenant ID so generateSite can fetch live job data
  try {
    const session = await getSession();
    if (session?.tenantId) input.tenantId = session.tenantId;
  } catch {}

  if (!input.companyName) {
    return NextResponse.json({ success: false, error: "Company name is required" }, { status: 400 });
  }

  // Pre-pay credits (5 for full site gen)
  let creditsDeducted = 0;
  for (let i = 0; i < SITE_GEN_CREDITS; i++) {
    const ok = await subscriptionRepo.decrementCredit(user.id);
    if (!ok) break;
    creditsDeducted++;
  }

  if (creditsDeducted === 0) {
    return NextResponse.json({
      success: false,
      error: "No AI credits remaining. Please upgrade your plan.",
    }, { status: 403 });
  }

  try {
    const site = await generateSite(input);

    // Audit log
    try {
      await writeAuditLog(
        user.id, "", "site_generate",
        `pages: ${site.pages.length}, blocks: ${site.pages.reduce((s, p) => s + p.blocks.length, 0)}`,
      );
    } catch {}

    return NextResponse.json({
      success: true,
      site,
      creditsUsed: creditsDeducted,
    });
  } catch (err: any) {
    // Refund credits on failure
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { aiCredits: { increment: creditsDeducted } },
      });
    } catch {}

    console.error("[SiteGen API] Error:", err.message);
    return NextResponse.json({
      success: false,
      error: process.env.NODE_ENV !== "production"
        ? `Site generation failed: ${err.message}`
        : "Site generation failed. Please try again.",
    }, { status: 500 });
  }
}

/* ================================================================== */
/*  Apply: save all pages to DB                                        */
/* ================================================================== */

async function handleApply(
  req: NextRequest,
  body: any,
  user: { id: string; role: string },
) {
  // Get session for tenant ID and CSRF
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Session expired" }, { status: 401 });
  }

  const csrfValid = await validateCsrf(req);
  if (!csrfValid) {
    return NextResponse.json({ success: false, error: "Invalid CSRF token" }, { status: 403 });
  }

  const site: GeneratedSite = body.site;
  if (!site || !Array.isArray(site.pages) || site.pages.length === 0) {
    return NextResponse.json({ success: false, error: "No pages to save" }, { status: 400 });
  }

  // Create backups of existing pages
  const backups: Array<{ slug: string; blocks: any[] }> = [];

  try {
    for (const page of site.pages) {
      // Backup existing page
      const existing = await loadPage(page.slug, session.tenantId);
      if (existing && existing.length > 0) {
        backups.push({ slug: page.slug, blocks: existing });
      }

      // Save new page
      await savePage(page.slug, page.blocks, session.tenantId);
    }

    // Audit log
    try {
      await writeAuditLog(
        session.userId, session.email, "site_apply",
        `pages: ${site.pages.map((p) => p.slug).join(", ")}`,
      );
    } catch {}

    // Notify preview listeners
    for (const page of site.pages) {
      globalThis.__previewListeners?.forEach((cb: (slug: string) => void) => cb(page.slug));
    }

    return NextResponse.json({
      success: true,
      pagesCreated: site.pages.map((p) => p.slug),
      backupsCreated: backups.length,
    });
  } catch (err: any) {
    // Attempt to restore backups
    for (const backup of backups) {
      try {
        await savePage(backup.slug, backup.blocks, session.tenantId);
      } catch {}
    }

    return NextResponse.json({
      success: false,
      error: "Failed to save pages. Previous versions restored.",
    }, { status: 500 });
  }
}

/* ================================================================== */
/*  Regen: regenerate one page                                         */
/* ================================================================== */

async function handleRegen(
  req: NextRequest,
  body: any,
  user: { id: string; role: string },
  ip: string,
) {
  const { site, pageIndex, input, regenOption } = body;

  if (!site || typeof pageIndex !== "number" || !input) {
    return NextResponse.json({
      success: false,
      error: "Missing site, pageIndex, or input",
    }, { status: 400 });
  }

  // 1 credit per page regen
  const ok = await subscriptionRepo.decrementCredit(user.id);
  if (!ok) {
    return NextResponse.json({
      success: false,
      error: "No AI credits remaining.",
    }, { status: 403 });
  }

  try {
    const updatedSite = await regeneratePage(site, pageIndex, input, regenOption);

    return NextResponse.json({
      success: true,
      site: updatedSite,
      creditsUsed: 1,
    });
  } catch (err: any) {
    // Refund
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { aiCredits: { increment: 1 } },
      });
    } catch {}

    return NextResponse.json({
      success: false,
      error: `Regeneration failed: ${err.message}`,
    }, { status: 500 });
  }
}
