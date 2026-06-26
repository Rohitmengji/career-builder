/*
 * Render-nothing analytics tracker for the job detail page.
 *
 * WHAT: A zero-markup ("return null") client component that fires one job_view
 * event when it mounts.
 * WHY: The job detail page is a Server Component, which can't run client-side
 * effects. Embedding this tiny client child lets us emit the view event without
 * making the whole page client-rendered.
 * HOW: useEffect keyed on jobId fires trackJobView once per mount (one per page
 * load). Keep it markup-free so it never affects layout.
 */
"use client";

import { useEffect } from "react";
import { trackJobView } from "@/lib/analytics";

interface JobViewTrackerProps {
  jobId: string;
}

/**
 * Invisible client component injected into the job detail Server Component.
 * Fires a job_view analytics event once per mount (i.e. per page load).
 */
export default function JobViewTracker({ jobId }: JobViewTrackerProps) {
  useEffect(() => {
    if (jobId) trackJobView(jobId);
  }, [jobId]);

  return null;
}
