"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { getCsrfToken } from "@/lib/csrf";
import {
  Card,
  Badge,
  Button,
  Alert,
  EmptyState,
  Skeleton,
  CheckIcon,
} from "@/components/ui";

/* ================================================================== */
/*  Types (match API response)                                         */
/* ================================================================== */

interface MetricsSnapshot {
  timestamp: string;
  uptime: number;
  counters: Record<string, { value: number; labels: Record<string, string> }[]>;
  histograms: Record<string, { count: number; avg: number; p95: number; p99: number; min: number; max: number; labels: Record<string, string> }[]>;
  gauges: Record<string, { value: number; labels: Record<string, string> }[]>;
}

interface HistoryPoint {
  timestamp: string;
  epoch: number;
  counters: Record<string, number>;
  histogramAvgs: Record<string, number>;
  histogramP95s: Record<string, number>;
  gauges: Record<string, number>;
}

interface AnomalyStats {
  requestRate: { mean: number; stdDev: number; count: number; latest: number } | null;
  errorRate: { mean: number; stdDev: number; count: number; latest: number } | null;
  latencyP95: { mean: number; stdDev: number; count: number; latest: number } | null;
  loginFailures: { mean: number; stdDev: number; count: number; latest: number } | null;
}

interface AlertItem {
  id: string;
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  timestamp: string;
  source: string;
}

interface BlockedIp {
  ip: string;
  reason: string;
  expiresAt: number;
}

interface DashboardData {
  metrics: MetricsSnapshot;
  history: HistoryPoint[];
  anomaly: AnomalyStats;
  alerts: AlertItem[];
  blockedIps: BlockedIp[];
  budgetViolations: Record<string, { warn: number; critical: number }>;
}

/* ================================================================== */
/*  Helpers                                                            */
/* ================================================================== */

function counterTotal(entries: { value: number }[] | undefined): number {
  if (!entries) return 0;
  return entries.reduce((sum, e) => sum + e.value, 0);
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

type SeverityTone = "danger" | "warning" | "info";

function severityTone(severity: string): SeverityTone {
  switch (severity) {
    case "critical": return "danger";
    case "warning": return "warning";
    default: return "info";
  }
}

const SEVERITY_CARD: Record<SeverityTone, string> = {
  danger: "border-red-200 bg-red-50",
  warning: "border-amber-200 bg-amber-50",
  info: "border-blue-200 bg-blue-50",
};

/* ================================================================== */
/*  Mini Sparkline (pure CSS bars)                                     */
/* ================================================================== */

function Sparkline({ data, color = "#2563eb", label }: { data: number[]; color?: string; label: string }) {
  if (data.length === 0) return <span className="text-xs text-gray-500">No data</span>;
  const max = Math.max(...data, 1);
  return (
    <div className="flex h-8 items-end gap-px" role="img" aria-label={`${label} sparkline over time`}>
      {data.slice(-30).map((v, i) => (
        <div
          key={i}
          className="min-w-0.5 flex-1 rounded-t-sm"
          style={{ height: `${Math.max((v / max) * 100, 2)}%`, backgroundColor: color }}
          title={String(v)}
        />
      ))}
    </div>
  );
}

/* ================================================================== */
/*  Stat Card                                                          */
/* ================================================================== */

function StatCard({ label, value, sub, valueClass }: { label: string; value: string | number; sub?: string; valueClass?: string }) {
  return (
    <Card className="p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-600">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${valueClass || "text-gray-900"}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-500">{sub}</p>}
    </Card>
  );
}

/* ================================================================== */
/*  Page Component                                                     */
/* ================================================================== */

export default function ObservabilityPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  useAuthGuard();

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/metrics?range=60");
      if (!res.ok) throw new Error("Unauthorized");
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    if (!autoRefresh) return;
    const interval = setInterval(fetchData, 10_000); // refresh every 10s
    return () => clearInterval(interval);
  }, [fetchData, autoRefresh]);

  const handleUnblock = async (ip: string) => {
    await fetch("/api/admin/metrics", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": getCsrfToken() },
      body: JSON.stringify({ action: "unblock_ip", ip }),
    });
    fetchData();
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <div role="status" aria-live="polite">
            <span className="sr-only">Loading observability data…</span>
            <Skeleton className="h-7 w-72" />
            <Skeleton className="mt-2 h-4 w-96" />
          </div>
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4" aria-hidden="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="p-5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="mt-2 h-7 w-16" />
              </Card>
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto flex min-h-screen max-w-md items-center justify-center px-4">
          <div className="w-full text-center">
            <h1 className="mb-3 text-xl font-semibold text-gray-900">Observability unavailable</h1>
            <Alert tone="error" className="mb-4 text-left">{error || "No data"}</Alert>
            <Button variant="primary" onClick={() => fetchData()}>Retry</Button>
          </div>
        </div>
      </main>
    );
  }

  const { metrics: m, history, anomaly, alerts, blockedIps, budgetViolations } = data;

  const totalRequests = counterTotal(m.counters["http_requests_total"]);
  const totalErrors = counterTotal(m.counters["http_errors_total"]);
  const errorRate = totalRequests > 0 ? ((totalErrors / totalRequests) * 100).toFixed(1) : "0.0";
  const latencyEntries = m.histograms["http_request_duration_ms"];
  const avgLatency = latencyEntries?.[0]?.avg ?? 0;
  const p95Latency = latencyEntries?.[0]?.p95 ?? 0;
  const logins = counterTotal(m.counters["logins_total"]);
  const loginFails = counterTotal(m.counters["login_failures_total"]);
  const botDetections = counterTotal(m.counters["bot_detections_total"]);
  const rateLimitHits = counterTotal(m.counters["rate_limit_hits_total"]);

  return (
    <main className="min-h-screen bg-gray-50">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-gray-900">Observability Dashboard</h1>
            <p className="mt-0.5 text-xs text-gray-600">
              Uptime: {formatUptime(m.uptime)} · Last refresh: {new Date(m.timestamp).toLocaleTimeString()}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex min-h-11 items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-600"
              />
              Auto-refresh
            </label>
            <Button variant="primary" size="sm" onClick={() => fetchData()}>Refresh</Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {/* ── Key Metrics ──────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <StatCard label="Total Requests" value={totalRequests.toLocaleString()} sub={`${totalErrors} errors`} />
          <StatCard label="Error Rate" value={`${errorRate}%`} valueClass={parseFloat(errorRate) > 5 ? "text-red-700" : "text-emerald-700"} sub={parseFloat(errorRate) > 5 ? "above threshold" : "healthy"} />
          <StatCard label="Avg Latency" value={`${avgLatency}ms`} sub={`p95: ${p95Latency}ms`} />
          <StatCard label="Logins" value={logins} sub={`${loginFails} failed`} />
          <StatCard label="Bots Blocked" value={botDetections} valueClass={botDetections > 0 ? "text-amber-700" : "text-gray-900"} />
          <StatCard label="Rate Limited" value={rateLimitHits} valueClass={rateLimitHits > 0 ? "text-amber-700" : "text-gray-900"} />
        </div>

        {/* ── Charts (Sparklines from history) ─────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-5">
            <p className="mb-2 text-xs font-medium text-gray-600">Requests / min</p>
            <Sparkline label="Requests per minute" data={history.map((h) => h.counters["http_requests_total"] || 0)} color="#2563eb" />
          </Card>
          <Card className="p-5">
            <p className="mb-2 text-xs font-medium text-gray-600">Error Rate %</p>
            <Sparkline
              label="Error rate percentage"
              data={history.map((h) => {
                const total = h.counters["http_requests_total"] || 0;
                const errors = h.counters["http_errors_total"] || 0;
                return total > 0 ? (errors / total) * 100 : 0;
              })}
              color="#dc2626"
            />
          </Card>
          <Card className="p-5">
            <p className="mb-2 text-xs font-medium text-gray-600">Avg Latency (ms)</p>
            <Sparkline label="Average latency in milliseconds" data={history.map((h) => h.histogramAvgs["http_request_duration_ms"] || 0)} color="#d97706" />
          </Card>
        </div>

        {/* ── Anomaly Detection ────────────────────────────────── */}
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Anomaly Detection</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {(["requestRate", "errorRate", "latencyP95", "loginFailures"] as const).map((key) => {
              const stat = anomaly[key];
              const labels: Record<string, string> = {
                requestRate: "Request Rate",
                errorRate: "Error Rate",
                latencyP95: "P95 Latency",
                loginFailures: "Login Failures",
              };
              return (
                <div key={key} className="text-center">
                  <p className="text-xs text-gray-600">{labels[key]}</p>
                  {stat ? (
                    <>
                      <p className="text-lg font-bold text-gray-900">{stat.latest}</p>
                      <p className="text-xs text-gray-500">μ={stat.mean} σ={stat.stdDev}</p>
                    </>
                  ) : (
                    <p className="text-gray-500">—</p>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {/* ── Performance Budget Violations ─────────────────────── */}
        {Object.keys(budgetViolations).length > 0 && (
          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">Performance Budget Violations</h2>
            <div className="space-y-2">
              {Object.entries(budgetViolations).map(([category, v]) => (
                <div key={category} className="flex items-center justify-between text-sm">
                  <span className="font-mono text-gray-700">{category}</span>
                  <div className="flex gap-3">
                    <Badge tone="warning">{v.warn} warn</Badge>
                    <Badge tone="danger">{v.critical} critical</Badge>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ── Alert Feed ──────────────────────────────────────── */}
          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">Recent Alerts ({alerts.length})</h2>
            {alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <span className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-700" aria-hidden="true">
                  <CheckIcon className="h-5 w-5" />
                </span>
                <p className="text-sm text-gray-600">No alerts — system healthy</p>
              </div>
            ) : (
              <div className="max-h-80 space-y-2 overflow-y-auto">
                {[...alerts].reverse().map((alert) => {
                  const tone = severityTone(alert.severity);
                  return (
                    <div key={alert.id} className={`rounded-lg border p-3 ${SEVERITY_CARD[tone]}`}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="flex items-center gap-2 text-sm font-medium text-gray-900">
                          <Badge tone={tone}>{alert.severity}</Badge>
                          {alert.title}
                        </p>
                        <span className="shrink-0 text-xs text-gray-600">
                          {new Date(alert.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-gray-700">{alert.description}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* ── Blocked IPs ─────────────────────────────────────── */}
          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">Blocked IPs ({blockedIps.length})</h2>
            {blockedIps.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-600">No blocked IPs</p>
            ) : (
              <div className="max-h-80 space-y-2 overflow-y-auto">
                {blockedIps.map((entry) => (
                  <div key={entry.ip} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 p-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-mono font-medium text-gray-900">{entry.ip}</p>
                      <p className="text-xs text-gray-600">{entry.reason}</p>
                      <p className="text-xs text-gray-500">
                        Expires: {new Date(entry.expiresAt).toLocaleTimeString()}
                      </p>
                    </div>
                    <Button variant="secondary" size="sm" onClick={() => handleUnblock(entry.ip)}>
                      Unblock
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* ── All Counters ─────────────────────────────────────── */}
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">All Counters</h2>
          {Object.keys(m.counters).length === 0 ? (
            <EmptyState title="No counters recorded yet" body="Counters will appear here once traffic is observed." />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 text-sm">
              {Object.entries(m.counters).map(([name, entries]) => (
                <div key={name} className="flex justify-between rounded-lg bg-gray-50 px-3 py-2">
                  <span className="mr-2 truncate font-mono text-gray-600">{name}</span>
                  <span className="font-bold text-gray-900">{counterTotal(entries)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
