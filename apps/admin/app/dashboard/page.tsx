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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    applied: "bg-gray-100 text-gray-700",
    screening: "bg-blue-100 text-blue-700",
    interview: "bg-purple-100 text-purple-700",
    offer: "bg-amber-100 text-amber-700",
    hired: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Hiring platform overview</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Link href="/jobs" className="block">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:border-blue-300 transition-colors">
              <div className="text-sm font-medium text-gray-500">Active Jobs</div>
              <div className="text-3xl font-bold text-gray-900 mt-2">{data.overview.jobs}</div>
              <div className="text-sm text-blue-600 mt-2">Manage jobs →</div>
            </div>
          </Link>
          <Link href="/applications" className="block">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:border-blue-300 transition-colors">
              <div className="text-sm font-medium text-gray-500">Total Applications</div>
              <div className="text-3xl font-bold text-gray-900 mt-2">{data.overview.applications}</div>
              <div className="text-sm text-blue-600 mt-2">View pipeline →</div>
            </div>
          </Link>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="text-sm font-medium text-gray-500">Team Members</div>
            <div className="text-3xl font-bold text-gray-900 mt-2">{data.overview.users}</div>
            <div className="text-sm text-gray-400 mt-2">Across all roles</div>
          </div>

          {/* Subscription card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="text-sm font-medium text-gray-500">Current Plan</div>
            <div className="text-2xl font-bold text-gray-900 mt-2 capitalize">
              {sub?.plan || "Free"}
              {sub?.subscriptionStatus === "active" && (
                <span className="ml-2 text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full align-middle">Active</span>
              )}
            </div>
            {sub?.aiEnabled ? (
              <div className="mt-2">
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                  <span>AI Credits</span>
                  <span>{sub.aiCreditsRemaining}/{sub.aiCreditsTotal}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div
                    className="bg-purple-500 rounded-full h-1.5 transition-all"
                    style={{ width: `${Math.min(100, (sub.aiCreditsRemaining / Math.max(1, sub.aiCreditsTotal)) * 100)}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-400 mt-2">Upgrade for AI features</div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Pipeline Breakdown */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Application Pipeline</h2>
            <div className="space-y-3">
              {["applied", "screening", "interview", "offer", "hired", "rejected"].map((status) => {
                const count = data.pipeline[status] || 0;
                const total = data.overview.applications || 1;
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={status} className="flex items-center gap-3">
                    <div className="w-24 text-sm capitalize text-gray-600">{status}</div>
                    <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          status === "hired"
                            ? "bg-green-500"
                            : status === "rejected"
                            ? "bg-red-400"
                            : "bg-blue-500"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="w-10 text-sm text-gray-500 text-right">{count}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Applications */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Recent Applications</h2>
              <Link href="/applications" className="text-sm text-blue-600 hover:text-blue-800">
                View all →
              </Link>
            </div>
            <div className="space-y-3">
              {data.recentApplications.slice(0, 5).map((app) => (
                <div key={app.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <div className="font-medium text-sm text-gray-900">
                      {app.firstName} {app.lastName}
                    </div>
                    <div className="text-xs text-gray-500">{app.job.title}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[app.status] || "bg-gray-100"}`}>
                      {app.status}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(app.submittedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
              {data.recentApplications.length === 0 && (
                <p className="text-sm text-gray-500 py-4 text-center">No applications yet</p>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/jobs"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
            >
              + Create Job
            </Link>
            <Link
              href="/editor"
              className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
            >
              Edit Pages
            </Link>
            <Link
              href="/editor?openSiteGen=true"
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm"
            >
              🌐 Generate Full Site
            </Link>
            <Link
              href="/applications"
              className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
            >
              Review Applications
            </Link>
            <Link
              href="/settings"
              className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
            >
              Settings
            </Link>
            <Link
              href="/theme"
              className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
            >
              Brand & Theme
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
