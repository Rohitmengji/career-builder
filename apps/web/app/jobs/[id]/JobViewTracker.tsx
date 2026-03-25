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
