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
    tenantId: row.tenantId,
  };
}

/* ================================================================== */
/*  Database Provider                                                  */
/* ================================================================== */

class DatabaseJobProvider implements JobDataProvider {
  async search(params: JobSearchParams): Promise<JobSearchResponse> {
    const tenantId = params.tenantId || DEFAULT_TENANT_ID;

    const result = await jobRepo.search(
      {
        tenantId,
        q: params.q,
        department: params.department,
        location: params.location,
        employmentType: params.employmentType,
        experienceLevel: params.experienceLevel,
        isRemote: params.isRemote,
        isPublished: true,
      },
      params.page || 1,
      params.perPage || 10,
    );

    const facetsRaw = await jobRepo.getFacets(tenantId);

    const facets: JobFacets = {
      location: facetsRaw.location,
      department: facetsRaw.department,
      employmentType: facetsRaw.employmentType,
      experienceLevel: facetsRaw.experienceLevel,
      isRemote: facetsRaw.isRemote,
    };

    return {
      jobs: result.data.map(dbJobToJob),
      facets,
      pagination: result.pagination,
    };
  }

  async getById(id: string, tenantId?: string): Promise<JobDetailResponse> {
    const job = await jobRepo.findById(id);
    if (!job || (tenantId && job.tenantId !== tenantId)) {
      return { job: null, relatedJobs: [] };
    }

    // Get related jobs from same department or location
    const allJobs = await jobRepo.findByTenant(job.tenantId, false);
    const relatedJobs = allJobs
      .filter(
        (j) =>
          j.id !== id &&
          (j.department === job.department || j.location === job.location),
      )
      .slice(0, 4)
      .map(dbJobToJob);

    return { job: dbJobToJob(job), relatedJobs };
  }

  async apply(application: Omit<JobApplication, "submittedAt">): Promise<ApplyResponse> {
    // Verify job exists
    const job = await jobRepo.findById(application.jobId);
    if (!job) {
      return { success: false, error: "Job not found" };
    }

    try {
      const app = await applicationRepo.create({
        jobId: application.jobId,
        tenantId: application.tenantId || DEFAULT_TENANT_ID,
        firstName: application.firstName,
        lastName: application.lastName,
        email: application.email,
        phone: application.phone,
        resumeUrl: application.resumeUrl,
        coverLetter: application.coverLetter,
        linkedinUrl: application.linkedinUrl,
        source: "direct",
      });

      return { success: true, applicationId: app.id };
    } catch (error) {
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
