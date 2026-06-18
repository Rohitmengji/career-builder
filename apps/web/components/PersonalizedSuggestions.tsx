/*
 * PersonalizedSuggestions — shown on the job search page above results.
 *
 * Displays "Based on your interests" job chips when the user has
 * browsing history but hasn't applied any filters yet.
 */

"use client";

import React from "react";
import type { SearchHistory } from "@/lib/jobs/useRecentSearches";
import { MapPinIcon, SearchIcon } from "@/components/ui";

interface PersonalizedSuggestionsProps {
  history: SearchHistory;
  onFilterByDepartment: (dept: string) => void;
  onFilterByLocation: (loc: string) => void;
  onSearchQuery: (q: string) => void;
}

const CHIP_BASE =
  "inline-flex min-h-[36px] items-center gap-1.5 rounded-full border bg-white px-3 py-1.5 text-sm font-medium shadow-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600";

export default function PersonalizedSuggestions({
  history,
  onFilterByDepartment,
  onFilterByLocation,
  onSearchQuery,
}: PersonalizedSuggestionsProps) {
  const hasDepts = history.departments.length > 0;
  const hasQueries = history.queries.length > 0;
  const hasLocs = history.locations.length > 0;

  if (!hasDepts && !hasQueries && !hasLocs) return null;

  return (
    <section
      aria-label="Suggestions based on your interests"
      className="mb-6 rounded-2xl border border-blue-100 bg-linear-to-r from-blue-50 to-indigo-50 p-5"
    >
      <div className="mb-3 flex items-center gap-2">
        <SparkleIcon />
        <h2 className="text-sm font-semibold text-gray-900">Based on your interests</h2>
      </div>

      <div className="flex flex-wrap gap-2">
        {/* Department chips */}
        {history.departments.slice(0, 3).map((dept) => (
          <button
            key={`dept-${dept}`}
            type="button"
            onClick={() => onFilterByDepartment(dept)}
            className={`${CHIP_BASE} border-blue-200 text-blue-700 hover:border-blue-300 hover:bg-blue-50`}
          >
            <DeptIcon />
            {dept}
          </button>
        ))}

        {/* Location chips */}
        {history.locations.slice(0, 2).map((loc) => (
          <button
            key={`loc-${loc}`}
            type="button"
            onClick={() => onFilterByLocation(loc)}
            className={`${CHIP_BASE} border-emerald-200 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50`}
          >
            <MapPinIcon className="h-3.5 w-3.5" />
            {loc}
          </button>
        ))}

        {/* Recent search chips */}
        {history.queries.slice(0, 2).map((q) => (
          <button
            key={`q-${q}`}
            type="button"
            onClick={() => onSearchQuery(q)}
            className={`${CHIP_BASE} border-purple-200 text-purple-700 hover:border-purple-300 hover:bg-purple-50`}
          >
            <SearchIcon className="h-3.5 w-3.5" />
            {q}
          </button>
        ))}
      </div>

      {/* Recently viewed section */}
      {history.viewedJobIds.length > 0 && (
        <div className="mt-3 border-t border-blue-100 pt-3">
          <p className="text-xs text-gray-600">
            Recently viewed{" "}
            <span aria-hidden="true">·</span> {history.viewedJobIds.length} job
            {history.viewedJobIds.length !== 1 ? "s" : ""}
          </p>
        </div>
      )}
    </section>
  );
}

function SparkleIcon() {
  return (
    <svg className="h-4 w-4 text-blue-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M10 1l2.39 5.85L18 8.5l-4.5 3.75L14.78 18 10 14.75 5.22 18l1.28-5.75L2 8.5l5.61-1.65L10 1z" />
    </svg>
  );
}

function DeptIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"
      />
    </svg>
  );
}
