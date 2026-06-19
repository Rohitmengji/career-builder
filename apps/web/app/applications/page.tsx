/*
 * /applications — Candidate's application tracker.
 *
 * Shows all jobs they've applied to with real-time status updates.
 * Requires candidate authentication.
 */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

interface ApplicationEntry {
  id: string;
  status: string;
  submittedAt: string;
  updatedAt: string;
  job: {
    id: string;
    title: string;
    department: string;
    location: string | null;
  };
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  applied: { label: "Applied", color: "text-gray-700", bg: "bg-gray-100", icon: "📨" },
  screening: { label: "Under Review", color: "text-blue-700", bg: "bg-blue-50", icon: "🔍" },
  interview: { label: "Interview", color: "text-indigo-700", bg: "bg-indigo-50", icon: "🎯" },
  offer: { label: "Offer", color: "text-amber-700", bg: "bg-amber-50", icon: "🎉" },
  hired: { label: "Hired", color: "text-emerald-700", bg: "bg-emerald-50", icon: "✅" },
  rejected: { label: "Not Selected", color: "text-red-700", bg: "bg-red-50", icon: "—" },
};

function getStatusConfig(status: string) {
  return STATUS_CONFIG[status] || STATUS_CONFIG.applied;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function MyApplicationsPage() {
  const router = useRouter();
  const [applications, setApplications] = useState<ApplicationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/applications");
        if (res.status === 401) {
          router.push("/login?redirect=/applications");
          return;
        }
        if (!res.ok) throw new Error("Failed to load");
        const data = await res.json();
        setApplications(data.applications || []);
      } catch {
        setError("Unable to load your applications. Please try again.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50">
      <SiteHeader />
      <main id="main-content" className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">
            My Applications
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Track the status of your job applications.
          </p>
        </div>

        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
                <div className="h-5 bg-gray-200 rounded w-2/3 mb-3" />
                <div className="h-4 bg-gray-100 rounded w-1/3" />
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && applications.length === 0 && (
          <div className="text-center py-16">
            <div className="text-4xl mb-4">📋</div>
            <h2 className="text-lg font-medium text-gray-900 mb-2">No applications yet</h2>
            <p className="text-sm text-gray-500 mb-6">
              Browse open positions and apply to get started.
            </p>
            <Link
              href="/jobs"
              className="inline-flex items-center gap-2 bg-blue-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Browse Jobs
            </Link>
          </div>
        )}

        {!loading && !error && applications.length > 0 && (
          <div className="space-y-4">
            {applications.map((app) => {
              const status = getStatusConfig(app.status);
              return (
                <article
                  key={app.id}
                  className="bg-white rounded-xl border border-gray-200 p-5 hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/jobs/${app.job.id}`}
                        className="text-base font-medium text-gray-900 hover:text-blue-600 transition-colors line-clamp-1"
                      >
                        {app.job.title}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
                        <span>{app.job.department}</span>
                        {app.job.location && (
                          <>
                            <span className="text-gray-300">·</span>
                            <span>{app.job.location}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${status.bg} ${status.color}`}
                    >
                      <span aria-hidden="true">{status.icon}</span>
                      {status.label}
                    </span>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-4 text-xs text-gray-400">
                    <span>Applied {formatDate(app.submittedAt)}</span>
                    {app.updatedAt !== app.submittedAt && (
                      <span>Updated {formatDate(app.updatedAt)}</span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
