import { NextResponse } from "next/server";
import { prisma } from "@career-builder/database/client";

/**
 * GET /api/ready — Readiness probe for deployment orchestration.
 *
 * Returns 200 only when the app can serve requests:
 *   - Database is reachable
 *   - Required env vars are present
 *
 * Used by:
 *   - Vercel health checks
 *   - Load balancers
 *   - Uptime monitors
 *
 * Unlike /api/health, this is minimal and fast — no metrics, no verbose data.
 */
export async function GET() {
  try {
    // Check DB connectivity (lightweight query)
    await prisma.$queryRawUnsafe("SELECT 1");

    // Check critical env vars
    const hasDatabase = !!process.env.DATABASE_URL;
    const hasTenant = !!process.env.TENANT_ID;

    if (!hasDatabase || !hasTenant) {
      return NextResponse.json(
        { ready: false, reason: "Missing critical environment variables" },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { ready: true },
      {
        status: 200,
        headers: { "Cache-Control": "no-store, max-age=0" },
      },
    );
  } catch (err: unknown) {
    return NextResponse.json(
      {
        ready: false,
        reason: "Database unreachable",
      },
      { status: 503 },
    );
  }
}
