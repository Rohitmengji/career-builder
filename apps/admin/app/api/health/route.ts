import { NextResponse } from "next/server";
import { metrics } from "@career-builder/observability/metrics";
import { prisma } from "@career-builder/database/client";
import { checkDbHealth } from "@career-builder/database/resilience";

const startTime = Date.now();

/**
 * GET /api/health — Admin app health check.
 * Returns system status, DB health, and service configuration status.
 */
export async function GET() {
  const dbHealth = await checkDbHealth(prisma);

  const stripeConfigured = !!(
    process.env.STRIPE_SECRET_KEY &&
    !process.env.STRIPE_SECRET_KEY.includes("REPLACE_ME")
  );
  const aiConfigured = !!(
    process.env.OPENAI_API_KEY &&
    !process.env.OPENAI_API_KEY.includes("REPLACE_ME")
  );

  const status = dbHealth.healthy ? "ok" : "degraded";
  const httpStatus = dbHealth.healthy ? 200 : 503;

  // Database URL info (safe — never expose full URL, only provider type)
  const rawDbUrl = process.env.DATABASE_URL || "";
  const dbUrlType = rawDbUrl.startsWith("libsql://") ? "turso"
    : rawDbUrl.startsWith("file:") ? "sqlite-file"
    : rawDbUrl.startsWith("postgres") ? "postgresql"
    : rawDbUrl ? "unknown" : "NOT_SET";

  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
      uptime: metrics.snapshot().uptime,
      uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
      version: process.env.npm_package_version || "0.1.0",
      gitSha: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "local",
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown",
      database: {
        healthy: dbHealth.healthy,
        latencyMs: dbHealth.latencyMs,
        provider: dbHealth.provider,
        urlType: dbUrlType,
        isVercel: !!process.env.VERCEL,
        ...(dbHealth.error && { error: dbHealth.error }),
      },
      services: {
        stripe: stripeConfigured ? "configured" : "not_configured",
        ai: aiConfigured ? "configured" : "not_configured",
      },
    },
    {
      status: httpStatus,
      headers: {
        "Cache-Control": "no-store, must-revalidate",
      },
    },
  );
}
