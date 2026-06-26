/*
 * Public health-check route for the career-site app (apps/web): GET /api/health.
 *
 * WHAT: An unauthenticated liveness/readiness probe. Reports process uptime,
 * build identity (version + git SHA + deploy env), and live DB connectivity.
 *
 * WHY: Load balancers / uptime monitors / deploy pipelines hit this to decide
 * whether an instance should receive traffic. It is intentionally NOT tenant-
 * scoped — there is no per-host tenant resolution and no getCandidateSession()
 * here, because it checks the instance itself, not any tenant's data.
 *
 * HOW: DB health comes from checkDbHealth() in packages/database/resilience (a
 * lightweight, non-tenant ping). When the DB is reachable we return "ok" / 200;
 * when it is not we return "degraded" / 503 so the orchestrator pulls this
 * instance out of rotation. Response is no-store so probes never read a cached
 * "ok" after the instance has gone unhealthy.
 */
import { NextResponse } from "next/server";
import { metrics } from "@career-builder/observability/metrics";
import { prisma } from "@career-builder/database/client";
import { checkDbHealth } from "@career-builder/database/resilience";

// Captured once at module load (cold start), so uptimeSeconds measures how long
// THIS instance has been alive — not the age of the request.
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

  // 503 (not 500) signals "temporarily out of rotation" to the orchestrator;
  // "degraded" rather than "unhealthy" reflects that the process is up but its
  // DB dependency is failing.
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
