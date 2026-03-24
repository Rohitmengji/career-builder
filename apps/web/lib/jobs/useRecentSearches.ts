/*
 * useRecentSearches — localStorage-backed search history for personalization.
 *
 * Tracks:
 *   - Recent search queries
 *   - Departments the user clicked into
 *   - Locations the user filtered by
 *   - Job IDs the user viewed
 *
 * Used by PersonalizedSidebar and PersonalizedSuggestions to surface
 * relevant jobs based on browsing behaviour.
 */

"use client";

import { useState, useCallback, useEffect, useRef } from "react";

const STORAGE_KEY = "cb_search_history";
const MAX_ITEMS = 20;
const MAX_VIEWED = 50;

export interface SearchHistory {
  /** Recent text searches */
  queries: string[];
  /** Departments the user browsed */
  departments: string[];
  /** Locations the user browsed */
  locations: string[];
  /** Job IDs the user viewed (most recent first) */
  viewedJobIds: string[];
  /** Tags/skills the user saw (from viewed jobs) */
  tags: string[];
  /** Last updated timestamp */
  updatedAt: number;
}

const EMPTY_HISTORY: SearchHistory = {
  queries: [],
  departments: [],
  locations: [],
  viewedJobIds: [],
  tags: [],
  updatedAt: 0,
};

function loadHistory(): SearchHistory {
  if (typeof window === "undefined") return EMPTY_HISTORY;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_HISTORY;
    return JSON.parse(raw) as SearchHistory;
  } catch {
    return EMPTY_HISTORY;
  }
}

function saveHistory(h: SearchHistory): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(h));
  } catch {
    // localStorage full — ignore
  }
}

/** Push a value to the front of an array, de-duplicate, cap at max */
function pushUnique(arr: string[], value: string, max: number): string[] {
  const filtered = arr.filter((v) => v !== value);
  return [value, ...filtered].slice(0, max);
}

export interface UseRecentSearchesResult {
  history: SearchHistory;
  /** Track a text search query */
  trackQuery: (q: string) => void;
  /** Track a department browse/filter */
  trackDepartment: (dept: string) => void;
  /** Track a location browse/filter */
  trackLocation: (loc: string) => void;
  /** Track a job view (call on job detail page) */
  trackJobView: (jobId: string, tags?: string[], department?: string, location?: string) => void;
  /** Get top interest keywords for API personalization */
  getInterestSignals: () => { departments: string[]; locations: string[]; tags: string[]; queries: string[] };
  /** Clear all history */
  clearHistory: () => void;
}

export function useRecentSearches(): UseRecentSearchesResult {
  const [history, setHistory] = useState<SearchHistory>(EMPTY_HISTORY);
  const initialized = useRef(false);

  // Load from localStorage on mount (client only)
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      setHistory(loadHistory());
    }
  }, []);

  const update = useCallback((fn: (prev: SearchHistory) => SearchHistory) => {
    setHistory((prev) => {
      const next = fn(prev);
      next.updatedAt = Date.now();
      saveHistory(next);
      return next;
    });
  }, []);

  const trackQuery = useCallback(
    (q: string) => {
      const trimmed = q.trim().toLowerCase();
      if (!trimmed || trimmed.length < 2) return;
      update((h) => ({ ...h, queries: pushUnique(h.queries, trimmed, MAX_ITEMS) }));
    },
    [update],
  );

  const trackDepartment = useCallback(
    (dept: string) => {
      if (!dept) return;
      update((h) => ({ ...h, departments: pushUnique(h.departments, dept, MAX_ITEMS) }));
    },
    [update],
  );

  const trackLocation = useCallback(
    (loc: string) => {
      if (!loc) return;
      update((h) => ({ ...h, locations: pushUnique(h.locations, loc, MAX_ITEMS) }));
    },
    [update],
  );

  const trackJobView = useCallback(
    (jobId: string, tags?: string[], department?: string, location?: string) => {
      update((h) => {
        const next = { ...h, viewedJobIds: pushUnique(h.viewedJobIds, jobId, MAX_VIEWED) };
        if (department) next.departments = pushUnique(next.departments, department, MAX_ITEMS);
        if (location) next.locations = pushUnique(next.locations, location, MAX_ITEMS);
        if (tags && tags.length) {
          let newTags = [...next.tags];
          for (const tag of tags) {
            newTags = pushUnique(newTags, tag, MAX_ITEMS * 2);
          }
          next.tags = newTags;
        }
        return next;
      });
    },
    [update],
  );

  const getInterestSignals = useCallback(() => {
    return {
      departments: history.departments.slice(0, 5),
      locations: history.locations.slice(0, 5),
      tags: history.tags.slice(0, 10),
      queries: history.queries.slice(0, 5),
    };
  }, [history]);

  const clearHistory = useCallback(() => {
    setHistory(EMPTY_HISTORY);
    saveHistory(EMPTY_HISTORY);
  }, []);

  return {
    history,
    trackQuery,
    trackDepartment,
    trackLocation,
    trackJobView,
    getInterestSignals,
    clearHistory,
  };
}
