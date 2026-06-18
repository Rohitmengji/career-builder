/*
 * PersonalizedSidebar — job detail page sidebar with:
 *   - "Interested?" CTA (sticky, never overflows)
 *   - Personalized related jobs based on user browsing history
 *   - Fallback to server-provided related jobs when no history exists
 *
 * This is a client component island — the parent page stays a server component.
 */

"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import Link from "next/link";
import { useRecentSearches } from "@/lib/jobs/useRecentSearches";
import type { Job } from "@/lib/jobs/types";
import { Card, Skeleton } from "@/components/ui";

interface PersonalizedSidebarProps {
  jobId: string;
  jobTitle: string;
  jobDepartment: string;
  jobLocation: string;
  jobTags: string[];
  /** Server-provided related jobs (fallback) */
  serverRelatedJobs: Job[];
  /** Apply modal component (passed through from server) */
  applyModal: React.ReactNode;
}

export default function PersonalizedSidebar({
  jobId,
  jobDepartment,
  jobLocation,
  jobTags,
  serverRelatedJobs,
  applyModal,
}: PersonalizedSidebarProps) {
  const { history, trackJobView } = useRecentSearches();
  const [personalizedJobs, setPersonalizedJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasPersonalization, setHasPersonalization] = useState(false);
  const fetchedForJobId = useRef<string | null>(null);

  // Stable key for server related jobs (avoid re-fetches on same data)
  const serverRelatedIds = useMemo(
    () => serverRelatedJobs.map((j) => j.id).join(","),
    [serverRelatedJobs],
  );

  // Track this job view on mount
  useEffect(() => {
    trackJobView(jobId, jobTags, jobDepartment, jobLocation);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  // Fetch personalized recommendations based on user history.
  // Uses a ref guard to avoid double-fetching when trackJobView above
  // updates history on the same render cycle.
  useEffect(() => {
    // Need some history to personalize — but skip if history
    // is empty (e.g. on first ever visit before trackJobView runs)
    const hasHistory =
      history.departments.length > 0 ||
      history.queries.length > 0 ||
      history.tags.length > 0;

    if (!hasHistory) {
      setHasPersonalization(false);
      return;
    }

    // Stable key: only re-fetch if the job changed or the top interests shifted
    const historyKey = [
      jobId,
      history.departments.slice(0, 3).join(","),
      history.queries.slice(0, 2).join(","),
    ].join("|");

    if (fetchedForJobId.current === historyKey) return;
    fetchedForJobId.current = historyKey;

    let cancelled = false;

    async function fetchPersonalized() {
      setIsLoading(true);
      try {
        // Build a search using user's top interests
        const topDept = history.departments[0];
        const topQuery = history.queries[0];

        // Try department match first, then keyword search
        const searchParam = topDept
          ? `department=${encodeURIComponent(topDept)}&perPage=6`
          : topQuery
            ? `q=${encodeURIComponent(topQuery)}&perPage=6`
            : `perPage=6`;

        const res = await fetch(`/api/jobs?${searchParam}`);
        if (!res.ok) throw new Error("fetch failed");
        const data = await res.json();

        if (cancelled) return;

        // Filter out the current job + already-shown server related jobs
        const serverIdSet = new Set(serverRelatedIds.split(","));
        const filtered = (data.jobs as Job[]).filter(
          (j) => j.id !== jobId && !serverIdSet.has(j.id),
        );

        if (filtered.length > 0) {
          // Score and sort by relevance to user interests
          const scored = filtered.map((j) => {
            let score = 0;
            if (history.departments.includes(j.department)) score += 3;
            if (history.locations.includes(j.location)) score += 2;
            if (j.tags) {
              for (const tag of j.tags) {
                if (history.tags.includes(tag)) score += 1;
              }
            }
            return { job: j, score };
          });
          scored.sort((a, b) => b.score - a.score);
          setPersonalizedJobs(scored.slice(0, 4).map((s) => s.job));
          setHasPersonalization(true);
        }
      } catch {
        // silently fail — fallback to server related jobs
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchPersonalized();
    return () => {
      cancelled = true;
    };
  }, [jobId, history.departments, history.queries, history.tags, history.locations, serverRelatedIds]);

  const displayRelated = hasPersonalization ? personalizedJobs : serverRelatedJobs;
  const sectionLabel = hasPersonalization ? "Recommended for You" : "Related Positions";

  return (
    <aside className="w-full shrink-0 lg:w-80" aria-label="Apply and related jobs">
      <div className="space-y-6 overscroll-contain pb-4 scrollbar-thin lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
        {/* Apply CTA card */}
        <Card>
          <h2 className="mb-2 text-lg font-semibold text-gray-900">Interested?</h2>
          <p className="mb-4 text-sm text-gray-600">
            Apply now and we&apos;ll get back to you within 5 business days.
          </p>
          {applyModal}
        </Card>

        {/* Related / Personalized jobs */}
        {(displayRelated.length > 0 || isLoading) && (
          <Card aria-labelledby="related-jobs-heading">
            <div className="mb-4 flex items-center gap-2">
              {hasPersonalization && (
                <SparkleIcon className="h-4 w-4 text-blue-600" />
              )}
              <h2
                id="related-jobs-heading"
                className="text-xs font-semibold uppercase tracking-wider text-gray-900"
              >
                {sectionLabel}
              </h2>
            </div>

            {isLoading ? (
              <div className="space-y-4" role="status" aria-live="polite" aria-busy="true">
                <span className="sr-only">Loading recommendations…</span>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-3/4 rounded" />
                    <Skeleton className="h-3 w-1/2 rounded" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-1">
                {displayRelated.map((job) => (
                  <Link
                    key={job.id}
                    href={`/jobs/${job.id}`}
                    className="group -mx-1 block rounded-lg p-3 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                  >
                    <h3 className="line-clamp-1 text-sm font-medium text-gray-900 transition-colors group-hover:text-blue-600">
                      {job.title}
                    </h3>
                    <p className="mt-0.5 text-xs text-gray-600">
                      {job.department} <span aria-hidden="true">·</span> {job.location}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* "Based on" hint */}
        {hasPersonalization && history.departments.length > 0 && (
          <p className="px-2 text-center text-xs text-gray-500">
            Based on your interest in{" "}
            <span className="font-medium text-gray-600">
              {history.departments.slice(0, 2).join(", ")}
            </span>
          </p>
        )}
      </div>
    </aside>
  );
}

function SparkleIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M10 1l2.39 5.85L18 8.5l-4.5 3.75L14.78 18 10 14.75 5.22 18l1.28-5.75L2 8.5l5.61-1.65L10 1z" />
    </svg>
  );
}
