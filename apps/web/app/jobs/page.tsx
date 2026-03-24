/*
 * /jobs — Job search page with filter sidebar, job cards, and pagination.
 *
 * Client component so we can use the useJobSearch hook for
 * debounced searching, URL-synced filters, and real-time facets.
 */

"use client";

import React, { Suspense, useCallback, useEffect } from "react";
import Link from "next/link";
import { useJobSearch } from "@/lib/jobs/useJobSearch";
import { useRecentSearches } from "@/lib/jobs/useRecentSearches";
import PersonalizedSuggestions from "@/components/PersonalizedSuggestions";
import type { Job, FacetBucket, EmploymentType, ExperienceLevel } from "@/lib/jobs/types";

/* ================================================================== */
/*  Wrapper — Suspense boundary for useSearchParams                    */
/* ================================================================== */

export default function JobsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <Spinner />
        </div>
      }
    >
      <JobsPageInner />
    </Suspense>
  );
}

/* ================================================================== */
/*  Inner page                                                         */
/* ================================================================== */

function JobsPageInner() {
  const {
    data,
    isLoading,
    error,
    params,
    setParam,
    setQuery,
    setPage,
    resetFilters,
    queryInput,
  } = useJobSearch();

  const { history, trackQuery, trackDepartment, trackLocation } = useRecentSearches();

  // Track search activity for personalization
  useEffect(() => {
    if (params.q) trackQuery(params.q);
  }, [params.q, trackQuery]);

  useEffect(() => {
    if (params.department) trackDepartment(params.department);
  }, [params.department, trackDepartment]);

  useEffect(() => {
    if (params.location) trackLocation(params.location);
  }, [params.location, trackLocation]);

  const hasActiveFilters =
    !!params.q ||
    !!params.location ||
    !!params.department ||
    !!params.employmentType ||
    !!params.experienceLevel ||
    !!params.isRemote;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-gray-900 hover:text-blue-600 transition-colors">
            ← Careers
          </Link>
          <span className="text-sm text-gray-500">
            {data.pagination.total} open position{data.pagination.total !== 1 && "s"}
          </span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search bar */}
        <div className="mb-8">
          <div className="relative">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={queryInput}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search jobs by title, keyword, or department…"
              className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-gray-300 bg-white shadow-sm text-base placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
            />
            {queryInput && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Personalized suggestions based on browsing history */}
        {!hasActiveFilters && (
          <PersonalizedSuggestions
            history={history}
            onFilterByDepartment={(dept) => setParam("department", dept)}
            onFilterByLocation={(loc) => setParam("location", loc)}
            onSearchQuery={(q) => setQuery(q)}
          />
        )}

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Filter sidebar */}
          <aside className="w-full lg:w-64 shrink-0">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-6 sticky top-24">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Filters</h2>
                {hasActiveFilters && (
                  <button
                    onClick={resetFilters}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Clear all
                  </button>
                )}
              </div>

              {/* Department */}
              <FacetGroup
                label="Department"
                buckets={data.facets.department}
                selected={params.department}
                onSelect={(v) => setParam("department", v === params.department ? undefined : v)}
              />

              {/* Location */}
              <FacetGroup
                label="Location"
                buckets={data.facets.location}
                selected={params.location}
                onSelect={(v) => setParam("location", v === params.location ? undefined : v)}
              />

              {/* Employment Type */}
              <FacetGroup
                label="Employment Type"
                buckets={data.facets.employmentType}
                selected={params.employmentType}
                onSelect={(v) =>
                  setParam(
                    "employmentType",
                    v === params.employmentType ? undefined : (v as EmploymentType),
                  )
                }
                formatLabel={formatEmploymentType}
              />

              {/* Experience Level */}
              <FacetGroup
                label="Experience Level"
                buckets={data.facets.experienceLevel}
                selected={params.experienceLevel}
                onSelect={(v) =>
                  setParam(
                    "experienceLevel",
                    v === params.experienceLevel ? undefined : (v as ExperienceLevel),
                  )
                }
                formatLabel={formatExperienceLevel}
              />

              {/* Remote */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={!!params.isRemote}
                    onChange={(e) => setParam("isRemote", e.target.checked ? true : undefined)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Remote only</span>
                  <span className="ml-auto text-xs text-gray-400">
                    {data.facets.isRemote.find((b) => b.value === "true")?.count ?? 0}
                  </span>
                </label>
              </div>
            </div>
          </aside>

          {/* Job cards */}
          <div className="flex-1 min-w-0">
            {/* Sort bar */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-500">
                {isLoading ? (
                  "Searching…"
                ) : (
                  <>
                    Showing{" "}
                    <strong className="text-gray-900">
                      {(data.pagination.page - 1) * data.pagination.perPage + 1}–
                      {Math.min(data.pagination.page * data.pagination.perPage, data.pagination.total)}
                    </strong>{" "}
                    of <strong className="text-gray-900">{data.pagination.total}</strong>
                  </>
                )}
              </p>
              <select
                value={params.sortBy || "postedAt"}
                onChange={(e) => setParam("sortBy", e.target.value)}
                className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="postedAt">Newest first</option>
                <option value="title">Title A–Z</option>
                <option value="department">Department</option>
              </select>
            </div>

            {/* Error state */}
            {error && (
              <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
                {error}
              </div>
            )}

            {/* Loading skeleton */}
            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <JobCardSkeleton key={i} />
                ))}
              </div>
            ) : data.jobs.length === 0 ? (
              /* Empty state */
              <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
                <div className="text-5xl mb-4">🔍</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No jobs found</h3>
                <p className="text-gray-500 mb-4">Try adjusting your search or filters.</p>
                {hasActiveFilters && (
                  <button
                    onClick={resetFilters}
                    className="text-sm font-medium text-blue-600 hover:text-blue-800"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            ) : (
              /* Job list */
              <div className="space-y-4">
                {data.jobs.map((job) => (
                  <JobCard key={job.id} job={job} />
                ))}
              </div>
            )}

            {/* Pagination */}
            {data.pagination.totalPages > 1 && (
              <Pagination
                page={data.pagination.page}
                totalPages={data.pagination.totalPages}
                onPageChange={setPage}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

/* ================================================================== */
/*  Job Card                                                           */
/* ================================================================== */

function JobCard({ job }: { job: Job }) {
  const daysAgo = Math.floor(
    (Date.now() - new Date(job.postedAt).getTime()) / (1000 * 60 * 60 * 24),
  );
  const postedLabel =
    daysAgo === 0 ? "Today" : daysAgo === 1 ? "Yesterday" : `${daysAgo}d ago`;

  return (
    <Link
      href={`/jobs/${job.id}`}
      className="block bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all duration-200 p-5 group"
    >
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors truncate">
            {job.title}
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            {job.department} · {job.location}
            {job.isRemote && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
                Remote
              </span>
            )}
          </p>
          <p className="text-sm text-gray-600 mt-2 line-clamp-2">{job.description}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            <Tag>{formatEmploymentType(job.employmentType)}</Tag>
            <Tag>{formatExperienceLevel(job.experienceLevel)}</Tag>
            {job.salary && <Tag>{formatSalary(job.salary)}</Tag>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className="text-xs text-gray-400">{postedLabel}</span>
          <span className="text-sm font-medium text-blue-600 group-hover:text-blue-700 transition-colors">
            View →
          </span>
        </div>
      </div>
    </Link>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
      {children}
    </span>
  );
}

function JobCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
      <div className="h-5 bg-gray-200 rounded w-2/3 mb-3" />
      <div className="h-4 bg-gray-100 rounded w-1/3 mb-3" />
      <div className="h-4 bg-gray-100 rounded w-full mb-2" />
      <div className="h-4 bg-gray-100 rounded w-4/5" />
    </div>
  );
}

/* ================================================================== */
/*  Facet group                                                        */
/* ================================================================== */

function FacetGroup({
  label,
  buckets,
  selected,
  onSelect,
  formatLabel,
}: {
  label: string;
  buckets: FacetBucket[];
  selected?: string;
  onSelect: (value: string) => void;
  formatLabel?: (v: string) => string;
}) {
  if (buckets.length === 0) return null;

  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{label}</h3>
      <ul className="space-y-1">
        {buckets.slice(0, 8).map((bucket) => {
          const isActive = selected === bucket.value;
          return (
            <li key={bucket.value}>
              <button
                onClick={() => onSelect(bucket.value)}
                className={`w-full flex items-center justify-between text-sm px-2 py-1.5 rounded-lg transition-colors ${isActive ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-700 hover:bg-gray-50"}`}
              >
                <span className="truncate">
                  {formatLabel ? formatLabel(bucket.value) : bucket.value}
                </span>
                <span
                  className={`text-xs ml-2 shrink-0 ${isActive ? "text-blue-500" : "text-gray-400"}`}
                >
                  {bucket.count}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ================================================================== */
/*  Pagination                                                         */
/* ================================================================== */

function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}) {
  const pages = usePaginationRange(page, totalPages);

  return (
    <nav className="flex items-center justify-center gap-1 mt-8">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="px-3 py-2 text-sm rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        ← Prev
      </button>
      {pages.map((p, i) =>
        p === "..." ? (
          <span key={`ellipsis-${i}`} className="px-2 py-2 text-sm text-gray-400">
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p as number)}
            className={`px-3 py-2 text-sm rounded-lg font-medium transition-colors ${p === page ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}
          >
            {p}
          </button>
        ),
      )}
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="px-3 py-2 text-sm rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Next →
      </button>
    </nav>
  );
}

function usePaginationRange(page: number, totalPages: number): (number | "...")[] {
  const delta = 2;
  const pages: (number | "...")[] = [];

  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - delta && i <= page + delta)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== "...") {
      pages.push("...");
    }
  }
  return pages;
}

/* ================================================================== */
/*  Formatting helpers                                                 */
/* ================================================================== */

function formatEmploymentType(t: string): string {
  const map: Record<string, string> = {
    "full-time": "Full-time",
    "part-time": "Part-time",
    contract: "Contract",
    internship: "Internship",
    temporary: "Temporary",
  };
  return map[t] || t;
}

function formatExperienceLevel(l: string): string {
  const map: Record<string, string> = {
    entry: "Entry level",
    mid: "Mid level",
    senior: "Senior",
    lead: "Lead",
    executive: "Executive",
  };
  return map[l] || l;
}

function formatSalary(salary: Job["salary"]): string {
  if (!salary) return "";
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: salary.currency, maximumFractionDigits: 0 }).format(n);
  if (salary.min && salary.max) return `${fmt(salary.min)} – ${fmt(salary.max)}`;
  if (salary.min) return `From ${fmt(salary.min)}`;
  if (salary.max) return `Up to ${fmt(salary.max)}`;
  return "";
}

/* ================================================================== */
/*  Icons                                                              */
/* ================================================================== */

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  );
}

function Spinner() {
  return (
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
  );
}
