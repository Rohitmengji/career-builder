/*
 * /jobs — Job search page with filter sidebar, job cards, and pagination.
 *
 * Client component so we can use the useJobSearch hook for
 * debounced searching, URL-synced filters, and real-time facets.
 */

"use client";

import React, { Suspense, useEffect, useId, useState } from "react";
import Link from "next/link";
import { useJobSearch } from "@/lib/jobs/useJobSearch";
import { useRecentSearches } from "@/lib/jobs/useRecentSearches";
import PersonalizedSuggestions from "@/components/PersonalizedSuggestions";
import SiteHeader from "@/components/SiteHeader";
import type { Job, FacetBucket, EmploymentType, ExperienceLevel } from "@/lib/jobs/types";
import { trackJobListView, trackSearch } from "@/lib/analytics";
import {
  Badge,
  Button,
  Card,
  Container,
  EmptyState,
  Skeleton,
  Spinner,
  ArrowLeftIcon,
  ArrowRightIcon,
  ChevronDownIcon,
  MapPinIcon,
  SearchIcon,
  XIcon,
} from "@/components/ui";
import {
  ResponsiveDrawer,
  useIsMobile,
} from "@/lib/design-system-components";

/* ================================================================== */
/*  Wrapper — Suspense boundary for useSearchParams                    */
/* ================================================================== */

export default function JobsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-50 text-blue-600">
          <Spinner className="h-8 w-8" />
          <span className="sr-only">Loading jobs…</span>
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
  const isMobile = useIsMobile(1024);
  const [filtersOpen, setFiltersOpen] = useState(false);

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

  // Analytics: fire job_list_view once on mount, track searches
  useEffect(() => {
    trackJobListView();
  }, []);

  useEffect(() => {
    if (params.q) trackSearch(params.q);
  }, [params.q]);

  const activeFilterCount =
    (params.location ? 1 : 0) +
    (params.department ? 1 : 0) +
    (params.employmentType ? 1 : 0) +
    (params.experienceLevel ? 1 : 0) +
    (params.isRemote ? 1 : 0);

  const hasActiveFilters = !!params.q || activeFilterCount > 0;

  const filters = (
    <FiltersPanel
      data={data}
      params={params}
      setParam={setParam}
      resetFilters={resetFilters}
      activeFilterCount={activeFilterCount}
    />
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <SiteHeader />

      <main id="main-content" className="py-8 md:py-10">
        <Container>
          {/* Page heading */}
          <div className="mb-6 flex flex-col gap-1 sm:mb-8">
            <Link
              href="/"
              className="inline-flex w-fit items-center gap-1.5 rounded-lg py-1 text-sm font-medium text-gray-600 transition-colors hover:text-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              All careers
            </Link>
            <h1 className="text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">
              Open positions
            </h1>
            <p className="text-sm text-gray-600">
              {data.pagination.total} open position{data.pagination.total !== 1 ? "s" : ""} — find your next role.
            </p>
          </div>

          {/* Search bar */}
          <div className="mb-6">
            <SearchBar value={queryInput} onChange={setQuery} />
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

          <div className="flex flex-col gap-8 lg:flex-row">
            {/* Filter sidebar — desktop only */}
            <aside className="hidden w-64 shrink-0 lg:block" aria-label="Filters">
              <div className="sticky top-24">
                <Card className="p-5">{filters}</Card>
              </div>
            </aside>

            {/* Job cards */}
            <div className="min-w-0 flex-1">
              {/* Sort + filter trigger bar */}
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-sm text-gray-600" role="status" aria-live="polite">
                  {isLoading ? (
                    "Searching…"
                  ) : data.pagination.total === 0 ? (
                    "No results"
                  ) : (
                    <>
                      Showing{" "}
                      <strong className="font-semibold text-gray-900">
                        {(data.pagination.page - 1) * data.pagination.perPage + 1}–
                        {Math.min(data.pagination.page * data.pagination.perPage, data.pagination.total)}
                      </strong>{" "}
                      of <strong className="font-semibold text-gray-900">{data.pagination.total}</strong>
                    </>
                  )}
                </p>

                <div className="flex items-center gap-2">
                  {/* Mobile filter trigger */}
                  <button
                    type="button"
                    onClick={() => setFiltersOpen(true)}
                    className="inline-flex h-11 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 lg:hidden"
                  >
                    <FilterIcon className="h-4 w-4" aria-hidden="true" />
                    Filters
                    {activeFilterCount > 0 && (
                      <Badge tone="brand" className="px-1.5">
                        {activeFilterCount}
                      </Badge>
                    )}
                  </button>

                  <SortSelect
                    value={params.sortBy || "postedAt"}
                    onChange={(v) => setParam("sortBy", v)}
                  />
                </div>
              </div>

              {/* Error state */}
              {error && (
                <div
                  role="alert"
                  className="mb-4 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                  {error}
                </div>
              )}

              {/* Results */}
              <div aria-busy={isLoading || undefined}>
                {isLoading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <JobCardSkeleton key={i} />
                    ))}
                  </div>
                ) : data.jobs.length === 0 ? (
                  <Card className="p-0">
                    <EmptyState
                      icon={<SearchIcon className="h-6 w-6" />}
                      title="No jobs found"
                      body="Try adjusting your search terms or filters to see more roles."
                      action={
                        hasActiveFilters ? (
                          <Button variant="secondary" size="md" onClick={resetFilters}>
                            Clear all filters
                          </Button>
                        ) : undefined
                      }
                    />
                  </Card>
                ) : (
                  <ul className="space-y-4">
                    {data.jobs.map((job) => (
                      <JobCard key={job.id} job={job} />
                    ))}
                  </ul>
                )}
              </div>

              {/* Pagination */}
              {!isLoading && data.pagination.totalPages > 1 && (
                <Pagination
                  page={data.pagination.page}
                  totalPages={data.pagination.totalPages}
                  onPageChange={setPage}
                />
              )}
            </div>
          </div>
        </Container>
      </main>

      {/* Mobile filter drawer */}
      {isMobile && (
        <ResponsiveDrawer
          isOpen={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          side="left"
          label="Filters"
        >
          {filters}
        </ResponsiveDrawer>
      )}
    </div>
  );
}

/* ================================================================== */
/*  Search bar                                                         */
/* ================================================================== */

function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="sr-only">
        Search jobs by title, keyword, or department
      </label>
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
        <input
          id={id}
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search jobs by title, keyword, or department…"
          className="h-12 w-full rounded-lg border border-gray-300 bg-white pl-12 pr-12 text-base text-gray-900 shadow-xs transition placeholder:text-gray-500 focus:outline-none focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <XIcon className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Sort select                                                        */
/* ================================================================== */

function SortSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        Sort jobs by
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 appearance-none rounded-lg border border-gray-300 bg-white pl-3 pr-9 text-sm text-gray-900 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600"
      >
        <option value="postedAt">Newest first</option>
        <option value="title">Title A–Z</option>
        <option value="department">Department</option>
      </select>
      <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
    </div>
  );
}

/* ================================================================== */
/*  Filters panel (shared between sidebar + mobile drawer)             */
/* ================================================================== */

type JobSearchHook = ReturnType<typeof useJobSearch>;

function FiltersPanel({
  data,
  params,
  setParam,
  resetFilters,
  activeFilterCount,
}: {
  data: JobSearchHook["data"];
  params: JobSearchHook["params"];
  setParam: JobSearchHook["setParam"];
  resetFilters: JobSearchHook["resetFilters"];
  activeFilterCount: number;
}) {
  const remoteCount = data.facets.isRemote.find((b) => b.value === "true")?.count ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-900">Filters</h2>
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={resetFilters}
            className="rounded-md px-1.5 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            Clear all
          </button>
        )}
      </div>

      <FacetGroup
        label="Department"
        buckets={data.facets.department}
        selected={params.department}
        onSelect={(v) => setParam("department", v === params.department ? undefined : v)}
      />

      <FacetGroup
        label="Location"
        buckets={data.facets.location}
        selected={params.location}
        onSelect={(v) => setParam("location", v === params.location ? undefined : v)}
      />

      <FacetGroup
        label="Employment Type"
        buckets={data.facets.employmentType}
        selected={params.employmentType}
        onSelect={(v) =>
          setParam("employmentType", v === params.employmentType ? undefined : (v as EmploymentType))
        }
        formatLabel={formatEmploymentType}
      />

      <FacetGroup
        label="Experience Level"
        buckets={data.facets.experienceLevel}
        selected={params.experienceLevel}
        onSelect={(v) =>
          setParam("experienceLevel", v === params.experienceLevel ? undefined : (v as ExperienceLevel))
        }
        formatLabel={formatExperienceLevel}
      />

      {/* Remote */}
      <div>
        <label className="flex min-h-[44px] cursor-pointer select-none items-center gap-2.5 rounded-lg px-1 transition-colors hover:bg-gray-50">
          <input
            type="checkbox"
            checked={!!params.isRemote}
            onChange={(e) => setParam("isRemote", e.target.checked ? true : undefined)}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600"
          />
          <span className="text-sm text-gray-700">Remote only</span>
          <span className="ml-auto text-xs text-gray-500">{remoteCount}</span>
        </label>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Job Card                                                           */
/* ================================================================== */

function JobCard({ job }: { job: Job }) {
  // Relative "days ago" label is intentionally computed from the current time at
  // render; any slight drift on re-render is cosmetic and harmless here.
  const daysAgo = Math.floor(
    // eslint-disable-next-line react-hooks/purity
    (Date.now() - new Date(job.postedAt).getTime()) / (1000 * 60 * 60 * 24),
  );
  const postedLabel =
    daysAgo === 0 ? "Today" : daysAgo === 1 ? "Yesterday" : `${daysAgo}d ago`;

  return (
    <Card as="li" interactive className="group p-0 transition-all">
      <Link
        href={`/jobs/${job.id}`}
        className="block rounded-2xl p-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 sm:p-6"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-lg font-semibold text-gray-900 transition-colors group-hover:text-blue-600">
              {job.title}
            </h3>
            <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-gray-600">
              <span>{job.department}</span>
              <span aria-hidden="true" className="text-gray-400">·</span>
              <span className="inline-flex items-center gap-1">
                <MapPinIcon className="h-4 w-4 text-gray-500" />
                {job.location}
              </span>
              {job.isRemote && (
                <Badge tone="info" className="ml-1">Remote</Badge>
              )}
            </p>
            <p className="mt-2 line-clamp-2 text-sm text-gray-600">{job.description}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone="neutral">{formatEmploymentType(job.employmentType)}</Badge>
              <Badge tone="neutral">{formatExperienceLevel(job.experienceLevel)}</Badge>
              {job.salary && <Badge tone="neutral">{formatSalary(job.salary)}</Badge>}
            </div>
          </div>
          <div className="flex shrink-0 flex-row items-center justify-between gap-2 sm:flex-col sm:items-end">
            <span className="text-xs text-gray-500">{postedLabel}</span>
            <span className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 transition-colors group-hover:text-blue-700">
              View
              <ArrowRightIcon className="h-4 w-4" />
            </span>
          </div>
        </div>
      </Link>
    </Card>
  );
}

function JobCardSkeleton() {
  return (
    <Card className="p-5 sm:p-6" aria-hidden="true">
      <Skeleton className="mb-3 h-5 w-2/3" />
      <Skeleton className="mb-3 h-4 w-1/3" />
      <Skeleton className="mb-2 h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
    </Card>
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
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</h3>
      <ul className="space-y-0.5">
        {buckets.slice(0, 8).map((bucket) => {
          const isActive = selected === bucket.value;
          return (
            <li key={bucket.value}>
              <button
                type="button"
                onClick={() => onSelect(bucket.value)}
                aria-pressed={isActive}
                className={`flex min-h-[44px] w-full items-center justify-between gap-2 rounded-lg px-2.5 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                  isActive
                    ? "bg-blue-50 font-medium text-blue-700"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <span className="truncate">
                  {formatLabel ? formatLabel(bucket.value) : bucket.value}
                </span>
                <span className={`ml-2 shrink-0 text-xs ${isActive ? "text-blue-600" : "text-gray-500"}`}>
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
  const navBtn =
    "inline-flex h-11 min-w-[44px] items-center justify-center gap-1 rounded-lg px-3 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600";

  return (
    <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-1">
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className={`${navBtn} text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-400 disabled:hover:bg-transparent`}
      >
        <ArrowLeftIcon className="h-4 w-4" />
        <span className="hidden sm:inline">Prev</span>
        <span className="sr-only sm:hidden">Previous page</span>
      </button>
      {pages.map((p, i) =>
        p === "..." ? (
          <span key={`ellipsis-${i}`} className="px-2 py-2 text-sm text-gray-500" aria-hidden="true">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p as number)}
            aria-current={p === page ? "page" : undefined}
            aria-label={`Page ${p}`}
            className={`${navBtn} ${
              p === page
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            {p}
          </button>
        ),
      )}
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className={`${navBtn} text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-400 disabled:hover:bg-transparent`}
      >
        <span className="hidden sm:inline">Next</span>
        <span className="sr-only sm:hidden">Next page</span>
        <ArrowRightIcon className="h-4 w-4" />
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
/*  Local icons (not in the shared set)                                */
/* ================================================================== */

function FilterIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M4 6h16M7 12h10M10 18h4" />
    </svg>
  );
}
