import { NextResponse } from "next/server";
import { metrics, metricsHistory } from "@career-builder/observability/metrics";
import { alertManager } from "@career-builder/observability/alerts";
import { anomalyDetector, ANOMALY_METRIC } from "@career-builder/observability/anomaly";
import { getBlockedIps, unblockIp } from "@career-builder/observability/bot-detection";
import { getBudgetViolations } from "@career-builder/observability/performance";
import { getSession, getSessionReadOnly } from "@/lib/auth";

// Side-effect: wire up DB alert persistence on first import
import "@/lib/observability-init";

/**
 * GET /api/admin/metrics — Observability dashboard data.
 * Admin-only. Returns metrics snapshot, history, anomaly stats,
 * alert history, blocked IPs, performance budget violations.
 *
 * Query params:
 *   ?range=60   — last N minutes of history (default: 60)
 *   ?from=epoch — start of time range (ms)
 *   ?to=epoch   — end of time range (ms)
 */
export async function GET(req: Request) {
  const session = await getSessionReadOnly();
  if (!session || (session.role !== "admin" && session.role !== "super_admin")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const rangeMinutes = parseInt(url.searchParams.get("range") || "60", 10);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  // Current snapshot
  const snapshot = metrics.snapshot();

  // Historical data
  let history;
  if (from && to) {
    history = metricsHistory.query(parseInt(from, 10), parseInt(to, 10));
  } else {
    history = metricsHistory.recent(rangeMinutes);
  }

  const anomalyStats = {
    requestRate: anomalyDetector.getStats(ANOMALY_METRIC.REQUEST_RATE),
    errorRate: anomalyDetector.getStats(ANOMALY_METRIC.ERROR_RATE),
    latencyP95: anomalyDetector.getStats(ANOMALY_METRIC.LATENCY_P95),
    loginFailures: anomalyDetector.getStats(ANOMALY_METRIC.LOGIN_FAILURES),
  };

  const alerts = alertManager.getHistory(50);
  const blockedIps = getBlockedIps();
  const budgetViolations = getBudgetViolations();

  return NextResponse.json({
    metrics: snapshot,
    history,
    anomaly: anomalyStats,
    alerts,
    blockedIps,
    budgetViolations,
  });
}

/**
 * POST /api/admin/metrics — Admin actions (unblock IP, etc.)
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "super_admin")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { action, ip } = body as { action: string; ip?: string };

  if (action === "unblock_ip" && ip) {
    unblockIp(ip);
    return NextResponse.json({ success: true, message: `Unblocked ${ip}` });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
