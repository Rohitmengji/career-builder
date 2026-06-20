/*
 * Employer Responsiveness — web server-side compose layer (SERVER-ONLY).
 *
 * Fetches the current tenant's application status summary and runs it through the
 * pure responsiveness metric. Per-request memoized so the job-detail page (which
 * may render the badge once) hits the DB at most once. Returns null on any
 * failure — the page simply renders nothing. Never throws.
 */

import { cache } from "react";
import { applicationRepo } from "@career-builder/database";
import {
  computeResponsiveness,
  type ResponsivenessScore,
} from "@career-builder/shared/responsiveness";
import { getWebTenantId } from "@/lib/tenant-runtime";

export const getResponsivenessScore = cache(
  async (): Promise<ResponsivenessScore | null> => {
    try {
      const tenantId = await getWebTenantId();
      const summary = await applicationRepo.findStatusSummary(tenantId);
      return computeResponsiveness(summary, new Date());
    } catch (err) {
      console.error(
        "[responsiveness] failed:",
        err instanceof Error ? err.message : "unknown error",
      );
      return null;
    }
  },
);
