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
import {
  Card,
  Badge,
  Button,
  Alert,
  Skeleton,
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
} from "@/components/ui";

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
  apply_complete: "bg-emerald-500",
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
      <div className="flex h-32 items-center justify-center text-sm text-gray-600">
        No data yet
      </div>
    );
  }

  const maxVal = Math.max(
    ...data.map((d) => Math.max(d.job_view ?? 0, d.apply_start ?? 0, d.apply_complete ?? 0)),
    1,
  );

  const series = [
    { key: "job_view" as const, label: "Job Views", color: "bg-violet-500" },
    { key: "apply_start" as const, label: "Apply Clicks", color: "bg-amber-500" },
    { key: "apply_complete" as const, label: "Applications", color: "bg-emerald-500" },
  ];

  return (
    <div>
      {/* Legend */}
      <div className="mb-3 flex flex-wrap gap-4">
        {series.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className={`inline-block h-3 w-3 rounded-sm ${s.color}`} aria-hidden="true" />
            {s.label}
          </div>
        ))}
      </div>
      {/* Chart */}
      <div className="flex h-32 items-end gap-0.5 overflow-x-auto" role="img" aria-label="Daily trend of job views, apply clicks and applications over the last 30 days">
        {data.map((d) => (
          <div key={d.date} className="flex min-w-2 flex-1 flex-col justify-end gap-0.5">
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
        <div className="mt-1 flex justify-between text-xs text-gray-500">
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
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <div role="status" aria-live="polite">
            <span className="sr-only">Loading analytics…</span>
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-3 h-8 w-72" />
            <Skeleton className="mt-2 h-4 w-64" />
          </div>
          <div className="mt-8 space-y-6" aria-hidden="true">
            <Card><Skeleton className="h-5 w-48" /><div className="mt-5 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-7 w-full" />)}</div></Card>
            <Card><Skeleton className="h-5 w-40" /><Skeleton className="mt-4 h-32 w-full" /></Card>
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
            <h1 className="mb-3 text-xl font-semibold text-gray-900">Failed to load analytics</h1>
            <Alert tone="error" className="mb-4 text-left">{error || "No analytics data available."}</Alert>
            <Button variant="primary" onClick={() => window.location.reload()}>Retry</Button>
          </div>
        </div>
      </main>
    );
  }

  const funnel = data.funnelData ?? [];
  const funnelMax = funnel[0]?.count || 1;

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              href="/dashboard"
              className="mb-2 inline-flex items-center gap-1 rounded-md text-sm font-medium text-blue-600 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              <ArrowLeftIcon className="h-4 w-4" /> Dashboard
            </Link>
            <h1 className="text-3xl font-semibold tracking-tight text-gray-900">Hiring Funnel Analytics</h1>
            <p className="mt-1 text-sm text-gray-600">Last 30 days — visitor to applicant conversion</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600">
            Tracked events:{" "}
            <span className="font-semibold text-gray-900">
              {data.eventCounts.reduce((s, c) => s + c._count.type, 0).toLocaleString()}
            </span>
          </div>
        </header>

        {/* ── Hiring velocity (ADR-0017, flag advanced_analytics) ── */}
        <HiringVelocity />

        {/* ── Interviewer calibration (ADR-0028, flag rater_calibration; manager+) ── */}
        <RaterCalibration />

        {/* ── Funnel ── */}
        <Card className="mb-6">
          <h2 className="mb-5 text-lg font-semibold text-gray-900">Conversion Funnel</h2>
          <div className="space-y-3">
            {funnel.map((stage, i) => {
              const prev = i > 0 ? funnel[i - 1] : null;
              const dropRate = prev && prev.count > 0 ? ((prev.count - stage.count) / prev.count) * 100 : null;
              const barWidth = funnelMax > 0 ? Math.max(2, Math.round((stage.count / funnelMax) * 100)) : 0;

              return (
                <div key={stage.stage}>
                  {/* Drop-off label between stages */}
                  {dropRate !== null && (
                    <div className="my-1 flex items-center gap-2 pl-2">
                      <div className="h-4 w-px bg-gray-200" aria-hidden="true" />
                      <span className="text-xs font-medium text-red-700">
                        {dropRate.toFixed(1)}% drop-off
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-4">
                    <div className="w-32 shrink-0 text-sm font-medium text-gray-700 sm:w-36">
                      {STAGE_LABELS[stage.stage] ?? stage.stage}
                    </div>
                    <div className="h-7 flex-1 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className={`flex h-full items-center justify-end rounded-full pr-3 transition-all ${STAGE_COLORS[stage.stage] ?? "bg-blue-500"}`}
                        style={{ width: `${barWidth}%` }}
                      >
                        {barWidth > 15 && (
                          <span className="text-xs font-semibold text-white">{fmt(stage.count)}</span>
                        )}
                      </div>
                    </div>
                    <div className="w-24 shrink-0 text-right">
                      <span className="text-sm font-bold text-gray-900">{stage.count.toLocaleString()}</span>
                      {i > 0 && (
                        <span className="ml-1 text-xs text-gray-500">
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
            <div className="mt-6 flex flex-wrap gap-6 border-t border-gray-100 pt-5">
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
                    <div className="mt-0.5 text-xs text-gray-600">{label}</div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* ── Daily Trend ── */}
        <Card className="mb-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Daily Trend (30 days)</h2>
          <TrendChart data={data.dailyTrend ?? []} />
        </Card>

        <div className="mb-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ── Top Jobs ── */}
          <Card>
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Top Jobs by Applications</h2>
            {data.topJobsByConversion.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-600">
                Not enough data yet (min. 5 job views per role)
              </p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {data.topJobsByConversion.slice(0, 10).map((job) => {
                  const meta = jobMap.get(job.jobId);
                  const convTone: "success" | "warning" | "danger" =
                    job.conversionRate >= 10 ? "success" : job.conversionRate >= 5 ? "warning" : "danger";
                  return (
                    <li key={job.jobId} className="flex items-center justify-between gap-2 py-3">
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/jobs?highlight=${job.jobId}`}
                          className="block truncate rounded text-sm font-medium text-gray-900 hover:text-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                        >
                          {meta?.title ?? `Job ${job.jobId.slice(-6)}`}
                        </Link>
                        <div className="mt-0.5 truncate text-xs text-gray-600">
                          {meta?.department ?? ""}{meta?.department ? " · " : ""}{job.views.toLocaleString()} views
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-sm font-bold text-gray-900">{job.applications} apps</span>
                        <Badge tone={convTone}>{job.conversionRate}% conv.</Badge>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {/* ── Traffic Sources ── */}
          <Card>
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Traffic Sources</h2>
            {data.sourceBreakdown.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-600">No source data yet</p>
            ) : (
              <div className="space-y-2">
                {(() => {
                  const total = data.sourceBreakdown.reduce((s, r) => s + r.count, 0) || 1;
                  return data.sourceBreakdown.slice(0, 10).map((row) => (
                    <div key={row.source} className="flex items-center gap-3">
                      <div className="w-28 truncate text-sm text-gray-700 sm:w-32" title={row.source}>
                        {row.source}
                      </div>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-full rounded-full bg-blue-600"
                          style={{ width: `${Math.round((row.count / total) * 100)}%` }}
                        />
                      </div>
                      <div className="w-12 text-right text-xs font-medium text-gray-700">
                        {((row.count / total) * 100).toFixed(1)}%
                      </div>
                      <div className="w-10 text-right text-xs text-gray-500">
                        {row.count.toLocaleString()}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            )}
          </Card>
        </div>

        {/* ── Search Terms ── */}
        {data.searchTerms.length > 0 && (
          <Card className="mb-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Top Search Terms</h2>
            <div className="flex flex-wrap gap-2">
              {data.searchTerms.slice(0, 30).map((t) => (
                <span
                  key={t.term}
                  className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700"
                >
                  <span>{t.term}</span>
                  <span className="text-xs font-semibold text-gray-600">{t.count}</span>
                </span>
              ))}
            </div>
          </Card>
        )}

        {/* ── AI Insight Cards ── */}
        {(() => {
          type Insight = {
            title: string;
            body: string;
            tone: "success" | "warning" | "info";
          };
          const insights: Insight[] = [];

          const applyStart = funnel.find((f) => f.stage === "apply_start")?.count ?? 0;
          const applyComplete = funnel.find((f) => f.stage === "apply_complete")?.count ?? 0;
          const jobView = funnel.find((f) => f.stage === "job_view")?.count ?? 0;

          // Insight 1: Apply completion rate
          if (applyStart > 0) {
            const completionPct = ((applyComplete / applyStart) * 100).toFixed(1);
            const isGood = applyComplete / applyStart >= 0.5;
            insights.push({
              title: "Form Completion Rate",
              body: isGood
                ? `${completionPct}% of candidates who click Apply complete the form. Strong drop-off protection.`
                : `Only ${completionPct}% of apply clicks result in a submission. Consider simplifying the form.`,
              tone: isGood ? "success" : "warning",
            });
          }

          // Insight 2: Job view → apply conversion
          if (jobView > 0) {
            const cvr = ((applyStart / jobView) * 100).toFixed(1);
            insights.push({
              title: "Apply Click Rate",
              body: `${cvr}% of job detail viewers click Apply. ${
                parseFloat(cvr) >= 5
                  ? "Above industry average (3–5%)."
                  : "Below industry average. Try improving job descriptions or salary visibility."
              }`,
              tone: parseFloat(cvr) >= 5 ? "success" : "info",
            });
          }

          // Insight 3: top source
          if (data.sourceBreakdown.length > 0 && data.sourceBreakdown[0].source !== "direct") {
            insights.push({
              title: "Top Traffic Source",
              body: `"${data.sourceBreakdown[0].source}" is your #1 referrer with ${data.sourceBreakdown[0].count.toLocaleString()} visits. Consider investing more in this channel.`,
              tone: "info",
            });
          }

          if (!insights.length) return null;

          const toneStyles: Record<Insight["tone"], { card: string; icon: string }> = {
            success: { card: "border-emerald-200 bg-emerald-50", icon: "text-emerald-700" },
            warning: { card: "border-amber-200 bg-amber-50", icon: "text-amber-700" },
            info: { card: "border-blue-200 bg-blue-50", icon: "text-blue-700" },
          };

          return (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {insights.map((ins) => {
                const s = toneStyles[ins.tone];
                return (
                  <div key={ins.title} className={`rounded-2xl border p-4 ${s.card}`}>
                    <div className={`mb-2 inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white/70 ${s.icon}`} aria-hidden="true">
                      {ins.tone === "success" ? <CheckIcon className="h-4 w-4" /> : <ArrowRightIcon className="h-4 w-4" />}
                    </div>
                    <div className="mb-1 text-sm font-semibold text-gray-900">{ins.title}</div>
                    <div className="text-xs leading-relaxed text-gray-700">{ins.body}</div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>
    </main>
  );
}

/* ================================================================== */
/*  Hiring velocity — medians from the ApplicationEvent spine (ADR-0017) */
/* ================================================================== */

interface VelocityMetrics {
  timeToFirstResponseDays: number | null;
  timeToHireDays: number | null;
  timeToDecisionDays: number | null;
  samples: { firstResponse: number; hire: number; decision: number };
  total: number;
}

function HiringVelocity() {
  const [metrics, setMetrics] = useState<VelocityMetrics | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        const res = await fetch("/api/admin/analytics/hiring", { cache: "no-store" });
        if (!res.ok) return; // 404 = flag off → render nothing
        const d = await res.json();
        if (active) { setMetrics(d.metrics); setShown(true); }
      } catch { /* ignore */ }
    };
    void run();
    return () => { active = false; };
  }, []);

  if (!shown || !metrics) return null;

  const cards: { label: string; value: number | null; sample: number }[] = [
    { label: "Median time to first response", value: metrics.timeToFirstResponseDays, sample: metrics.samples.firstResponse },
    { label: "Median time to hire", value: metrics.timeToHireDays, sample: metrics.samples.hire },
    { label: "Median time to decision", value: metrics.timeToDecisionDays, sample: metrics.samples.decision },
  ];

  return (
    <Card className="mb-6">
      <h2 className="mb-1 text-lg font-semibold text-gray-900">Hiring velocity</h2>
      <p className="mb-5 text-sm text-gray-600">Medians across {metrics.total} application{metrics.total === 1 ? "" : "s"}, from the application timeline.</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-medium text-gray-500">{c.label}</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900">
              {c.value === null ? "—" : `${c.value} ${c.value === 1 ? "day" : "days"}`}
            </p>
            <p className="mt-1 text-xs text-gray-400">{c.sample} sampled</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ================================================================== */
/*  Interviewer calibration — rater psychometrics (ADR-0028)           */
/* ================================================================== */

interface RaterRow {
  interviewerId: string;
  interviewerName: string;
  meanScore: number | null;
  scored: number;
  sampleSize: number;
  leniency: number | null;
  label: "lenient" | "harsh" | "balanced" | "insufficient_data";
  suppressed: boolean;
}
interface Calibration { raters: RaterRow[]; panelAgreement: number | null; comparableApplications: number }

const LABEL_META: Record<string, { text: string; cls: string }> = {
  lenient: { text: "Lenient", cls: "bg-amber-100 text-amber-800" },
  harsh: { text: "Harsh", cls: "bg-blue-100 text-blue-800" },
  balanced: { text: "Balanced", cls: "bg-emerald-100 text-emerald-700" },
  insufficient_data: { text: "Not enough data", cls: "bg-gray-100 text-gray-500" },
};

function RaterCalibration() {
  const [data, setData] = useState<Calibration | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        const res = await fetch("/api/admin/analytics/calibration", { cache: "no-store" });
        if (!res.ok) return; // 404 = flag off / not a manager → render nothing
        const d = await res.json();
        if (active) { setData(d.calibration); setShown(true); }
      } catch { /* ignore */ }
    };
    void run();
    return () => { active = false; };
  }, []);

  if (!shown || !data || data.raters.length === 0) return null;

  return (
    <Card className="mb-6">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-gray-900">Interviewer calibration</h2>
        {data.panelAgreement !== null && (
          <span className="text-xs text-gray-500">Avg panel spread: <span className="font-medium tabular-nums">{data.panelAgreement}</span> pts</span>
        )}
      </div>
      <p className="mb-5 text-sm text-gray-600">
        How each interviewer scores vs. the panel on the same candidates ({data.comparableApplications} multi-interviewer application{data.comparableApplications === 1 ? "" : "s"}). Positive = more lenient, negative = harsher. A fairness check, not a performance score.
      </p>
      <ul className="space-y-2.5">
        {data.raters.map((r) => {
          const meta = LABEL_META[r.label];
          const pct = r.leniency === null ? 0 : Math.min(100, (Math.abs(r.leniency) / 2) * 100); // 2pts = full bar
          const lenient = (r.leniency ?? 0) > 0;
          return (
            <li key={r.interviewerId} className="flex items-center gap-3">
              <span className="w-40 shrink-0 truncate text-sm text-gray-800">{r.interviewerName}</span>
              {/* Diverging bar around a centre line */}
              <div className="relative h-2 flex-1 rounded-full bg-gray-100" aria-hidden="true">
                <span className="absolute left-1/2 top-0 h-2 w-px bg-gray-300" />
                {!r.suppressed && (
                  <span
                    className={`absolute top-0 h-2 rounded-full ${lenient ? "bg-amber-400" : "bg-blue-400"}`}
                    style={{ width: `${pct / 2}%`, [lenient ? "left" : "right"]: "50%" } as React.CSSProperties}
                  />
                )}
              </div>
              <span className="w-14 shrink-0 text-right text-xs tabular-nums text-gray-600">
                {r.leniency === null ? "—" : `${r.leniency > 0 ? "+" : ""}${r.leniency}`}
              </span>
              <span className={`w-32 shrink-0 rounded-full px-2 py-0.5 text-center text-[11px] font-medium ${meta.cls}`}>{meta.text}</span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
