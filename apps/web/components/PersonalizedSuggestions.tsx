/*
 * PersonalizedSuggestions — shown on the job search page above results.
 *
 * Displays "Based on your interests" job chips when the user has
 * browsing history but hasn't applied any filters yet.
 */

"use client";

import React from "react";
import type { SearchHistory } from "@/lib/jobs/useRecentSearches";

interface PersonalizedSuggestionsProps {
  history: SearchHistory;
  onFilterByDepartment: (dept: string) => void;
  onFilterByLocation: (loc: string) => void;
  onSearchQuery: (q: string) => void;
}

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
    <div className="bg-linear-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100 p-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <SparkleIcon />
        <h3 className="text-sm font-semibold text-gray-900">Based on your interests</h3>
      </div>

      <div className="flex flex-wrap gap-2">
        {/* Department chips */}
        {history.departments.slice(0, 3).map((dept) => (
          <button
            key={`dept-${dept}`}
            onClick={() => onFilterByDepartment(dept)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-full text-sm font-medium text-blue-700 border border-blue-200 hover:bg-blue-50 hover:border-blue-300 transition-colors shadow-sm"
          >
            <DeptIcon />
            {dept}
          </button>
        ))}

        {/* Location chips */}
        {history.locations.slice(0, 2).map((loc) => (
          <button
            key={`loc-${loc}`}
            onClick={() => onFilterByLocation(loc)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-full text-sm font-medium text-emerald-700 border border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300 transition-colors shadow-sm"
          >
            <LocIcon />
            {loc}
          </button>
        ))}

        {/* Recent search chips */}
        {history.queries.slice(0, 2).map((q) => (
          <button
            key={`q-${q}`}
            onClick={() => onSearchQuery(q)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-full text-sm font-medium text-purple-700 border border-purple-200 hover:bg-purple-50 hover:border-purple-300 transition-colors shadow-sm"
          >
            <SearchChipIcon />
            {q}
          </button>
        ))}
      </div>

      {/* Recently viewed section */}
      {history.viewedJobIds.length > 0 && (
        <div className="mt-3 pt-3 border-t border-blue-100">
          <p className="text-xs text-gray-500 mb-1">
            Recently viewed · {history.viewedJobIds.length} job{history.viewedJobIds.length !== 1 ? "s" : ""}
          </p>
        </div>
      )}
    </div>
  );
}

function SparkleIcon() {
  return (
    <svg className="h-4 w-4 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
      <path d="M10 1l2.39 5.85L18 8.5l-4.5 3.75L14.78 18 10 14.75 5.22 18l1.28-5.75L2 8.5l5.61-1.65L10 1z" />
    </svg>
  );
}

function DeptIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
    </svg>
  );
}

function LocIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
    </svg>
  );
}

function SearchChipIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  );
}
