/*
 * Salary Truth — web server-side compose layer (SERVER-ONLY).
 *
 * Fetches the deliberate cross-tenant comparable rows (salaryBenchmarkRepo) and
 * runs them through the pure, k-anonymized aggregator (computeSalaryBenchmark)
 * BEFORE anything is rendered. The raw rows never leave this server boundary;
 * only the k-anonymized + rounded aggregate reaches the page.
 *
 * Lives in the web app (not the database package) because it composes both
 * @career-builder/database and @career-builder/shared — keeping the database
 * package free of a shared dependency (package layering).
 */

import { salaryBenchmarkRepo } from "@career-builder/database";
import {
  computeSalaryBenchmark,
  type SalaryBenchmark,
} from "@career-builder/shared/salary-benchmark";
import type { Job } from "@/lib/jobs/types";

/**
 * Compute the market benchmark for a job. Returns a suppressed (available:false)
 * result when there isn't enough k-anonymous data, or null when not applicable
 * (the page simply renders nothing). Never throws.
 *
 * Requires a posted salary: the web Job type only carries currency/period inside
 * the salary object, so without it we can't know which currency market to query
 * — guessing (e.g. USD for a London role) would show the wrong market. The
 * "show the market even when pay is hidden" variant is deferred until currency
 * is exposed for salary-less jobs (ADR-0002).
 */
export async function getSalaryBenchmark(job: Job): Promise<SalaryBenchmark | null> {
  // Need a role family to compare against AND a posted salary (for the currency).
  if (!job.department || !job.experienceLevel) return null;
  if (!job.salary || job.salary.min == null || job.salary.max == null) return null;

  const { min, max, currency, period } = job.salary;

  try {
    const rows = await salaryBenchmarkRepo.findComparable({
      jobId: job.id,
      department: job.department,
      experienceLevel: job.experienceLevel,
      salaryCurrency: currency,
      salaryPeriod: period,
    });

    return computeSalaryBenchmark(
      { salaryMin: min, salaryMax: max, salaryCurrency: currency, salaryPeriod: period },
      rows,
    );
  } catch (err) {
    // Message only — never log the error object/closure (it holds cross-tenant
    // comparable rows that error-tracking SDKs could capture from local scope).
    console.error(
      `[salaryBenchmark] failed for job ${job.id}:`,
      err instanceof Error ? err.message : "unknown error",
    );
    return null;
  }
}
