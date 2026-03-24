"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthGuard } from "@/lib/useAuthGuard";

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

interface Alert {
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
  alerts: Alert[];
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

function severityColor(severity: string): string {
  switch (severity) {
    case "critical": return "bg-red-100 text-red-800 border-red-300";
    case "warning": return "bg-yellow-100 text-yellow-800 border-yellow-300";
    default: return "bg-blue-100 text-blue-800 border-blue-300";
  }
}

function severityIcon(severity: string): string {
  switch (severity) {
    case "critical": return "🚨";
    case "warning": return "⚠️";
    default: return "ℹ️";
  }
}

/* ================================================================== */
/*  Mini Sparkline (pure CSS bars)                                     */
/* ================================================================== */

function Sparkline({ data, color = "#3b82f6" }: { data: number[]; color?: string }) {
  if (data.length === 0) return <span className="text-gray-400 text-xs">No data</span>;
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-px h-8">
      {data.slice(-30).map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-sm min-w-0.5"
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

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color || "text-gray-900"}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
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
  const router = useRouter();
  const { loading: authLoading, authenticated } = useAuthGuard();

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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unblock_ip", ip }),
    });
    fetchData();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse text-gray-400 text-lg">Loading observability data…</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-red-500">Error: {error || "No data"}</div>
      </div>
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
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">🔭 Observability Dashboard</h1>
          <p className="text-xs text-gray-500 mt-0.5">Uptime: {formatUptime(m.uptime)} · Last refresh: {new Date(m.timestamp).toLocaleTimeString()}</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} className="rounded" />
            Auto-refresh
          </label>
          <button onClick={fetchData} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Refresh
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* ── Key Metrics ──────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <StatCard label="Total Requests" value={totalRequests.toLocaleString()} sub={`${totalErrors} errors`} />
          <StatCard label="Error Rate" value={`${errorRate}%`} color={parseFloat(errorRate) > 5 ? "text-red-600" : "text-green-600"} />
          <StatCard label="Avg Latency" value={`${avgLatency}ms`} sub={`p95: ${p95Latency}ms`} />
          <StatCard label="Logins" value={logins} sub={`${loginFails} failed`} />
          <StatCard label="Bots Blocked" value={botDetections} color={botDetections > 0 ? "text-orange-600" : "text-gray-900"} />
          <StatCard label="Rate Limited" value={rateLimitHits} color={rateLimitHits > 0 ? "text-yellow-600" : "text-gray-900"} />
        </div>

        {/* ── Charts (Sparklines from history) ─────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 mb-2">Requests / min</p>
            <Sparkline data={history.map((h) => h.counters["http_requests_total"] || 0)} color="#3b82f6" />
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 mb-2">Error Rate %</p>
            <Sparkline
              data={history.map((h) => {
                const total = h.counters["http_requests_total"] || 0;
                const errors = h.counters["http_errors_total"] || 0;
                return total > 0 ? (errors / total) * 100 : 0;
              })}
              color="#ef4444"
            />
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 mb-2">Avg Latency (ms)</p>
            <Sparkline data={history.map((h) => h.histogramAvgs["http_request_duration_ms"] || 0)} color="#f59e0b" />
          </div>
        </div>

        {/* ── Anomaly Detection ────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">📊 Anomaly Detection</h2>
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
                  <p className="text-xs text-gray-500">{labels[key]}</p>
                  {stat ? (
                    <>
                      <p className="text-lg font-bold">{stat.latest}</p>
                      <p className="text-xs text-gray-400">μ={stat.mean} σ={stat.stdDev}</p>
                    </>
                  ) : (
                    <p className="text-gray-300">—</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Performance Budget Violations ─────────────────────── */}
        {Object.keys(budgetViolations).length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">⏱️ Performance Budget Violations</h2>
            <div className="space-y-2">
              {Object.entries(budgetViolations).map(([category, v]) => (
                <div key={category} className="flex items-center justify-between text-sm">
                  <span className="font-mono text-gray-600">{category}</span>
                  <div className="flex gap-4">
                    <span className="text-yellow-600">⚠ {v.warn} warn</span>
                    <span className="text-red-600">🚨 {v.critical} critical</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ── Alert Feed ──────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">🔔 Recent Alerts ({alerts.length})</h2>
            {alerts.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">No alerts — system healthy ✓</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {[...alerts].reverse().map((alert) => (
                  <div key={alert.id} className={`rounded-lg border p-3 ${severityColor(alert.severity)}`}>
                    <div className="flex items-start justify-between">
                      <p className="text-sm font-medium">
                        {severityIcon(alert.severity)} {alert.title}
                      </p>
                      <span className="text-xs opacity-60">
                        {new Date(alert.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-xs mt-1 opacity-80">{alert.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Blocked IPs ─────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">🛡️ Blocked IPs ({blockedIps.length})</h2>
            {blockedIps.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">No blocked IPs</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {blockedIps.map((entry) => (
                  <div key={entry.ip} className="flex items-center justify-between rounded-lg border border-gray-200 p-3 text-sm">
                    <div>
                      <p className="font-mono font-medium">{entry.ip}</p>
                      <p className="text-xs text-gray-500">{entry.reason}</p>
                      <p className="text-xs text-gray-400">
                        Expires: {new Date(entry.expiresAt).toLocaleTimeString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleUnblock(entry.ip)}
                      className="px-2 py-1 text-xs bg-green-50 text-green-700 rounded border border-green-200 hover:bg-green-100"
                    >
                      Unblock
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── All Counters ─────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">📋 All Counters</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 text-sm">
            {Object.entries(m.counters).map(([name, entries]) => (
              <div key={name} className="flex justify-between bg-gray-50 rounded-lg px-3 py-2">
                <span className="font-mono text-gray-600 truncate mr-2">{name}</span>
                <span className="font-bold">{counterTotal(entries)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
