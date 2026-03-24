/*
 * useJobSearch — client-side hook for job search with debouncing.
 *
 * Features:
 *   - Debounced search (300ms)
 *   - URL query param sync
 *   - Loading / error states
 *   - Facets for filter UI
 *   - Pagination controls
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { JobSearchResponse, JobSearchParams } from "./types";

const DEBOUNCE_MS = 300;

const EMPTY_RESPONSE: JobSearchResponse = {
  jobs: [],
  facets: { location: [], department: [], employmentType: [], experienceLevel: [], isRemote: [] },
  pagination: { page: 1, perPage: 10, total: 0, totalPages: 0 },
};

export interface UseJobSearchResult {
  /** Current search results */
  data: JobSearchResponse;
  /** Loading state */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Current search params (derived from URL) */
  params: JobSearchParams;
  /** Set a search param (updates URL + triggers fetch) */
  setParam: (key: keyof JobSearchParams, value: string | number | boolean | undefined) => void;
  /** Set search query (debounced) */
  setQuery: (q: string) => void;
  /** Navigate to a specific page */
  setPage: (page: number) => void;
  /** Reset all filters */
  resetFilters: () => void;
  /** Raw query input value (for controlled input) */
  queryInput: string;
}

export function useJobSearch(defaultTenantId?: string): UseJobSearchResult {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Parse current params from URL
  const params: JobSearchParams = {
    q: searchParams.get("q") || undefined,
    location: searchParams.get("location") || undefined,
    department: searchParams.get("department") || undefined,
    employmentType: (searchParams.get("employmentType") as JobSearchParams["employmentType"]) || undefined,
    experienceLevel: (searchParams.get("experienceLevel") as JobSearchParams["experienceLevel"]) || undefined,
    isRemote: searchParams.get("isRemote") === "true" ? true : undefined,
    tenantId: searchParams.get("tenantId") || defaultTenantId || "default",
    page: parseInt(searchParams.get("page") || "1", 10),
    perPage: parseInt(searchParams.get("perPage") || "10", 10),
    sortBy: (searchParams.get("sortBy") as JobSearchParams["sortBy"]) || undefined,
    sortOrder: (searchParams.get("sortOrder") as JobSearchParams["sortOrder"]) || undefined,
  };

  const [data, setData] = useState<JobSearchResponse>(EMPTY_RESPONSE);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [queryInput, setQueryInputState] = useState(params.q || "");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const abortRef = useRef<AbortController>(null);

  // Build URL search params string from JobSearchParams
  const buildQueryString = useCallback((p: JobSearchParams): string => {
    const sp = new URLSearchParams();
    if (p.q) sp.set("q", p.q);
    if (p.location) sp.set("location", p.location);
    if (p.department) sp.set("department", p.department);
    if (p.employmentType) sp.set("employmentType", p.employmentType);
    if (p.experienceLevel) sp.set("experienceLevel", p.experienceLevel);
    if (p.isRemote) sp.set("isRemote", "true");
    if (p.tenantId && p.tenantId !== "default") sp.set("tenantId", p.tenantId);
    if (p.page && p.page > 1) sp.set("page", String(p.page));
    if (p.perPage && p.perPage !== 10) sp.set("perPage", String(p.perPage));
    if (p.sortBy) sp.set("sortBy", p.sortBy);
    if (p.sortOrder) sp.set("sortOrder", p.sortOrder);
    return sp.toString();
  }, []);

  // Fetch jobs from API
  const fetchJobs = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);

    try {
      const apiParams = new URLSearchParams();
      if (params.q) apiParams.set("q", params.q);
      if (params.location) apiParams.set("location", params.location);
      if (params.department) apiParams.set("department", params.department);
      if (params.employmentType) apiParams.set("employmentType", params.employmentType);
      if (params.experienceLevel) apiParams.set("experienceLevel", params.experienceLevel);
      if (params.isRemote) apiParams.set("isRemote", "true");
      if (params.tenantId) apiParams.set("tenantId", params.tenantId);
      if (params.page) apiParams.set("page", String(params.page));
      if (params.perPage) apiParams.set("perPage", String(params.perPage));
      if (params.sortBy) apiParams.set("sortBy", params.sortBy);
      if (params.sortOrder) apiParams.set("sortOrder", params.sortOrder);

      const res = await fetch(`/api/jobs?${apiParams.toString()}`, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json: JobSearchResponse = await res.json();
      setData(json);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Failed to load jobs");
      setData(EMPTY_RESPONSE);
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()]);

  // Fetch on URL change
  useEffect(() => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    fetchJobs(abortRef.current.signal);

    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [fetchJobs]);

  // Update URL params
  const updateUrl = useCallback(
    (newParams: JobSearchParams) => {
      const qs = buildQueryString(newParams);
      router.push(qs ? `?${qs}` : "?", { scroll: false });
    },
    [router, buildQueryString],
  );

  const setParam = useCallback(
    (key: keyof JobSearchParams, value: string | number | boolean | undefined) => {
      const next = { ...params, [key]: value || undefined };
      // Reset to page 1 when filters change (not when page changes)
      if (key !== "page") next.page = 1;
      updateUrl(next);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [params, updateUrl],
  );

  const setQuery = useCallback(
    (q: string) => {
      setQueryInputState(q);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setParam("q", q || undefined);
      }, DEBOUNCE_MS);
    },
    [setParam],
  );

  const setPage = useCallback(
    (page: number) => setParam("page", page),
    [setParam],
  );

  const resetFilters = useCallback(() => {
    setQueryInputState("");
    router.push("?", { scroll: false });
  }, [router]);

  return {
    data,
    isLoading,
    error,
    params,
    setParam,
    setQuery,
    setPage,
    resetFilters,
    queryInput,
  };
}
