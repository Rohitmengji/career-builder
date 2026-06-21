/*
 * Admin Applications Page — /admin/applications
 *
 * Application tracking dashboard:
 *   - Pipeline stats (applied, screening, interview, offer, hired, rejected)
 *   - Filterable, paginated application list
 *   - Status changes via kanban-style dropdown
 *   - Star ratings
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuthGuard } from "@/lib/useAuthGuard";
import {
  Card,
  Badge,
  Button,
  ButtonLink,
  EmptyState,
  Skeleton,
  Alert,
  ArrowLeftIcon,
  ArrowRightIcon,
} from "@/components/ui";
import {
  UsersIcon,
  DocumentIcon,
  LinkedInIcon,
  StarIcon,
} from "@/components/jobs/icons";
import CommentsDialog from "./CommentsDialog";
import ResumeDialog from "./ResumeDialog";
import InterviewsDialog from "./InterviewsDialog";

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

interface Application {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  resumeUrl: string | null;
  linkedinUrl: string | null;
  status: string;
  rating: number | null;
  notes: string | null;
  submittedAt: string;
  screeningAnswers: string | null;
  job: {
    id: string;
    title: string;
    department: string;
    location?: string;
  };
}

interface PipelineStats {
  applied?: number;
  screening?: number;
  interview?: number;
  offer?: number;
  hired?: number;
  rejected?: number;
}

type BadgeTone = "neutral" | "brand" | "success" | "warning" | "danger" | "info";

const STATUS_OPTIONS: { value: string; label: string; tone: BadgeTone }[] = [
  { value: "applied", label: "Applied", tone: "neutral" },
  { value: "screening", label: "Screening", tone: "info" },
  { value: "interview", label: "Interview", tone: "brand" },
  { value: "offer", label: "Offer", tone: "warning" },
  { value: "hired", label: "Hired", tone: "success" },
  { value: "rejected", label: "Rejected", tone: "danger" },
];

/* dot color per status — paired with a label so state is never color-only */
const STATUS_DOT: Record<string, string> = {
  applied: "bg-gray-400",
  screening: "bg-blue-500",
  interview: "bg-blue-600",
  offer: "bg-amber-500",
  hired: "bg-emerald-500",
  rejected: "bg-red-500",
};

function statusMeta(value: string) {
  return STATUS_OPTIONS.find((s) => s.value === value) ?? STATUS_OPTIONS[0];
}

/** True when the applicant failed one or more knockout screening questions. */
function screeningFailed(app: Application): boolean {
  if (!app.screeningAnswers) return false;
  try {
    const parsed = JSON.parse(app.screeningAnswers) as { passed?: boolean };
    return parsed?.passed === false;
  } catch {
    return false;
  }
}

function ScreeningBadge() {
  return (
    <span className="mt-0.5 w-fit">
      <Badge tone="danger">Failed screening</Badge>
    </span>
  );
}

/* ================================================================== */
/*  Component                                                          */
/* ================================================================== */

export default function AdminApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [stats, setStats] = useState<PipelineStats>({});
  const [loading, setLoading] = useState(true);
  const [csrf, setCsrf] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkNotice, setBulkNotice] = useState("");
  const [commentsFor, setCommentsFor] = useState<Application | null>(null);
  const [resumeFor, setResumeFor] = useState<Application | null>(null);
  const [interviewsFor, setInterviewsFor] = useState<Application | null>(null);
  const [search, setSearch] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [blindHiring, setBlindHiring] = useState(false);
  const { user: authUser } = useAuthGuard();
  const currentUserId = authUser?.id ?? "";

  /* ─── Data loading ─────────────────────────────────────────── */

  const loadApplications = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), perPage: "20" });
      if (filterStatus) params.set("status", filterStatus);
      if (appliedQuery) params.set("q", appliedQuery);

      const res = await fetch(`/api/admin/applications?${params}`);
      if (!res.ok) throw new Error("Failed to load applications");
      const data = await res.json();
      setApplications(data.applications || []);
      setStats(data.stats || {});
      setTotalPages(data.pagination?.totalPages || 1);
      setBlindHiring(Boolean(data.blindHiring));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus, appliedQuery]);

  useEffect(() => {
    const csrfCookie = document.cookie
      .split(";")
      .find((c) => c.trim().startsWith("cb_csrf="));
    if (csrfCookie) setCsrf(csrfCookie.split("=")[1]);

    loadApplications();
  }, [loadApplications]);

  /* ─── Actions ──────────────────────────────────────────────── */

  async function handleStatusChange(appId: string, newStatus: string) {
    try {
      await fetch("/api/admin/applications", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrf,
        },
        body: JSON.stringify({ id: appId, status: newStatus }),
      });
      loadApplications();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleRating(appId: string, rating: number) {
    try {
      await fetch("/api/admin/applications", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrf,
        },
        body: JSON.stringify({ id: appId, rating }),
      });
      loadApplications();
    } catch (err) {
      console.error(err);
    }
  }

  const totalApplications = Object.values(stats).reduce((sum, n) => sum + (n || 0), 0);

  /* ─── Bulk selection + actions ─────────────────────────────── */

  // Clear selection whenever the visible set changes (avoid acting on stale ids).
  useEffect(() => {
    setSelected(new Set());
    setBulkNotice("");
  }, [page, filterStatus]);

  const allOnPageSelected = applications.length > 0 && applications.every((a) => selected.has(a.id));

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllOnPage() {
    setSelected((prev) => {
      if (applications.every((a) => prev.has(a.id))) return new Set();
      return new Set(applications.map((a) => a.id));
    });
  }

  async function bulkAct(action: "status" | "reject", status?: string) {
    if (selected.size === 0 || bulkBusy) return;
    if (action === "reject" && !window.confirm(`Reject ${selected.size} application(s) and email each candidate?`)) return;
    setBulkBusy(true);
    setBulkNotice("");
    try {
      const res = await fetch("/api/admin/applications/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify({ ids: Array.from(selected), action, status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBulkNotice(data.error || "Bulk action failed. Please try again.");
        return;
      }
      setBulkNotice(`Updated ${data.updated ?? selected.size} application(s).`);
      setSelected(new Set());
      await loadApplications();
    } catch {
      setBulkNotice("Network error. Please try again.");
    } finally {
      setBulkBusy(false);
    }
  }

  async function bulkExport() {
    if (selected.size === 0 || bulkBusy) return;
    setBulkBusy(true);
    setBulkNotice("");
    try {
      const res = await fetch("/api/admin/applications/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify({ ids: Array.from(selected), action: "export" }),
      });
      if (!res.ok) {
        setBulkNotice("Export failed. Please try again.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `applications-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setBulkNotice(`Exported ${selected.size} application(s).`);
    } catch {
      setBulkNotice("Export failed. Please try again.");
    } finally {
      setBulkBusy(false);
    }
  }

  /* ─── Sub-components ────────────────────────────────────────── */

  function StatusSelect({ app }: { app: Application }) {
    const meta = statusMeta(app.status);
    return (
      <span className="relative inline-flex items-center">
        <span className="pointer-events-none absolute left-2.5 flex items-center" aria-hidden="true">
          <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[app.status] ?? "bg-gray-400"}`} />
        </span>
        <select
          value={app.status}
          onChange={(e) => handleStatusChange(app.id, e.target.value)}
          aria-label={`Change status for ${app.firstName} ${app.lastName} (currently ${meta.label})`}
          className="cursor-pointer appearance-none rounded-full border border-gray-300 bg-white py-1.5 pl-6 pr-7 text-xs font-medium text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-2 flex items-center text-gray-500" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
        </span>
      </span>
    );
  }

  function StarRating({ app }: { app: Application }) {
    const current = app.rating || 0;
    return (
      <div className="flex items-center gap-0.5" role="group" aria-label={`Rating for ${app.firstName} ${app.lastName}: ${current} of 5 stars`}>
        {[1, 2, 3, 4, 5].map((star) => {
          const active = current >= star;
          return (
            <button
              key={star}
              type="button"
              onClick={() => handleRating(app.id, star)}
              aria-label={`Rate ${star} star${star !== 1 ? "s" : ""}`}
              aria-pressed={active}
              className={`flex h-9 w-9 items-center justify-center rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${active ? "text-amber-500" : "text-gray-500 hover:text-amber-500"}`}
            >
              <StarIcon className="h-4 w-4" filled={active} />
            </button>
          );
        })}
      </div>
    );
  }

  /* ─── Render ───────────────────────────────────────────────── */

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 md:py-10">
        {/* Header */}
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">
              Application Pipeline
            </h1>
            <p className="mt-1 text-sm text-gray-600" role="status">
              {loading ? "Loading applications…" : `${totalApplications} total application${totalApplications !== 1 ? "s" : ""}`}
            </p>
          </div>
          {(authUser?.role === "admin" || authUser?.role === "super_admin") && (
            <BlindHiringToggle csrf={csrf} onChange={loadApplications} />
          )}
        </div>

        {/* Pipeline Stats */}
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {STATUS_OPTIONS.map((s) => {
            const selected = filterStatus === s.value;
            return (
              <button
                key={s.value}
                onClick={() => {
                  setFilterStatus(selected ? "" : s.value);
                  setPage(1);
                }}
                aria-pressed={selected}
                className={`rounded-2xl border bg-white p-4 text-left shadow-xs transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                  selected
                    ? "border-blue-600 ring-1 ring-blue-600"
                    : "border-gray-200 hover:border-gray-300 hover:shadow-sm"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${STATUS_DOT[s.value]}`} aria-hidden="true" />
                  <span className="text-2xl font-semibold tabular-nums text-gray-900">
                    {stats[s.value as keyof PipelineStats] ?? 0}
                  </span>
                </div>
                <div className="mt-1 text-sm text-gray-600">{s.label}</div>
              </button>
            );
          })}
        </div>

        {/* Candidate search (name / email / résumé text) — disabled under blind hiring */}
        <form
          onSubmit={(e) => { e.preventDefault(); setPage(1); setAppliedQuery(search.trim()); }}
          className="mb-6 flex flex-wrap items-center gap-2"
        >
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            disabled={blindHiring}
            placeholder={blindHiring ? "Search is off while blind hiring is on" : "Search name, email, or résumé text…"}
            aria-label="Search candidates"
            className="h-10 w-full max-w-md rounded-lg border border-gray-300 px-3.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600 disabled:bg-gray-50 disabled:text-gray-400"
          />
          <Button type="submit" size="sm" variant="secondary" disabled={blindHiring}>Search</Button>
          {appliedQuery && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => { setSearch(""); setAppliedQuery(""); setPage(1); }}
            >
              Clear
            </Button>
          )}
        </form>

        {/* Loading skeleton */}
        {loading && (
          <Card className="overflow-hidden p-0" aria-busy="true">
            <div className="space-y-3 p-6" role="status" aria-label="Loading applications">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 flex-1 rounded-lg" />
                  <Skeleton className="h-10 w-28 rounded-lg" />
                  <Skeleton className="h-10 w-24 rounded-lg" />
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Application List */}
        {!loading && applications.length === 0 && (
          <Card>
            <EmptyState
              icon={<UsersIcon className="h-7 w-7" />}
              title={filterStatus ? `No ${statusMeta(filterStatus).label.toLowerCase()} applications` : "No applications yet"}
              body={
                filterStatus
                  ? "Try clearing the filter to see all candidates."
                  : "Applications will appear here as candidates apply to your open roles."
              }
              action={
                filterStatus ? (
                  <Button variant="secondary" onClick={() => { setFilterStatus(""); setPage(1); }}>
                    Clear filter
                  </Button>
                ) : undefined
              }
            />
          </Card>
        )}

        {/* Bulk action bar */}
        {!loading && applications.length > 0 && selected.size > 0 && (
          <div
            className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3"
            role="region"
            aria-label="Bulk actions"
          >
            <span className="text-sm font-medium text-blue-900" aria-live="polite">
              {selected.size} selected
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="bulk-move" className="sr-only">Move selected to stage</label>
              <select
                id="bulk-move"
                disabled={bulkBusy}
                defaultValue=""
                onChange={(e) => {
                  const v = e.target.value;
                  e.target.value = "";
                  if (v) void bulkAct("status", v);
                }}
                className="h-9 cursor-pointer rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-60"
              >
                <option value="" disabled>Move to…</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <Button size="sm" variant="danger" onClick={() => void bulkAct("reject")} disabled={bulkBusy}>
                Reject
              </Button>
              <Button size="sm" variant="secondary" onClick={() => void bulkExport()} disabled={bulkBusy}>
                Export CSV
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} disabled={bulkBusy}>
                Clear
              </Button>
            </div>
          </div>
        )}
        {bulkNotice && (
          <div className="mb-4">
            <Alert tone={/fail|error|could/i.test(bulkNotice) ? "error" : "success"}>{bulkNotice}</Alert>
          </div>
        )}

        {!loading && applications.length > 0 && (
          <Card className="overflow-hidden p-0">
            {/* Desktop / tablet table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left">
                <caption className="sr-only">List of candidate applications</caption>
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th scope="col" className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={allOnPageSelected}
                        onChange={toggleAllOnPage}
                        aria-label="Select all applications on this page"
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600"
                      />
                    </th>
                    <th scope="col" className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">Candidate</th>
                    <th scope="col" className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">Job</th>
                    <th scope="col" className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">Status</th>
                    <th scope="col" className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">Rating</th>
                    <th scope="col" className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">Date</th>
                    <th scope="col" className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">Links</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {applications.map((app) => (
                    <tr key={app.id} className={selected.has(app.id) ? "bg-blue-50/40" : "hover:bg-gray-50"}>
                      <td className="px-4 py-4 align-middle">
                        <input
                          type="checkbox"
                          checked={selected.has(app.id)}
                          onChange={() => toggleOne(app.id)}
                          aria-label={`Select ${app.firstName} ${app.lastName}`}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600"
                        />
                      </td>
                      <td className="px-6 py-4 align-middle">
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-900">{app.firstName} {app.lastName}</span>
                          <span className="mt-0.5 text-sm text-gray-600">{app.email}</span>
                          {screeningFailed(app) && <ScreeningBadge />}
                        </div>
                      </td>
                      <td className="px-6 py-4 align-middle">
                        <div className="text-sm text-gray-900">{app.job.title}</div>
                        <div className="mt-0.5 text-sm text-gray-600">{app.job.department}</div>
                      </td>
                      <td className="px-6 py-4 align-middle"><StatusSelect app={app} /></td>
                      <td className="px-6 py-4 align-middle"><StarRating app={app} /></td>
                      <td className="px-6 py-4 align-middle text-sm text-gray-600">
                        <time dateTime={app.submittedAt}>{new Date(app.submittedAt).toLocaleDateString()}</time>
                      </td>
                      <td className="px-6 py-4 align-middle">
                        <div className="flex items-center gap-1">
                          {app.resumeUrl && (
                            <a
                              href={app.resumeUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`View résumé for ${app.firstName} ${app.lastName} (opens in new tab)`}
                              className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-blue-700 hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                            >
                              <DocumentIcon className="h-4 w-4" />
                              Resume
                            </a>
                          )}
                          {app.linkedinUrl && (
                            <a
                              href={app.linkedinUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`View LinkedIn for ${app.firstName} ${app.lastName} (opens in new tab)`}
                              className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-blue-700 hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                            >
                              <LinkedInIcon className="h-4 w-4" />
                              LinkedIn
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => setResumeFor(app)}
                            aria-label={`View résumé for ${app.firstName} ${app.lastName}`}
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                          >
                            <DocumentIcon className="h-4 w-4" />
                            Résumé
                          </button>
                          <button
                            type="button"
                            onClick={() => setInterviewsFor(app)}
                            aria-label={`Interviews for ${app.firstName} ${app.lastName}`}
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                          >
                            <CalendarIcon className="h-4 w-4" />
                            Interviews
                          </button>
                          <button
                            type="button"
                            onClick={() => setCommentsFor(app)}
                            aria-label={`Open comments for ${app.firstName} ${app.lastName}`}
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                          >
                            <ChatIcon className="h-4 w-4" />
                            Comments
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <ul className="divide-y divide-gray-100 md:hidden">
              {applications.map((app) => (
                <li key={app.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selected.has(app.id)}
                        onChange={() => toggleOne(app.id)}
                        aria-label={`Select ${app.firstName} ${app.lastName}`}
                        className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600"
                      />
                      <div className="flex min-w-0 flex-col">
                        <p className="font-medium text-gray-900">{app.firstName} {app.lastName}</p>
                        <p className="mt-0.5 truncate text-sm text-gray-600">{app.email}</p>
                        {screeningFailed(app) && <ScreeningBadge />}
                      </div>
                    </div>
                    <Badge tone={statusMeta(app.status).tone}>
                      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[app.status]}`} aria-hidden="true" />
                      {statusMeta(app.status).label}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-gray-700">
                    {app.job.title} <span className="text-gray-500">· {app.job.department}</span>
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    Applied <time dateTime={app.submittedAt}>{new Date(app.submittedAt).toLocaleDateString()}</time>
                  </p>
                  <div className="mt-3 space-y-3">
                    <StatusSelect app={app} />
                    <StarRating app={app} />
                    <div className="flex flex-wrap items-center gap-2">
                      {app.resumeUrl && (
                        <ButtonLink href={app.resumeUrl} target="_blank" rel="noopener noreferrer" variant="secondary" size="sm" aria-label={`View résumé for ${app.firstName} ${app.lastName} (opens in new tab)`}>
                          <DocumentIcon className="h-4 w-4" />
                          Resume
                        </ButtonLink>
                      )}
                      {app.linkedinUrl && (
                        <ButtonLink href={app.linkedinUrl} target="_blank" rel="noopener noreferrer" variant="secondary" size="sm" aria-label={`View LinkedIn for ${app.firstName} ${app.lastName} (opens in new tab)`}>
                          <LinkedInIcon className="h-4 w-4" />
                          LinkedIn
                        </ButtonLink>
                      )}
                      <Button variant="secondary" size="sm" onClick={() => setInterviewsFor(app)} aria-label={`Interviews for ${app.firstName} ${app.lastName}`}>
                        <CalendarIcon className="h-4 w-4" />
                        Interviews
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => setCommentsFor(app)} aria-label={`Open comments for ${app.firstName} ${app.lastName}`}>
                        <ChatIcon className="h-4 w-4" />
                        Comments
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {/* Pagination */}
            {totalPages > 1 && (
              <nav
                aria-label="Applications pagination"
                className="flex items-center justify-between gap-3 border-t border-gray-200 bg-gray-50 px-4 py-3 sm:px-6"
              >
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page <= 1}
                >
                  <ArrowLeftIcon className="h-4 w-4" />
                  Previous
                </Button>
                <span className="text-sm text-gray-600" role="status">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page >= totalPages}
                >
                  Next
                  <ArrowRightIcon className="h-4 w-4" />
                </Button>
              </nav>
            )}
          </Card>
        )}
      </div>

      {commentsFor && currentUserId && (
        <CommentsDialog
          applicationId={commentsFor.id}
          candidateName={`${commentsFor.firstName} ${commentsFor.lastName}`}
          currentUserId={currentUserId}
          csrf={csrf}
          onClose={() => setCommentsFor(null)}
        />
      )}

      {resumeFor && (
        <ResumeDialog
          applicationId={resumeFor.id}
          candidateName={`${resumeFor.firstName} ${resumeFor.lastName}`}
          onClose={() => setResumeFor(null)}
        />
      )}

      {interviewsFor && (
        <InterviewsDialog
          applicationId={interviewsFor.id}
          candidateName={`${interviewsFor.firstName} ${interviewsFor.lastName}`}
          csrf={csrf}
          onClose={() => setInterviewsFor(null)}
        />
      )}
    </main>
  );
}

function BlindHiringToggle({ csrf, onChange }: { csrf: string; onChange: () => void }) {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fetch("/api/admin/blind-hiring", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.config) setEnabled(!!d.config.enabled); })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  async function toggle() {
    if (busy) return;
    const next = !enabled;
    setBusy(true);
    setEnabled(next); // optimistic
    try {
      const res = await fetch("/api/admin/blind-hiring", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify({ enabled: next }),
      });
      if (!res.ok) setEnabled(!next); // revert on failure
      else onChange();
    } catch {
      setEnabled(!next);
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return null;
  return (
    <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-xs">
      <span className="text-sm font-medium text-gray-700">Blind hiring</span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label="Toggle blind hiring (redact candidate identity)"
        onClick={toggle}
        disabled={busy}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${enabled ? "bg-blue-600" : "bg-gray-300"} ${busy ? "opacity-60" : ""}`}
      >
        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-5" : "translate-x-0.5"}`} />
      </button>
      <span className="text-xs text-gray-500">{enabled ? "on — identities hidden" : "off"}</span>
    </div>
  );
}

function ChatIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3.75h6m-7.06 5.06L4.5 19.5V6.75A2.25 2.25 0 016.75 4.5h10.5a2.25 2.25 0 012.25 2.25v6a2.25 2.25 0 01-2.25 2.25H8.56a2.25 2.25 0 00-1.59.66z" />
    </svg>
  );
}

function CalendarIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0V11.25A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  );
}
