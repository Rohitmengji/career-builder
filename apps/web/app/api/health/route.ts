import { NextResponse } from "next/server";
import { metrics } from "@career-builder/observability/metrics";
import { prisma } from "@career-builder/database/client";
import { checkDbHealth } from "@career-builder/database/resilience";

const startTime = Date.now();

/**
 * GET /api/health — Production-grade health check endpoint.
 *
 * Returns:
 *   - status: "ok" | "degraded" | "unhealthy"
 *   - DB connectivity + latency
 *   - Uptime
 *   - Deploy environment info
 *   - Git SHA for version tracking
 */
export async function GET() {
  const dbHealth = await checkDbHealth(prisma);

  const status = dbHealth.healthy ? "ok" : "degraded";
  const httpStatus = dbHealth.healthy ? 200 : 503;

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
        ...(dbHealth.error && { error: dbHealth.error }),
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
