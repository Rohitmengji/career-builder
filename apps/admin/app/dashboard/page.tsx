/*
 * Admin Dashboard — /admin/dashboard
 *
 * Overview of the hiring platform:
 *   - KPI cards (jobs, applications, users)
 *   - Subscription & AI credits
 *   - Pipeline status breakdown
 *   - Recent applications
 *   - Quick actions
 */
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuthGuard } from "@/lib/useAuthGuard";
import {
  Card,
  Badge,
  ButtonLink,
  Skeleton,
  ArrowRightIcon,
} from "@/components/ui";

interface DashboardData {
  overview: { jobs: number; applications: number; users: number };
  pipeline: Record<string, number>;
  recentApplications: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    status: string;
    submittedAt: string;
    job: { id: string; title: string; department: string };
  }[];
}

interface SubStatus {
  plan: string;
  aiEnabled: boolean;
  aiCreditsRemaining: number;
  aiCreditsTotal: number;
  subscriptionStatus: string;
  hasStripeCustomer: boolean;
  aiCreditsResetAt: string | null;
  jobAiCreditsRemaining: number;
  jobAiCreditsTotal: number;
}

type BadgeTone = "neutral" | "brand" | "success" | "warning" | "danger" | "info";

const STATUS_TONE: Record<string, BadgeTone> = {
  applied: "neutral",
  screening: "info",
  interview: "brand",
  offer: "warning",
  hired: "success",
  rejected: "danger",
};

/* Pipeline bar fill colors — paired with a text label so color is not the only signal. */
const PIPELINE_FILL: Record<string, string> = {
  hired: "bg-emerald-500",
  rejected: "bg-red-500",
};

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [sub, setSub] = useState<SubStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const { authenticated, loading: authLoading } = useAuthGuard();

  useEffect(() => {
    if (authLoading || !authenticated) return;

    Promise.all([
      fetch("/api/admin/analytics")
        .then((r) => {
          if (!r.ok) throw new Error("Analytics fetch failed");
          return r.json();
        })
        .then((d) => {
          if (d && d.overview) return d as DashboardData;
          return null;
        })
        .catch(() => null),
      fetch("/api/subscription").then((r) => r.json()).catch(() => null),
    ]).then(([analytics, subscription]) => {
      setData(analytics);
      setSub(subscription);
      setLoading(false);
    });
  }, [authenticated, authLoading]);

  if (authLoading || loading || !data) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8" role="status" aria-live="polite">
            <span className="sr-only">Loading dashboard…</span>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="mt-3 h-4 w-64" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8" aria-hidden="true">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <Skeleton className="h-4 w-24" />
                <Skeleton className="mt-3 h-9 w-20" />
                <Skeleton className="mt-3 h-4 w-28" />
              </Card>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8" aria-hidden="true">
            {Array.from({ length: 2 }).map((_, i) => (
              <Card key={i}>
                <Skeleton className="h-5 w-40" />
                <div className="mt-5 space-y-3">
                  {Array.from({ length: 5 }).map((__, j) => (
                    <Skeleton key={j} className="h-6 w-full" />
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </div>
      </main>
    );
  }

  const totalApplications = data.overview.applications || 1;

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900">Dashboard</h1>
          <p className="mt-1 text-gray-600">Hiring platform overview</p>
        </header>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Link
            href="/jobs"
            className="group block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            <Card className="h-full transition-shadow group-hover:shadow-md">
              <div className="text-sm font-medium text-gray-600">Active Jobs</div>
              <div className="mt-2 text-3xl font-semibold text-gray-900">{data.overview.jobs}</div>
              <div className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-blue-600">
                Manage jobs <ArrowRightIcon className="h-4 w-4" />
              </div>
            </Card>
          </Link>

          <Link
            href="/applications"
            className="group block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            <Card className="h-full transition-shadow group-hover:shadow-md">
              <div className="text-sm font-medium text-gray-600">Total Applications</div>
              <div className="mt-2 text-3xl font-semibold text-gray-900">{data.overview.applications}</div>
              <div className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-blue-600">
                View pipeline <ArrowRightIcon className="h-4 w-4" />
              </div>
            </Card>
          </Link>

          <Card>
            <div className="text-sm font-medium text-gray-600">Team Members</div>
            <div className="mt-2 text-3xl font-semibold text-gray-900">{data.overview.users}</div>
            <div className="mt-3 text-sm text-gray-500">Across all roles</div>
          </Card>

          {/* Subscription card */}
          <Card>
            <div className="text-sm font-medium text-gray-600">Current Plan</div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-2xl font-semibold capitalize text-gray-900">{sub?.plan || "Free"}</span>
              {sub?.subscriptionStatus === "active" && <Badge tone="success">Active</Badge>}
            </div>
            {sub?.aiEnabled ? (
              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between text-xs text-gray-600">
                  <span>AI Credits</span>
                  <span className="font-medium text-gray-900">
                    {sub.aiCreditsRemaining}/{sub.aiCreditsTotal}
                  </span>
                </div>
                <div
                  className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100"
                  role="progressbar"
                  aria-valuenow={sub.aiCreditsRemaining}
                  aria-valuemin={0}
                  aria-valuemax={sub.aiCreditsTotal}
                  aria-label="AI credits remaining"
                >
                  <div
                    className="h-1.5 rounded-full bg-blue-600 transition-all"
                    style={{
                      width: `${Math.min(100, (sub.aiCreditsRemaining / Math.max(1, sub.aiCreditsTotal)) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="mt-3 text-sm text-gray-500">Upgrade for AI features</div>
            )}
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Pipeline Breakdown */}
          <Card>
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Application Pipeline</h2>
            <div className="space-y-3">
              {["applied", "screening", "interview", "offer", "hired", "rejected"].map((status) => {
                const count = data.pipeline[status] || 0;
                const pct = Math.round((count / totalApplications) * 100);
                return (
                  <div key={status} className="flex items-center gap-3">
                    <div className="w-24 text-sm capitalize text-gray-700">{status}</div>
                    <div className="h-3 flex-1 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className={`h-full rounded-full ${PIPELINE_FILL[status] ?? "bg-blue-500"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="w-10 text-right text-sm font-medium text-gray-700">{count}</div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Recent Applications */}
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Recent Applications</h2>
              <Link
                href="/applications"
                className="inline-flex items-center gap-1 rounded-md text-sm font-medium text-blue-600 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                View all <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>
            {data.recentApplications.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-600">No applications yet</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {data.recentApplications.slice(0, 5).map((app) => (
                  <li key={app.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-gray-900">
                        {app.firstName} {app.lastName}
                      </div>
                      <div className="truncate text-xs text-gray-600">{app.job.title}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge tone={STATUS_TONE[app.status] ?? "neutral"}>{app.status}</Badge>
                      <span className="text-xs text-gray-500">
                        {new Date(app.submittedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="mt-8">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Quick Actions</h2>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/analytics" variant="primary">View Analytics</ButtonLink>
            <ButtonLink href="/jobs" variant="primary">Create Job</ButtonLink>
            <ButtonLink href="/editor?openSiteGen=true" variant="primary">Generate Full Site</ButtonLink>
            <ButtonLink href="/editor" variant="secondary">Edit Pages</ButtonLink>
            <ButtonLink href="/applications" variant="secondary">Review Applications</ButtonLink>
            <ButtonLink href="/settings" variant="secondary">Settings</ButtonLink>
            <ButtonLink href="/theme" variant="secondary">Brand &amp; Theme</ButtonLink>
          </div>
        </Card>
      </div>
    </main>
  );
}
