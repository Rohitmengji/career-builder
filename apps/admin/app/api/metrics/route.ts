/*
 * GET /api/metrics — Prometheus scrape endpoint (ADR-0025).
 *
 * WHAT: serves the in-process MetricsCollector snapshot in Prometheus text-exposition
 *   format so any scraper (Prometheus, Grafana Agent, Datadog, OTel Collector) can pull
 *   counters/gauges/histograms. No vendor SDK, no external account.
 * WHY: completes C5 observability — metrics were collected but never exposed.
 * SECURITY: token-gated. Requires `Authorization: Bearer $METRICS_TOKEN` (constant-time
 *   compare). When METRICS_TOKEN is unset the endpoint is OFF (404 — don't reveal it);
 *   a configured-but-wrong token is 401. Never cached. Metrics are operational counts —
 *   they carry no candidate PII — but the token keeps internal traffic shape private.
 *
 * NOTE: metrics are per-process/per-instance (in-memory). On a multi-instance/serverless
 * deploy point the scraper at each instance or front this with a push-gateway/aggregator.
 */

import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { metrics } from "@career-builder/observability";
import { toPrometheus } from "@career-builder/observability/prometheus";

const NO_STORE = { "Cache-Control": "no-store" } as const;

type Auth = "ok" | "off" | "denied";

function checkAuth(req: Request): Auth {
  const token = process.env.METRICS_TOKEN;
  if (!token) return "off"; // not configured → endpoint disabled
  const provided = req.headers.get("authorization") || "";
  const expected = `Bearer ${token}`;
  if (provided.length !== expected.length) return "denied"; // length isn't secret
  try {
    return timingSafeEqual(Buffer.from(provided), Buffer.from(expected)) ? "ok" : "denied";
  } catch {
    return "denied";
  }
}

export async function GET(req: Request) {
  const auth = checkAuth(req);
  if (auth === "off") return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  if (auth === "denied") return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });

  const body = toPrometheus(metrics.snapshot());
  return new NextResponse(body, {
    status: 200,
    headers: { "Content-Type": "text/plain; version=0.0.4; charset=utf-8", "Cache-Control": "no-store" },
  });
}
