/*
 * ISR Revalidation Helpers
 *
 * Provides cache invalidation for page and job updates.
 * Uses Next.js revalidatePath() for on-demand ISR.
 *
 * Usage:
 *   After saving a page:   revalidatePageCache(tenantId, slug)
 *   After updating a job:  revalidateJobCache(tenantId, jobId)
 *   After tenant change:   revalidateTenantCache(tenantId)
 */

import { revalidatePath } from "next/cache";

/**
 * Revalidate a specific tenant page after publish.
 */
export function revalidatePageCache(tenantSlug: string, _pageSlug?: string): void {
  try {
    // Revalidate the tenant's main page
    revalidatePath(`/${tenantSlug}`);
    // Revalidate all dynamic routes under this tenant
    revalidatePath(`/${tenantSlug}/[...path]`, "page");
  } catch (error) {
    // revalidatePath can fail if called outside a server action context
    console.warn("[revalidate] Failed to revalidate page cache:", error);
  }
}

/**
 * Revalidate job-related routes after a job is created/updated/deleted.
 */
export function revalidateJobCache(tenantSlug?: string, _jobId?: string): void {
  try {
    // Revalidate the jobs listing page
    revalidatePath("/jobs");

    // Revalidate specific tenant page (which may embed job listings)
    if (tenantSlug) {
      revalidatePath(`/${tenantSlug}`);
    }

    // Revalidate all individual job pages
    revalidatePath("/jobs/[id]", "page");
  } catch (error) {
    console.warn("[revalidate] Failed to revalidate job cache:", error);
  }
}

/**
 * Revalidate all cached data for a tenant (theme, pages, jobs).
 * Use after tenant settings change.
 */
export function revalidateTenantCache(tenantSlug: string): void {
  try {
    revalidatePath(`/${tenantSlug}`);
    revalidatePath("/jobs");
  } catch (error) {
    console.warn("[revalidate] Failed to revalidate tenant cache:", error);
  }
}
