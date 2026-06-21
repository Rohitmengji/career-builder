/*
 * /applications — Candidate's application tracker.
 *
 * Shows all jobs they've applied to with real-time status updates.
 * Requires candidate authentication.
 */
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { Alert, EmptyState, ButtonLink, Button } from "@/components/ui";

interface TimelineEvent {
  type: string;
  status: string | null;
  at: string;
}

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
  timeline?: TimelineEvent[];
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

const EVENT_LABELS: Record<string, string> = {
  interview_scheduled: "Interview scheduled",
  interview_confirmed: "Interview confirmed",
  interview_rescheduled: "Interview rescheduled",
  interview_cancelled: "Interview cancelled",
  interview_completed: "Interview completed",
  offer_extended: "Offer extended",
  offer_accepted: "Offer accepted",
  offer_declined: "Offer declined",
};

function timelineLabel(ev: TimelineEvent): string {
  if (ev.type === "status_change" && ev.status) return getStatusConfig(ev.status).label;
  return EVENT_LABELS[ev.type] ?? ev.type.replace(/_/g, " ");
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(iso: string, tz: string) {
  const opts: Intl.DateTimeFormatOptions = {
    weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", timeZoneName: "short",
  };
  try {
    return new Intl.DateTimeFormat("en-US", { ...opts, timeZone: tz }).format(new Date(iso));
  } catch {
    return new Intl.DateTimeFormat("en-US", opts).format(new Date(iso));
  }
}

interface CandidateInterview {
  id: string;
  status: string;
  type: string;
  scheduledAt: string;
  durationMins: number;
  timezone: string;
  location: string | null;
  meetingUrl: string | null;
  jobTitle: string | null;
}

const INTERVIEW_TYPE_LABEL: Record<string, string> = { phone: "Phone", video: "Video", onsite: "On-site" };

export default function MyApplicationsPage() {
  const router = useRouter();
  const [applications, setApplications] = useState<ApplicationEntry[]>([]);
  const [interviews, setInterviews] = useState<CandidateInterview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/applications");
      if (res.status === 401) {
        router.push("/login?redirect=/applications");
        return;
      }
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setApplications(data.applications || []);
      // Interviews are flag-gated server-side; a 404/!ok just means "none to show".
      try {
        const ivRes = await fetch("/api/interviews");
        if (ivRes.ok) setInterviews((await ivRes.json()).interviews || []);
        else setInterviews([]);
      } catch {
        setInterviews([]);
      }
    } catch {
      setError("Unable to load your applications. Please try again in a moment.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  const confirmInterview = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/interviews/${encodeURIComponent(id)}`, { method: "POST" });
      if (res.ok) setInterviews((prev) => prev.map((i) => (i.id === id ? { ...i, status: "confirmed" } : i)));
    } catch {
      /* keep as-is */
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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

        {!loading && interviews.filter((iv) => iv.status !== "cancelled").length > 0 && (
          <section className="mb-8" aria-label="Your interviews">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Interviews</h2>
            <div className="space-y-3">
              {interviews
                .filter((iv) => iv.status !== "cancelled")
                .map((iv) => (
                  <div key={iv.id} className="rounded-xl border border-blue-100 bg-blue-50/40 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{iv.jobTitle || "Interview"}</p>
                        <p className="mt-0.5 text-sm text-gray-700">{formatDateTime(iv.scheduledAt, iv.timezone)}</p>
                        <p className="mt-0.5 text-xs text-gray-500">
                          {INTERVIEW_TYPE_LABEL[iv.type] || iv.type} · {iv.durationMins} min
                          {iv.location ? ` · ${iv.location}` : ""}
                        </p>
                        {iv.meetingUrl && (
                          <a href={iv.meetingUrl} target="_blank" rel="noopener noreferrer"
                            className="mt-1 inline-block text-xs font-medium text-blue-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded">
                            Join link
                          </a>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        {iv.status === "confirmed" ? (
                          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">Confirmed</span>
                        ) : iv.status === "scheduled" ? (
                          <button type="button" onClick={() => confirmInterview(iv.id)}
                            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-600">
                            Confirm
                          </button>
                        ) : (
                          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium capitalize text-gray-600">{iv.status.replace("_", " ")}</span>
                        )}
                        <a href={`/api/interviews/${encodeURIComponent(iv.id)}`}
                          className="text-xs font-medium text-gray-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded">
                          Add to calendar
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </section>
        )}

        {loading && (
          <div className="space-y-4" role="status" aria-live="polite" aria-label="Loading your applications">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
                <div className="h-5 bg-gray-200 rounded w-2/3 mb-3" />
                <div className="h-4 bg-gray-100 rounded w-1/3" />
              </div>
            ))}
          </div>
        )}

        {error && (
          <Alert tone="error">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>{error}</span>
              <Button size="sm" variant="secondary" onClick={() => void load()}>
                Try again
              </Button>
            </div>
          </Alert>
        )}

        {!loading && !error && applications.length === 0 && (
          <EmptyState
            icon={<span className="text-2xl">📋</span>}
            title="No applications yet"
            body="Browse open positions and apply to get started — you'll track every application's status right here."
            action={<ButtonLink href="/jobs">Browse jobs</ButtonLink>}
          />
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
                  {app.timeline && app.timeline.length > 0 && (
                    <ol className="mt-3 space-y-2 border-t border-gray-100 pt-3" aria-label="Status history">
                      {app.timeline.map((ev, i) => (
                        <li key={i} className="flex items-center gap-2 text-xs text-gray-500">
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" aria-hidden="true" />
                          <span className="font-medium text-gray-700">{timelineLabel(ev)}</span>
                          <span className="text-gray-300">·</span>
                          <span>{formatDate(ev.at)}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
