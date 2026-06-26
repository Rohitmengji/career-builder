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
import Link from "next/link";
import { parseScreeningQuestions } from "@career-builder/shared/screening";
import { isEnabled } from "@career-builder/shared/feature-flags";
import AiJobAssistant from "@/components/jobs/AiJobAssistant";
import HiringTeamDialog from "./HiringTeamDialog";
import type { AiJobFormData } from "@/lib/ai/types";
import { useAuthGuard } from "@/lib/useAuthGuard";
import {
  Button,
  ButtonLink,
  Card,
  Badge,
  Alert,
  EmptyState,
  Field,
  TextareaField,
  Skeleton,
  ArrowLeftIcon,
} from "@/components/ui";
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ExternalLinkIcon,
  BriefcaseIcon,
} from "@/components/jobs/icons";

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
  screeningQuestions: { q: string; requiredAnswer: "yes" | "no" }[];
  scorecardCriteria: string; // one criterion per line (textarea)
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
  screeningQuestions: [],
  scorecardCriteria: "",
};

const DEPARTMENTS = ["Engineering", "Design", "Marketing", "Sales", "People", "Finance", "Operations"];
const EMPLOYMENT_TYPES = ["full-time", "part-time", "contract", "internship"];
const EXPERIENCE_LEVELS = ["entry", "mid", "senior", "lead", "executive"];

/* shared select styles — mirrors the Field input baseline for visual parity */
const SELECT_CLS =
  "w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:border-blue-600 transition";

function titleCase(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

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
  const [biasBusy, setBiasBusy] = useState(false);
  const [biasFindings, setBiasFindings] = useState<{ phrase: string; category: string; suggestion: string }[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { user: authUser } = useAuthGuard();
  const [teamFor, setTeamFor] = useState<{ id: string; title: string } | null>(null);
  const canManageTeams = isEnabled("hiring_teams") && ["super_admin", "admin"].includes(authUser?.role ?? "");

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
      screeningQuestions: parseScreeningQuestions((job as { screeningQuestions?: unknown }).screeningQuestions),
      scorecardCriteria: formatJsonArray((job as { scorecardCriteria?: string }).scorecardCriteria ?? "[]"),
    });
    setError("");
    setView("form");
  }

  async function checkBias() {
    if (biasBusy) return;
    setBiasBusy(true);
    setBiasFindings(null);
    try {
      const res = await fetch("/api/admin/jobs/bias-check", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify({ description: form.description }),
      });
      if (!res.ok) { setBiasFindings([]); return; } // unavailable/off → treat as no findings
      const data = await res.json();
      setBiasFindings(data.available ? data.findings : []);
    } catch {
      setBiasFindings([]);
    } finally {
      setBiasBusy(false);
    }
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
      screeningQuestions: form.screeningQuestions
        .map((s) => ({ q: s.q.trim(), requiredAnswer: s.requiredAnswer }))
        .filter((s) => s.q),
      scorecardCriteria: parseJsonArray(form.scorecardCriteria),
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
      screeningQuestions: form.screeningQuestions,
      scorecardCriteria: form.scorecardCriteria,
    });
  }

  const publishedCount = jobs.filter((j) => j.isPublished).length;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  /* ─── Render ───────────────────────────────────────────────── */

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 md:py-10">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">
              Job Management
            </h1>
            <p className="mt-1 text-sm text-gray-600" role="status">
              {loading
                ? "Loading jobs…"
                : `${jobs.length} job${jobs.length !== 1 ? "s" : ""} · ${publishedCount} published`}
            </p>
          </div>
          <div className="flex gap-3">
            {view === "form" && (
              <Button variant="secondary" onClick={() => setView("list")}>
                <ArrowLeftIcon className="h-4 w-4" />
                Back to list
              </Button>
            )}
            {view === "list" && isEnabled("req_approval") && (
              <Link href="/requisitions" className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
                Requisitions
              </Link>
            )}
            {view === "list" && (
              <Button onClick={openCreate}>
                <PlusIcon className="h-4 w-4" />
                New job
              </Button>
            )}
          </div>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <Card className="overflow-hidden p-0" aria-busy="true">
            <div className="space-y-3 p-6" role="status" aria-label="Loading jobs">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 flex-1 rounded-lg" />
                  <Skeleton className="h-10 w-24 rounded-lg" />
                  <Skeleton className="h-10 w-20 rounded-lg" />
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Job List */}
        {!loading && view === "list" && (
          jobs.length === 0 ? (
            <Card>
              <EmptyState
                icon={<BriefcaseIcon className="h-7 w-7" />}
                title="No jobs yet"
                body="Create your first job posting to start receiving applications."
                action={
                  <Button onClick={openCreate}>
                    <PlusIcon className="h-4 w-4" />
                    New job
                  </Button>
                }
              />
            </Card>
          ) : (
            <Card className="overflow-hidden p-0">
              {/* Desktop / tablet table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left">
                  <caption className="sr-only">List of job postings</caption>
                  <thead className="border-b border-gray-200 bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">Title</th>
                      <th scope="col" className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">Department</th>
                      <th scope="col" className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">Location</th>
                      <th scope="col" className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">Applications</th>
                      <th scope="col" className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">Status</th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {jobs.map((job) => (
                      <tr key={job.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 align-middle">
                          <div className="font-medium text-gray-900">{job.title}</div>
                          <div className="mt-0.5 text-sm text-gray-600">
                            {titleCase(job.employmentType)} · {titleCase(job.experienceLevel)}
                          </div>
                        </td>
                        <td className="px-6 py-4 align-middle text-sm text-gray-700">{job.department}</td>
                        <td className="px-6 py-4 align-middle text-sm text-gray-700">
                          <span className="inline-flex flex-wrap items-center gap-2">
                            {job.location}
                            {job.isRemote && <Badge tone="info">Remote</Badge>}
                          </span>
                        </td>
                        <td className="px-6 py-4 align-middle text-sm text-gray-700">{job._count?.applications ?? 0}</td>
                        <td className="px-6 py-4 align-middle">
                          <button
                            onClick={() => handleTogglePublish(job)}
                            aria-label={
                              job.isPublished
                                ? `Unpublish ${job.title}`
                                : `Publish ${job.title}`
                            }
                            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1"
                          >
                            <Badge tone={job.isPublished ? "success" : "warning"}>
                              <span
                                aria-hidden="true"
                                className={`h-1.5 w-1.5 rounded-full ${job.isPublished ? "bg-emerald-500" : "bg-amber-500"}`}
                              />
                              {job.isPublished ? "Published" : "Draft"}
                            </Badge>
                          </button>
                        </td>
                        <td className="px-6 py-4 align-middle">
                          <div className="flex items-center justify-end gap-1">
                            {job.isPublished && (
                              <a
                                href={`${siteUrl}/jobs/${job.id}`}
                                target="_blank"
                                rel="noreferrer"
                                aria-label={`Preview ${job.title} live (opens in new tab)`}
                                className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                              >
                                <ExternalLinkIcon className="h-5 w-5" />
                              </a>
                            )}
                            {canManageTeams && (
                              <button
                                onClick={() => setTeamFor({ id: job.id, title: job.title })}
                                aria-label={`Manage hiring team for ${job.title}`}
                                className="inline-flex h-11 items-center justify-center rounded-lg px-3 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                              >
                                Team
                              </button>
                            )}
                            <button
                              onClick={() => openEdit(job)}
                              aria-label={`Edit ${job.title}`}
                              className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                            >
                              <PencilIcon className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => handleDelete(job)}
                              aria-label={`Delete ${job.title}`}
                              className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-gray-600 hover:bg-red-50 hover:text-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                            >
                              <TrashIcon className="h-5 w-5" />
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
                {jobs.map((job) => (
                  <li key={job.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900">{job.title}</p>
                        <p className="mt-0.5 text-sm text-gray-600">
                          {titleCase(job.employmentType)} · {titleCase(job.experienceLevel)}
                        </p>
                      </div>
                      <button
                        onClick={() => handleTogglePublish(job)}
                        aria-label={job.isPublished ? `Unpublish ${job.title}` : `Publish ${job.title}`}
                        className="shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                      >
                        <Badge tone={job.isPublished ? "success" : "warning"}>
                          <span
                            aria-hidden="true"
                            className={`h-1.5 w-1.5 rounded-full ${job.isPublished ? "bg-emerald-500" : "bg-amber-500"}`}
                          />
                          {job.isPublished ? "Published" : "Draft"}
                        </Badge>
                      </button>
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                      <div>
                        <dt className="text-gray-500">Department</dt>
                        <dd className="text-gray-800">{job.department}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-500">Location</dt>
                        <dd className="flex flex-wrap items-center gap-1.5 text-gray-800">
                          {job.location}
                          {job.isRemote && <Badge tone="info">Remote</Badge>}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-gray-500">Applications</dt>
                        <dd className="text-gray-800">{job._count?.applications ?? 0}</dd>
                      </div>
                    </dl>
                    <div className="mt-3 flex items-center gap-2">
                      {job.isPublished && (
                        <ButtonLink
                          href={`${siteUrl}/jobs/${job.id}`}
                          target="_blank"
                          rel="noreferrer"
                          variant="ghost"
                          size="sm"
                          aria-label={`Preview ${job.title} live (opens in new tab)`}
                        >
                          <ExternalLinkIcon className="h-4 w-4" />
                          Preview
                        </ButtonLink>
                      )}
                      <Button variant="secondary" size="sm" onClick={() => openEdit(job)}>
                        <PencilIcon className="h-4 w-4" />
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(job)} className="text-red-700 hover:bg-red-50">
                        <TrashIcon className="h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )
        )}

        {/* Job Form */}
        {!loading && view === "form" && (
          <Card className="max-w-3xl">
            <h2 className="mb-6 text-lg font-semibold text-gray-900">
              {editingId ? "Edit job" : "Create new job"}
            </h2>

            {/* AI Job Assistant */}
            <AiJobAssistant currentForm={form} onApply={handleAiApply} />

            {error && (
              <div className="mb-4">
                <Alert tone="error">{error}</Alert>
              </div>
            )}

            <form
              className="space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                handleSave();
              }}
            >
              {/* Title */}
              <Field
                label="Job title"
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Senior Frontend Engineer"
              />

              {/* Department + Location */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="job-department" className="mb-1.5 block text-sm font-medium text-gray-700">
                    Department <span className="text-red-600" aria-hidden="true">*</span>
                    <span className="sr-only"> (required)</span>
                  </label>
                  <select
                    id="job-department"
                    required
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                    className={SELECT_CLS}
                  >
                    <option value="">Select department</option>
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <Field
                  label="Location"
                  required
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="San Francisco, CA"
                />
              </div>

              {/* Employment Type + Experience Level */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="job-employment" className="mb-1.5 block text-sm font-medium text-gray-700">
                    Employment type
                  </label>
                  <select
                    id="job-employment"
                    value={form.employmentType}
                    onChange={(e) => setForm({ ...form, employmentType: e.target.value })}
                    className={SELECT_CLS}
                  >
                    {EMPLOYMENT_TYPES.map((t) => (
                      <option key={t} value={t}>{titleCase(t)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="job-experience" className="mb-1.5 block text-sm font-medium text-gray-700">
                    Experience level
                  </label>
                  <select
                    id="job-experience"
                    value={form.experienceLevel}
                    onChange={(e) => setForm({ ...form, experienceLevel: e.target.value })}
                    className={SELECT_CLS}
                  >
                    {EXPERIENCE_LEVELS.map((l) => (
                      <option key={l} value={l}>{titleCase(l)}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Salary */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  label="Salary min ($)"
                  type="number"
                  value={form.salaryMin}
                  onChange={(e) => setForm({ ...form, salaryMin: e.target.value })}
                  placeholder="80000"
                />
                <Field
                  label="Salary max ($)"
                  type="number"
                  value={form.salaryMax}
                  onChange={(e) => setForm({ ...form, salaryMax: e.target.value })}
                  placeholder="150000"
                />
              </div>

              {/* Remote + Published toggles */}
              <fieldset className="flex flex-wrap gap-6">
                <legend className="sr-only">Visibility options</legend>
                <label className="flex min-h-11 cursor-pointer items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={form.isRemote}
                    onChange={(e) => setForm({ ...form, isRemote: e.target.checked })}
                    className="h-5 w-5 rounded border-gray-300 text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600"
                  />
                  <span className="text-sm text-gray-700">Remote friendly</span>
                </label>
                <label className="flex min-h-11 cursor-pointer items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={form.isPublished}
                    onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
                    className="h-5 w-5 rounded border-gray-300 text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600"
                  />
                  <span className="text-sm text-gray-700">Publish immediately</span>
                </label>
              </fieldset>

              {/* Description */}
              <TextareaField
                label="Description"
                required
                rows={6}
                value={form.description}
                onChange={(e) => { setForm({ ...form, description: e.target.value }); setBiasFindings(null); }}
                placeholder="Describe the role, responsibilities, and team…"
              />

              {/* Inclusive-language check (ADR-0014) — advisory, non-blocking */}
              {isEnabled("ai_jd_bias_detection") && (
                <div className="-mt-2">
                  <button
                    type="button"
                    onClick={checkBias}
                    disabled={biasBusy || !form.description.trim()}
                    className="text-sm font-medium text-blue-600 hover:underline disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
                  >
                    {biasBusy ? "Checking…" : "Check for inclusive language"}
                  </button>
                  {biasFindings !== null && biasFindings.length === 0 && (
                    <p className="mt-1.5 text-xs text-emerald-700">No exclusionary language detected.</p>
                  )}
                  {biasFindings !== null && biasFindings.length > 0 && (
                    <ul className="mt-2 space-y-1.5">
                      {biasFindings.map((f, i) => (
                        <li key={i} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                          <span className="font-semibold">“{f.phrase}”</span> <span className="text-amber-700">({f.category})</span> — {f.suggestion}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Requirements */}
              <TextareaField
                label="Requirements"
                hint="One per line."
                rows={4}
                value={form.requirements}
                onChange={(e) => setForm({ ...form, requirements: e.target.value })}
                placeholder={"5+ years experience with React\nTypeScript proficiency\nStrong CS fundamentals"}
              />

              {/* Benefits */}
              <TextareaField
                label="Benefits"
                hint="One per line."
                rows={3}
                value={form.benefits}
                onChange={(e) => setForm({ ...form, benefits: e.target.value })}
                placeholder={"Health insurance\nRemote work flexibility\nStock options"}
              />

              {/* Tags */}
              <Field
                label="Tags"
                hint="Comma separated."
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="react, typescript, frontend"
              />

              {/* Screening / knockout questions */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700">Screening questions</label>
                  <button
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        screeningQuestions: [...form.screeningQuestions, { q: "", requiredAnswer: "yes" }],
                      })
                    }
                    className="text-sm font-medium text-blue-600 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
                  >
                    + Add question
                  </button>
                </div>
                <p className="mb-2 text-xs text-gray-500">
                  Yes/no questions candidates answer when applying. Pick the answer required to pass —
                  applicants who answer otherwise are flagged for review (never auto-rejected).
                </p>
                {form.screeningQuestions.length === 0 ? (
                  <p className="text-sm text-gray-400">No screening questions.</p>
                ) : (
                  <div className="space-y-2">
                    {form.screeningQuestions.map((sq, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={sq.q}
                          onChange={(e) => {
                            const next = [...form.screeningQuestions];
                            next[i] = { ...next[i], q: e.target.value };
                            setForm({ ...form, screeningQuestions: next });
                          }}
                          placeholder="e.g. Are you authorized to work in the US?"
                          maxLength={300}
                          className="h-10 flex-1 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600"
                        />
                        <select
                          value={sq.requiredAnswer}
                          onChange={(e) => {
                            const next = [...form.screeningQuestions];
                            next[i] = { ...next[i], requiredAnswer: e.target.value === "no" ? "no" : "yes" };
                            setForm({ ...form, screeningQuestions: next });
                          }}
                          aria-label="Required answer to pass"
                          className="h-10 rounded-lg border border-gray-300 bg-white px-2 text-sm focus:outline-none focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600"
                        >
                          <option value="yes">Must be Yes</option>
                          <option value="no">Must be No</option>
                        </select>
                        <button
                          type="button"
                          onClick={() =>
                            setForm({
                              ...form,
                              screeningQuestions: form.screeningQuestions.filter((_, j) => j !== i),
                            })
                          }
                          aria-label="Remove question"
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Interview scorecard rubric (ADR-0007) */}
              <TextareaField
                label="Interview scorecard rubric"
                hint="One criterion per line. Interviewers score each 1–5."
                rows={4}
                value={form.scorecardCriteria}
                onChange={(e) => setForm({ ...form, scorecardCriteria: e.target.value })}
                placeholder={"Technical depth\nProblem solving\nCommunication\nCulture add"}
              />

              {/* Actions */}
              <div className="flex flex-col gap-3 border-t border-gray-200 pt-5 sm:flex-row">
                <Button
                  type="submit"
                  loading={saving}
                  disabled={saving || !form.title || !form.department || !form.location || !form.description}
                >
                  {saving ? "Saving…" : editingId ? "Update job" : "Create job"}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setView("list")}>
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        )}
      </div>
      {teamFor && (
        <HiringTeamDialog jobId={teamFor.id} jobTitle={teamFor.title} csrf={csrf} onClose={() => setTeamFor(null)} />
      )}
    </main>
  );
}
