/*
 * Database-backed Job Data Provider.
 *
 * Uses @career-builder/database repositories to serve job data
 * from the Prisma-backed SQLite/PostgreSQL database.
 *
 * Replaces the MockJobProvider for production use.
 */

import type {
  Job,
  JobSearchParams,
  JobSearchResponse,
  JobDetailResponse,
  JobApplication,
  ApplyResponse,
  JobDataProvider,
  JobFacets,
} from "./types";
import { jobRepo, applicationRepo } from "@career-builder/database";
import { parseScreeningQuestions } from "@career-builder/shared/screening";
import { isEnabled } from "@career-builder/shared/feature-flags";
import { rankByRelevance, type RankField } from "@career-builder/shared/search-rank";

const DEFAULT_TENANT_ID = process.env.TENANT_ID || "default";

/* ================================================================== */
/*  Helpers: DB row → frontend Job type                                */
/* ================================================================== */

function safeJsonParse<T>(str: unknown, fallback: T): T {
  if (typeof str !== "string") return fallback;
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}

function dbJobToJob(row: any): Job {
  return {
    id: row.id,
    title: row.title,
    department: row.department,
    location: row.location,
    employmentType: row.employmentType || "full-time",
    experienceLevel: row.experienceLevel || "mid",
    salary:
      row.salaryMin != null && row.salaryMax != null
        ? {
            min: row.salaryMin,
            max: row.salaryMax,
            currency: row.salaryCurrency || "USD",
            period: row.salaryPeriod || "yearly",
          }
        : null,
    description: row.description,
    requirements: safeJsonParse<string[]>(row.requirements, []),
    niceToHave: safeJsonParse<string[]>(row.niceToHave, []),
    benefits: safeJsonParse<string[]>(row.benefits, []),
    postedAt: row.postedAt instanceof Date ? row.postedAt.toISOString() : String(row.postedAt),
    closesAt: row.closesAt instanceof Date ? row.closesAt.toISOString() : row.closesAt || null,
    isRemote: row.isRemote ?? false,
    tags: safeJsonParse<string[]>(row.tags, []),
    screeningQuestions: parseScreeningQuestions(row.screeningQuestions),
    tenantId: row.tenantId,
  };
}

/* ================================================================== */
/*  Database Provider                                                  */
/* ================================================================== */

class DatabaseJobProvider implements JobDataProvider {
  async search(params: JobSearchParams): Promise<JobSearchResponse> {
    const tenantId = params.tenantId || DEFAULT_TENANT_ID;
    const filters = {
      tenantId,
      q: params.q,
      department: params.department,
      location: params.location,
      employmentType: params.employmentType,
      experienceLevel: params.experienceLevel,
      isRemote: params.isRemote,
      isPublished: true,
    };
    // Facets stay tenant-wide (over the full published set), independent of the query —
    // unchanged from the legacy path so the filter UI counts don't shift under search.
    const facetsRaw = await jobRepo.getFacets(tenantId);
    const facets: JobFacets = {
      location: facetsRaw.location,
      department: facetsRaw.department,
      employmentType: facetsRaw.employmentType,
      experienceLevel: facetsRaw.experienceLevel,
      isRemote: facetsRaw.isRemote,
    };

    // Relevance path (ADR-0024): tenant-scoped term prefilter → pure rank → app paginate.
    // Only when there's an actual query AND the flag is on; otherwise the legacy
    // whole-string-LIKE + postedAt path runs exactly as before.
    const hasQuery = Boolean(params.q && params.q.trim());
    if (hasQuery && isEnabled("search_relevance")) {
      const page = Math.max(1, params.page || 1);
      const perPage = Math.min(50, Math.max(1, params.perPage || 10));
      const { data: candidates, total } = await jobRepo.searchAllForRanking(filters);
      const ranked = rankByRelevance(
        candidates,
        params.q!,
        (j): RankField[] => [
          { text: j.title, weight: 5 },
          { text: j.department, weight: 3 },
          { text: j.location, weight: 3 },
          { text: safeJsonParse<string[]>(j.tags, []).join(" "), weight: 2 },
          { text: j.employmentType || "", weight: 2 },
          { text: j.description, weight: 1 },
        ],
        (j) => (j.postedAt instanceof Date ? j.postedAt.getTime() : 0),
      );
      // `total` is the TRUE DB match count (not ranked.length), so pagination matches the
      // legacy path's accuracy; ranking is over the cap-bounded, recency-selected candidates.
      const start = (page - 1) * perPage;
      return {
        jobs: ranked.slice(start, start + perPage).map(dbJobToJob),
        facets,
        pagination: { page, perPage, total, totalPages: Math.max(1, Math.ceil(total / perPage)) },
      };
    }

    const result = await jobRepo.search(filters, params.page || 1, params.perPage || 10);
    return {
      jobs: result.data.map(dbJobToJob),
      facets,
      pagination: result.pagination,
    };
  }

  async getById(id: string, tenantId: string): Promise<JobDetailResponse> {
    // Tenant isolation is MANDATORY here: tenantId is required and the ownership
    // check is unconditional. A job belonging to another tenant is treated as
    // not-found (never returned), so no caller can read across tenants — even if
    // it forgets to pass a host-resolved id.
    const job = await jobRepo.findById(id);
    if (!job || job.tenantId !== tenantId) {
      return { job: null, relatedJobs: [] };
    }

    // Related jobs: same department or location, bounded server-side. findByTenant
    // already filters to the tenant's published jobs; we cap the working set so a
    // tenant with thousands of jobs doesn't load them all to surface four.
    const RELATED_SCAN_CAP = 50;
    const tenantJobs = await jobRepo.findByTenant(job.tenantId, false);
    const relatedJobs = tenantJobs
      .filter(
        (j) =>
          j.id !== id &&
          (j.department === job.department || j.location === job.location),
      )
      .slice(0, RELATED_SCAN_CAP)
      .slice(0, 4)
      .map(dbJobToJob);

    return { job: dbJobToJob(job), relatedJobs };
  }

  async apply(application: Omit<JobApplication, "submittedAt">): Promise<ApplyResponse> {
    const tenantId = application.tenantId || DEFAULT_TENANT_ID;

    // Isolation guard: the job MUST belong to this tenant. assertOwned throws
    // when it doesn't, so a cross-tenant jobId can't create a foreign
    // application (replaces the previous unscoped findById).
    try {
      await jobRepo.assertOwned(application.jobId, tenantId);
    } catch {
      return { success: false, code: "job_not_found", error: "Job not found" };
    }

    // Duplicate prevention — two layers:
    //  1. fast app-level check (covers the common case, returns the existing id)
    //  2. the @@unique([tenantId, jobId, email]) constraint below (P2002) which
    //     ATOMICALLY closes the concurrent-request race the check can't.
    const existing = await applicationRepo.findDuplicate(tenantId, application.jobId, application.email);
    if (existing) {
      return {
        success: false,
        code: "duplicate",
        applicationId: existing.id,
        error: "You have already applied to this position.",
      };
    }

    try {
      const app = await applicationRepo.create({
        jobId: application.jobId,
        tenantId,
        firstName: application.firstName,
        lastName: application.lastName,
        email: application.email,
        phone: application.phone,
        resumeUrl: application.resumeUrl,
        resumePath: application.resumePath,
        resumeText: application.resumeText,
        screeningAnswers: application.screeningAnswers,
        coverLetter: application.coverLetter,
        linkedinUrl: application.linkedinUrl,
        source: "direct",
      });

      return { success: true, applicationId: app.id };
    } catch (error) {
      // P2002 = unique constraint hit by a concurrent duplicate that raced past
      // the check above. Resolve it to the same idempotent "already applied".
      if (error && typeof error === "object" && (error as { code?: string }).code === "P2002") {
        const dup = await applicationRepo.findDuplicate(tenantId, application.jobId, application.email);
        return {
          success: false,
          code: "duplicate",
          applicationId: dup?.id,
          error: "You have already applied to this position.",
        };
      }
      console.error("[DatabaseJobProvider] Apply error:", error);
      return { success: false, error: "Failed to submit application" };
    }
  }
}

/* ================================================================== */
/*  Singleton                                                          */
/* ================================================================== */

let _provider: JobDataProvider | null = null;

/**
 * Get the active job data provider.
 * Now returns DatabaseJobProvider backed by the database.
 */
export function getJobProvider(): JobDataProvider {
  if (!_provider) {
    _provider = new DatabaseJobProvider();
  }
  return _provider;
}

/**
 * Replace the default provider (for testing or runtime config).
 */
export function setJobProvider(provider: JobDataProvider): void {
  _provider = provider;
}
