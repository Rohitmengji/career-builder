/*
 * Analytics Dashboard — /analytics
 *
 * Hiring funnel analytics:
 *   - Funnel visualisation: page views → job views → apply starts → completions
 *   - Conversion rates at each funnel step
 *   - Daily trend chart (job_view / apply_start / apply_complete)
 *   - Top jobs by applications + conversion rate
 *   - Traffic source breakdown
 *   - Search terms
 */

"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useAuthGuard } from "@/lib/useAuthGuard";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

interface FunnelStage {
  stage: string;
  count: number;
}

interface SourceRow {
  source: string;
  count: number;
}

interface TopJob {
  jobId: string;
  views: number;
  applications: number;
  conversionRate: number;
}

interface DailyPoint {
  date: string;
  job_view?: number;
  apply_start?: number;
  apply_complete?: number;
}

interface SearchTerm {
  term: string;
  count: number;
}

interface AnalyticsData {
  funnelData: FunnelStage[];
  sourceBreakdown: SourceRow[];
  topJobsByConversion: TopJob[];
  dailyTrend: DailyPoint[];
  searchTerms: SearchTerm[];
  eventCounts: { type: string; _count: { type: number } }[];
}

interface JobMeta {
  id: string;
  title: string;
  department: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

const STAGE_LABELS: Record<string, string> = {
  page_view: "Page Views",
  job_list_view: "Job List Views",
  job_view: "Job Detail Views",
  apply_start: "Apply Clicks",
  apply_complete: "Applications",
};

const STAGE_COLORS: Record<string, string> = {
  page_view: "bg-blue-500",
  job_list_view: "bg-indigo-500",
  job_view: "bg-violet-500",
  apply_start: "bg-amber-500",
  apply_complete: "bg-green-500",
};

function pct(num: number, den: number): string {
  if (!den) return "—";
  return `${((num / den) * 100).toFixed(1)}%`;
}

function fmt(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

/* ------------------------------------------------------------------ */
/*  Mini bar chart for daily trend                                      */
/* ------------------------------------------------------------------ */

function TrendChart({ data }: { data: DailyPoint[] }) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-gray-400">
        No data yet
      </div>
    );
  }

  const maxVal = Math.max(
    ...data.map((d) => Math.max(d.job_view ?? 0, d.apply_start ?? 0, d.apply_complete ?? 0)),
    1,
  );

  const series = [
    { key: "job_view" as const, label: "Job Views", color: "bg-violet-400" },
    { key: "apply_start" as const, label: "Apply Clicks", color: "bg-amber-400" },
    { key: "apply_complete" as const, label: "Applications", color: "bg-green-500" },
  ];

  return (
    <div>
      {/* Legend */}
      <div className="flex gap-4 mb-3 flex-wrap">
        {series.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className={`inline-block w-3 h-3 rounded-sm ${s.color}`} />
            {s.label}
          </div>
        ))}
      </div>
      {/* Chart */}
      <div className="flex items-end gap-0.5 h-32 overflow-x-auto">
        {data.map((d) => (
          <div key={d.date} className="flex-1 min-w-2 flex flex-col justify-end gap-0.5">
            {series.map((s) => {
              const val = d[s.key] ?? 0;
              const h = Math.round((val / maxVal) * 100);
              return (
                <div
                  key={s.key}
                  title={`${d.date} — ${s.label}: ${val}`}
                  className={`w-full rounded-t ${s.color} transition-all`}
                  style={{ height: `${h}%`, minHeight: val > 0 ? "2px" : "0" }}
                />
              );
            })}
          </div>
        ))}
      </div>
      {/* X-axis: first + last date */}
      {data.length > 1 && (
        <div className="flex justify-between mt-1 text-xs text-gray-400">
          <span>{data[0].date}</span>
          <span>{data[data.length - 1].date}</span>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                                */
/* ------------------------------------------------------------------ */

export default function AnalyticsDashboardPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [jobs, setJobs] = useState<JobMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { authenticated, loading: authLoading } = useAuthGuard();

  useEffect(() => {
    if (authLoading || !authenticated) return;

    Promise.all([
      fetch("/api/admin/analytics").then((r) => {
        if (!r.ok) throw new Error("Analytics fetch failed");
        return r.json();
      }),
      fetch("/api/admin/jobs").then((r) => r.json()).catch(() => ({ jobs: [] })),
    ])
      .then(([analytics, jobsResp]) => {
        setData(analytics as AnalyticsData);
        setJobs((jobsResp?.jobs ?? []) as JobMeta[]);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load analytics");
        setLoading(false);
      });
  }, [authenticated, authLoading]);

  const jobMap = useMemo(
    () => new Map(jobs.map((j) => [j.id, j])),
    [jobs],
  );

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 font-medium mb-2">Failed to load analytics</p>
          <p className="text-sm text-gray-500 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const funnel = data.funnelData ?? [];
  const funnelMax = funnel[0]?.count || 1;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="mb-8 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Link href="/dashboard" className="text-sm text-blue-600 hover:text-blue-800">
                ← Dashboard
              </Link>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Hiring Funnel Analytics</h1>
            <p className="text-gray-500 mt-1 text-sm">Last 30 days — visitor to applicant conversion</p>
          </div>
          <div className="text-xs text-gray-400 bg-white border border-gray-200 rounded-lg px-3 py-2">
            Tracked events: {data.eventCounts.reduce((s, c) => s + c._count.type, 0).toLocaleString()}
          </div>
        </div>

        {/* ── Funnel ── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-5">Conversion Funnel</h2>
          <div className="space-y-3">
            {funnel.map((stage, i) => {
              const prev = i > 0 ? funnel[i - 1] : null;
              const dropRate = prev && prev.count > 0 ? ((prev.count - stage.count) / prev.count) * 100 : null;
              const barWidth = funnelMax > 0 ? Math.max(2, Math.round((stage.count / funnelMax) * 100)) : 0;

              return (
                <div key={stage.stage}>
                  {/* Drop-off label between stages */}
                  {dropRate !== null && (
                    <div className="flex items-center gap-2 my-1 pl-2">
                      <div className="w-px h-4 bg-gray-200" />
                      <span className="text-xs text-red-500 font-medium">
                        ↓ {dropRate.toFixed(1)}% drop-off
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-4">
                    <div className="w-36 shrink-0 text-sm text-gray-600 font-medium">
                      {STAGE_LABELS[stage.stage] ?? stage.stage}
                    </div>
                    <div className="flex-1 bg-gray-100 rounded-full h-7 overflow-hidden">
                      <div
                        className={`h-full rounded-full flex items-center justify-end pr-3 transition-all ${STAGE_COLORS[stage.stage] ?? "bg-blue-500"}`}
                        style={{ width: `${barWidth}%` }}
                      >
                        {barWidth > 15 && (
                          <span className="text-white text-xs font-semibold">{fmt(stage.count)}</span>
                        )}
                      </div>
                    </div>
                    <div className="w-24 shrink-0 text-right">
                      <span className="text-sm font-bold text-gray-900">{stage.count.toLocaleString()}</span>
                      {i > 0 && (
                        <span className="ml-1 text-xs text-gray-400">
                          ({pct(stage.count, funnelMax)})
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary conversion */}
          {funnel.length >= 2 && (
            <div className="mt-6 pt-5 border-t border-gray-100 flex flex-wrap gap-6">
              {[
                { label: "Site → Job View", from: "page_view", to: "job_view" },
                { label: "Job View → Apply Click", from: "job_view", to: "apply_start" },
                { label: "Apply Click → Completion", from: "apply_start", to: "apply_complete" },
                { label: "Overall (Site → Application)", from: "page_view", to: "apply_complete" },
              ].map(({ label, from, to }) => {
                const fromCount = funnel.find((f) => f.stage === from)?.count ?? 0;
                const toCount = funnel.find((f) => f.stage === to)?.count ?? 0;
                return (
                  <div key={label} className="text-center">
                    <div className="text-2xl font-bold text-gray-900">{pct(toCount, fromCount)}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{label}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Daily Trend ── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Daily Trend (30 days)</h2>
          <TrendChart data={data.dailyTrend ?? []} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* ── Top Jobs ── */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Jobs by Applications</h2>
            {data.topJobsByConversion.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">
                Not enough data yet (min. 5 job views per role)
              </p>
            ) : (
              <div className="space-y-3">
                {data.topJobsByConversion.slice(0, 10).map((job) => {
                  const meta = jobMap.get(job.jobId);
                  return (
                    <div
                      key={job.jobId}
                      className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0 gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/jobs?highlight=${job.jobId}`}
                          className="text-sm font-medium text-gray-900 hover:text-blue-600 truncate block"
                        >
                          {meta?.title ?? `Job ${job.jobId.slice(-6)}`}
                        </Link>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {meta?.department ?? ""} · {job.views.toLocaleString()} views
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-sm font-bold text-gray-900">
                          {job.applications} apps
                        </div>
                        <div
                          className={`text-xs font-medium mt-0.5 ${
                            job.conversionRate >= 10
                              ? "text-green-600"
                              : job.conversionRate >= 5
                              ? "text-amber-600"
                              : "text-red-500"
                          }`}
                        >
                          {job.conversionRate}% conv.
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Traffic Sources ── */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Traffic Sources</h2>
            {data.sourceBreakdown.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">No source data yet</p>
            ) : (
              <div className="space-y-2">
                {(() => {
                  const total = data.sourceBreakdown.reduce((s, r) => s + r.count, 0) || 1;
                  return data.sourceBreakdown.slice(0, 10).map((row) => (
                    <div key={row.source} className="flex items-center gap-3">
                      <div className="w-32 text-sm text-gray-600 truncate" title={row.source}>
                        {row.source}
                      </div>
                      <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                        <div
                          className="bg-blue-500 h-full rounded-full"
                          style={{ width: `${Math.round((row.count / total) * 100)}%` }}
                        />
                      </div>
                      <div className="w-12 text-xs text-gray-500 text-right">
                        {((row.count / total) * 100).toFixed(1)}%
                      </div>
                      <div className="w-10 text-xs text-gray-400 text-right">
                        {row.count.toLocaleString()}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>
        </div>

        {/* ── Search Terms ── */}
        {data.searchTerms.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Search Terms</h2>
            <div className="flex flex-wrap gap-2">
              {data.searchTerms.slice(0, 30).map((t) => (
                <div
                  key={t.term}
                  className="flex items-center gap-1.5 bg-gray-100 text-gray-700 rounded-full px-3 py-1 text-sm"
                >
                  <span>{t.term}</span>
                  <span className="text-xs text-gray-400 font-medium">{t.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── AI Insight Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {(() => {
            const insights: { icon: string; title: string; body: string; color: string }[] = [];

            const applyStart = funnel.find((f) => f.stage === "apply_start")?.count ?? 0;
            const applyComplete = funnel.find((f) => f.stage === "apply_complete")?.count ?? 0;
            const jobView = funnel.find((f) => f.stage === "job_view")?.count ?? 0;

            // Insight 1: Apply completion rate
            if (applyStart > 0) {
              const completionPct = ((applyComplete / applyStart) * 100).toFixed(1);
              const isGood = applyComplete / applyStart >= 0.5;
              insights.push({
                icon: isGood ? "✅" : "⚠️",
                title: "Form Completion Rate",
                body: isGood
                  ? `${completionPct}% of candidates who click Apply complete the form. Strong drop-off protection.`
                  : `Only ${completionPct}% of apply clicks result in a submission. Consider simplifying the form.`,
                color: isGood ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50",
              });
            }

            // Insight 2: Job view → apply conversion
            if (jobView > 0) {
              const cvr = ((applyStart / jobView) * 100).toFixed(1);
              insights.push({
                icon: parseFloat(cvr) >= 5 ? "🚀" : "💡",
                title: "Apply Click Rate",
                body: `${cvr}% of job detail viewers click Apply. ${
                  parseFloat(cvr) >= 5
                    ? "Above industry average (3–5%)."
                    : "Below industry average. Try improving job descriptions or salary visibility."
                }`,
                color:
                  parseFloat(cvr) >= 5
                    ? "border-green-200 bg-green-50"
                    : "border-blue-200 bg-blue-50",
              });
            }

            // Insight 3: top source
            if (data.sourceBreakdown.length > 0 && data.sourceBreakdown[0].source !== "direct") {
              insights.push({
                icon: "📈",
                title: "Top Traffic Source",
                body: `"${data.sourceBreakdown[0].source}" is your #1 referrer with ${data.sourceBreakdown[0].count.toLocaleString()} visits. Consider investing more in this channel.`,
                color: "border-purple-200 bg-purple-50",
              });
            }

            if (!insights.length) return null;

            return insights.map((ins) => (
              <div key={ins.title} className={`rounded-xl border p-4 ${ins.color}`}>
                <div className="text-xl mb-1">{ins.icon}</div>
                <div className="font-semibold text-gray-900 text-sm mb-1">{ins.title}</div>
                <div className="text-xs text-gray-600 leading-relaxed">{ins.body}</div>
              </div>
            ));
          })()}
        </div>
      </div>
    </div>
  );
}
