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
import { useRouter } from "next/navigation";
import { useAuthGuard } from "@/lib/useAuthGuard";

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

const STATUS_OPTIONS = [
  { value: "applied", label: "Applied", color: "bg-gray-100 text-gray-700" },
  { value: "screening", label: "Screening", color: "bg-blue-100 text-blue-700" },
  { value: "interview", label: "Interview", color: "bg-purple-100 text-purple-700" },
  { value: "offer", label: "Offer", color: "bg-amber-100 text-amber-700" },
  { value: "hired", label: "Hired", color: "bg-green-100 text-green-700" },
  { value: "rejected", label: "Rejected", color: "bg-red-100 text-red-700" },
];

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
  const router = useRouter();
  const { loading: authLoading, authenticated } = useAuthGuard();

  /* ─── Data loading ─────────────────────────────────────────── */

  const loadApplications = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), perPage: "20" });
      if (filterStatus) params.set("status", filterStatus);

      const res = await fetch(`/api/admin/applications?${params}`);
      if (!res.ok) throw new Error("Failed to load applications");
      const data = await res.json();
      setApplications(data.applications || []);
      setStats(data.stats || {});
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus]);

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

  /* ─── Render ───────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const totalApplications = Object.values(stats).reduce((sum, n) => sum + (n || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Application Pipeline</h1>
          <p className="text-gray-500 mt-1">{totalApplications} total applications</p>
        </div>

        {/* Pipeline Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s.value}
              onClick={() => {
                setFilterStatus(filterStatus === s.value ? "" : s.value);
                setPage(1);
              }}
              className={`p-4 rounded-xl border text-left transition-all ${
                filterStatus === s.value
                  ? "border-blue-500 ring-2 ring-blue-200 bg-white"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <div className="text-2xl font-bold text-gray-900">
                {stats[s.value as keyof PipelineStats] ?? 0}
              </div>
              <div className="text-sm text-gray-500 mt-1">{s.label}</div>
            </button>
          ))}
        </div>

        {/* Application List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Candidate</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Job</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Rating</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Links</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {applications.map((app) => (
                <tr key={app.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">
                      {app.firstName} {app.lastName}
                    </div>
                    <div className="text-sm text-gray-500">{app.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">{app.job.title}</div>
                    <div className="text-xs text-gray-500">{app.job.department}</div>
                  </td>
                  <td className="px-6 py-4">
                    <select
                      value={app.status}
                      onChange={(e) => handleStatusChange(app.id, e.target.value)}
                      className={`text-xs px-2 py-1 rounded-full font-medium border-0 cursor-pointer ${
                        STATUS_OPTIONS.find((s) => s.value === app.status)?.color || "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => handleRating(app.id, star)}
                          className={`text-lg ${
                            (app.rating || 0) >= star ? "text-yellow-400" : "text-gray-300"
                          } hover:text-yellow-400`}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(app.submittedAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      {app.resumeUrl && (
                        <a
                          href={app.resumeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          Resume
                        </a>
                      )}
                      {app.linkedinUrl && (
                        <a
                          href={app.linkedinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          LinkedIn
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {applications.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    {filterStatus
                      ? `No applications with status "${filterStatus}"`
                      : "No applications yet"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-3 border-t bg-gray-50">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="px-3 py-1 text-sm text-gray-700 bg-white border rounded hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-500">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1 text-sm text-gray-700 bg-white border rounded hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
