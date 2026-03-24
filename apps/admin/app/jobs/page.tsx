/*
 * Admin Job Management Page — /admin/jobs
 *
 * Full CRUD for job postings:
 *   - List all jobs (published + drafts)
 *   - Create new job with rich form
 *   - Edit existing jobs
 *   - Publish / unpublish toggle
 *   - Delete with confirmation
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import AiJobAssistant from "@/components/jobs/AiJobAssistant";
import type { AiJobFormData } from "@/lib/ai/types";
import { useAuthGuard } from "@/lib/useAuthGuard";

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

interface Job {
  id: string;
  title: string;
  slug: string;
  department: string;
  location: string;
  description: string;
  employmentType: string;
  experienceLevel: string;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
  salaryPeriod: string;
  requirements: string;
  niceToHave: string;
  benefits: string;
  tags: string;
  isRemote: boolean;
  isPublished: boolean;
  sortOrder: number;
  postedAt: string;
  closesAt: string | null;
  createdAt: string;
  updatedAt: string;
  tenantId: string;
  _count?: { applications: number };
}

interface JobFormData {
  title: string;
  department: string;
  location: string;
  description: string;
  employmentType: string;
  experienceLevel: string;
  salaryMin: string;
  salaryMax: string;
  isRemote: boolean;
  isPublished: boolean;
  requirements: string;
  benefits: string;
  tags: string;
}

const EMPTY_FORM: JobFormData = {
  title: "",
  department: "",
  location: "",
  description: "",
  employmentType: "full-time",
  experienceLevel: "mid",
  salaryMin: "",
  salaryMax: "",
  isRemote: false,
  isPublished: false,
  requirements: "",
  benefits: "",
  tags: "",
};

const DEPARTMENTS = ["Engineering", "Design", "Marketing", "Sales", "People", "Finance", "Operations"];
const EMPLOYMENT_TYPES = ["full-time", "part-time", "contract", "internship"];
const EXPERIENCE_LEVELS = ["entry", "mid", "senior", "lead", "executive"];

/* ================================================================== */
/*  Component                                                          */
/* ================================================================== */

export default function AdminJobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [csrf, setCsrf] = useState("");
  const [view, setView] = useState<"list" | "form">("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<JobFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const { loading: authLoading, authenticated } = useAuthGuard();

  /* ─── Data loading ─────────────────────────────────────────── */

  const loadJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/jobs");
      if (!res.ok) throw new Error("Failed to load jobs");
      const data = await res.json();
      setJobs(data.jobs || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Get CSRF token
    const csrfCookie = document.cookie
      .split(";")
      .find((c) => c.trim().startsWith("cb_csrf="));
    if (csrfCookie) setCsrf(csrfCookie.split("=")[1]);

    loadJobs();
  }, [loadJobs]);

  /* ─── Helpers ──────────────────────────────────────────────── */

  function parseJsonArray(str: string): string[] {
    try {
      const parsed = JSON.parse(str);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return str
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }

  function formatJsonArray(str: string): string {
    try {
      const arr = JSON.parse(str);
      return Array.isArray(arr) ? arr.join("\n") : str;
    } catch {
      return str;
    }
  }

  /* ─── Actions ──────────────────────────────────────────────── */

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError("");
    setView("form");
  }

  function openEdit(job: Job) {
    setEditingId(job.id);
    setForm({
      title: job.title,
      department: job.department,
      location: job.location,
      description: job.description,
      employmentType: job.employmentType,
      experienceLevel: job.experienceLevel,
      salaryMin: job.salaryMin?.toString() || "",
      salaryMax: job.salaryMax?.toString() || "",
      isRemote: job.isRemote,
      isPublished: job.isPublished,
      requirements: formatJsonArray(job.requirements),
      benefits: formatJsonArray(job.benefits),
      tags: formatJsonArray(job.tags),
    });
    setError("");
    setView("form");
  }

  async function handleSave() {
    setError("");
    setSaving(true);

    const payload: Record<string, unknown> = {
      title: form.title,
      department: form.department,
      location: form.location,
      description: form.description,
      employmentType: form.employmentType,
      experienceLevel: form.experienceLevel,
      salaryMin: form.salaryMin ? parseInt(form.salaryMin) : undefined,
      salaryMax: form.salaryMax ? parseInt(form.salaryMax) : undefined,
      isRemote: form.isRemote,
      isPublished: form.isPublished,
      requirements: parseJsonArray(form.requirements),
      benefits: parseJsonArray(form.benefits),
      tags: parseJsonArray(form.tags),
    };

    if (editingId) {
      payload.id = editingId;
    }

    try {
      const res = await fetch("/api/admin/jobs", {
        method: editingId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrf,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      setView("list");
      loadJobs();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save job");
    } finally {
      setSaving(false);
    }
  }

  async function handleTogglePublish(job: Job) {
    try {
      await fetch("/api/admin/jobs", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrf,
        },
        body: JSON.stringify({
          action: job.isPublished ? "unpublish" : "publish",
          id: job.id,
        }),
      });
      loadJobs();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDelete(job: Job) {
    if (!confirm(`Delete "${job.title}"? This cannot be undone.`)) return;

    try {
      await fetch(`/api/admin/jobs?id=${job.id}`, {
        method: "DELETE",
        headers: { "x-csrf-token": csrf },
      });
      loadJobs();
    } catch (err) {
      console.error(err);
    }
  }

  function handleAiApply(aiJob: AiJobFormData) {
    setForm({
      title: aiJob.title || form.title,
      department: aiJob.department || form.department,
      location: aiJob.location || form.location,
      description: aiJob.description || form.description,
      employmentType: aiJob.employmentType || form.employmentType,
      experienceLevel: aiJob.experienceLevel || form.experienceLevel,
      salaryMin: aiJob.salaryMin || form.salaryMin,
      salaryMax: aiJob.salaryMax || form.salaryMax,
      isRemote: aiJob.isRemote ?? form.isRemote,
      isPublished: aiJob.isPublished ?? form.isPublished,
      requirements: aiJob.requirements || form.requirements,
      benefits: aiJob.benefits || form.benefits,
      tags: aiJob.tags || form.tags,
    });
  }

  /* ─── Render ───────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Job Management</h1>
            <p className="text-gray-500 mt-1">
              {jobs.length} job{jobs.length !== 1 ? "s" : ""} ·{" "}
              {jobs.filter((j) => j.isPublished).length} published
            </p>
          </div>
          <div className="flex gap-3">
            {view === "form" && (
              <button
                onClick={() => setView("list")}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                ← Back to List
              </button>
            )}
            {view === "list" && (
              <button
                onClick={openCreate}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <span>+</span> New Job
              </button>
            )}
          </div>
        </div>

        {/* Job List */}
        {view === "list" && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Title</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Department</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Location</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Applications</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{job.title}</div>
                      <div className="text-sm text-gray-500">{job.employmentType} · {job.experienceLevel}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">{job.department}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {job.location}
                      {job.isRemote && (
                        <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Remote</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">{job._count?.applications ?? 0}</td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleTogglePublish(job)}
                        className={`text-xs px-3 py-1 rounded-full font-medium ${
                          job.isPublished
                            ? "bg-green-100 text-green-700 hover:bg-green-200"
                            : "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                        }`}
                      >
                        {job.isPublished ? "Published" : "Draft"}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right space-x-3">
                      {job.isPublished && (
                        <a
                          href={`${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/jobs/${job.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-gray-500 hover:text-gray-700"
                          title="Preview live"
                        >
                          ↗
                        </a>
                      )}
                      <button
                        onClick={() => openEdit(job)}
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(job)}
                        className="text-sm text-red-600 hover:text-red-800"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {jobs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      No jobs yet. Create your first job posting!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Job Form */}
        {view === "form" && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 max-w-3xl">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">
              {editingId ? "Edit Job" : "Create New Job"}
            </h2>

            {/* AI Job Assistant */}
            <AiJobAssistant
              currentForm={form}
              onApply={handleAiApply}
            />

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="space-y-5">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Job Title *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Senior Frontend Engineer"
                />
              </div>

              {/* Department + Location */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department *</label>
                  <select
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select department</option>
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location *</label>
                  <input
                    type="text"
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="San Francisco, CA"
                  />
                </div>
              </div>

              {/* Employment Type + Experience Level */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Employment Type</label>
                  <select
                    value={form.employmentType}
                    onChange={(e) => setForm({ ...form, employmentType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {EMPLOYMENT_TYPES.map((t) => (
                      <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Experience Level</label>
                  <select
                    value={form.experienceLevel}
                    onChange={(e) => setForm({ ...form, experienceLevel: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {EXPERIENCE_LEVELS.map((l) => (
                      <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Salary */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Salary Min ($)</label>
                  <input
                    type="number"
                    value={form.salaryMin}
                    onChange={(e) => setForm({ ...form, salaryMin: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="80000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Salary Max ($)</label>
                  <input
                    type="number"
                    value={form.salaryMax}
                    onChange={(e) => setForm({ ...form, salaryMax: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="150000"
                  />
                </div>
              </div>

              {/* Remote + Published toggles */}
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isRemote}
                    onChange={(e) => setForm({ ...form, isRemote: e.target.checked })}
                    className="h-4 w-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-gray-700">Remote Friendly</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isPublished}
                    onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
                    className="h-4 w-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-gray-700">Publish Immediately</span>
                </label>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Describe the role, responsibilities, and team..."
                />
              </div>

              {/* Requirements */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Requirements (one per line)</label>
                <textarea
                  value={form.requirements}
                  onChange={(e) => setForm({ ...form, requirements: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder={"5+ years experience with React\nTypeScript proficiency\nStrong CS fundamentals"}
                />
              </div>

              {/* Benefits */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Benefits (one per line)</label>
                <textarea
                  value={form.benefits}
                  onChange={(e) => setForm({ ...form, benefits: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder={"Health insurance\nRemote work flexibility\nStock options"}
                />
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma separated)</label>
                <input
                  type="text"
                  value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="react, typescript, frontend"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t">
                <button
                  onClick={handleSave}
                  disabled={saving || !form.title || !form.department || !form.location || !form.description}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? "Saving..." : editingId ? "Update Job" : "Create Job"}
                </button>
                <button
                  onClick={() => setView("list")}
                  className="px-6 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
