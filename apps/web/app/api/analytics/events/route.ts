/*
 * Analytics Events API — receives client-side tracking events.
 *
 * POST /api/analytics/events
 * Body: { type, jobId?, pageSlug?, sessionId?, referrer?, utmSource?, utmMedium?, utmCampaign?, metadata? }
 *
 * Returns: 200 { ok: true }
 *
 * Rate limited to 30 req/min per IP to prevent abuse.
 * tenantId resolved from TENANT_ID env var (web app is single-tenant).
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { analyticsRepo } from "@career-builder/database/repositories";
import { getRateLimiter, getClientIp } from "@career-builder/security/rate-limit";

const eventSchema = z.object({
  type: z.string().min(1).max(50).regex(/^[a-z_]+$/),
  jobId: z.string().max(50).optional(),
  pageSlug: z.string().max(200).optional(),
  sessionId: z.string().max(100).optional(),
  referrer: z.string().max(500).optional(),
  utmSource: z.string().max(100).optional(),
  utmMedium: z.string().max(100).optional(),
  utmCampaign: z.string().max(100).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const ALLOWED_TYPES = new Set([
  "page_view",
  "job_list_view",
  "job_view",
  "apply_start",
  "apply_complete",
  "search",
]);

export async function POST(request: Request) {
  try {
    // Rate limit — 30 events/min per IP
    const limiter = getRateLimiter("public");
    const ip = getClientIp(request) || "unknown";
    const rl = limiter.check(`analytics:${ip}`);
    if (!rl.allowed) {
      return NextResponse.json({ ok: false }, { status: 429 });
    }

    const body = await request.json();
    const parsed = eventSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Invalid event" }, { status: 400 });
    }

    const data = parsed.data;

    // Only track known event types (ignore unknown to prevent data pollution)
    if (!ALLOWED_TYPES.has(data.type)) {
      return NextResponse.json({ ok: true }); // silently ignore
    }

    const tenantId = process.env.TENANT_ID || "default";

    await analyticsRepo.track({
      type: data.type,
      tenantId,
      jobId: data.jobId,
      pageSlug: data.pageSlug,
      sessionId: data.sessionId,
      referrer: data.referrer,
      utmSource: data.utmSource,
      utmMedium: data.utmMedium,
      utmCampaign: data.utmCampaign,
      metadata: data.metadata,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    // Never let analytics errors surface to users
    console.error("[analytics]", err);
    return NextResponse.json({ ok: true });
  }
}
