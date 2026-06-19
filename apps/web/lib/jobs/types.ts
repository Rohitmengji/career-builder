/*
 * Job Data Types — the frontend (view-model) contract for the job system.
 *
 * The canonical domain enums live in @career-builder/database/types (one
 * source of truth shared with the DB/API layers). This file owns only the
 * *view* shapes the web app renders — e.g. a nested `salary` object and ISO
 * string dates — which deliberately differ from the flat DB record.
 *
 * Re-exports are type-only, so no Prisma client is pulled into the web bundle.
 *
 * Designed for ATS integration (Greenhouse / Lever / Employ style).
 */

/* ================================================================== */
/*  Core Job Types                                                     */
/* ================================================================== */

// Canonical enums — re-exported from the database layer so web, API, and DB
// all share identical string unions (no drift between layers).
export type { EmploymentType, ExperienceLevel } from "@career-builder/database/types";
import type { EmploymentType, ExperienceLevel } from "@career-builder/database/types";

export interface JobSalary {
  min: number;
  max: number;
  currency: string;
  period: "yearly" | "monthly" | "hourly";
}

export interface Job {
  id: string;
  title: string;
  department: string;
  location: string;
  employmentType: EmploymentType;
  experienceLevel: ExperienceLevel;
  salary: JobSalary | null;
  description: string;
  requirements: string[];
  niceToHave: string[];
  benefits: string[];
  postedAt: string;          // ISO 8601
  closesAt: string | null;   // ISO 8601 or null if open
  isRemote: boolean;
  tags: string[];
  /** Tenant this job belongs to */
  tenantId: string;
}

/* ================================================================== */
/*  Query / Filter Types                                               */
/* ================================================================== */

export interface JobSearchParams {
  /** Free-text search (title, description, tags) */
  q?: string;
  /** Filter by location (exact or partial match) */
  location?: string;
  /** Filter by department */
  department?: string;
  /** Filter by employment type */
  employmentType?: EmploymentType;
  /** Filter by experience level */
  experienceLevel?: ExperienceLevel;
  /** Filter by remote-only */
  isRemote?: boolean;
  /** Tenant ID */
  tenantId?: string;
  /** Pagination — 1-indexed */
  page?: number;
  /** Results per page (default 10, max 50) */
  perPage?: number;
  /** Sort field */
  sortBy?: "postedAt" | "title" | "department";
  /** Sort direction */
  sortOrder?: "asc" | "desc";
}

/* ================================================================== */
/*  Facet Types                                                        */
/* ================================================================== */

export interface FacetBucket {
  value: string;
  count: number;
}

export interface JobFacets {
  location: FacetBucket[];
  department: FacetBucket[];
  employmentType: FacetBucket[];
  experienceLevel: FacetBucket[];
  isRemote: FacetBucket[];
}

/* ================================================================== */
/*  API Response Types                                                 */
/* ================================================================== */

export interface JobSearchResponse {
  jobs: Job[];
  facets: JobFacets;
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

export interface JobDetailResponse {
  job: Job | null;
  relatedJobs: Job[];
}

/* ================================================================== */
/*  Apply Types                                                        */
/* ================================================================== */

export interface JobApplication {
  jobId: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  resumeUrl: string;
  coverLetter: string;
  linkedinUrl: string;
  submittedAt: string;
}

export interface ApplyResponse {
  success: boolean;
  applicationId?: string;
  error?: string;
  /** Machine-readable reason the route maps to an HTTP status (404/409). */
  code?: "duplicate" | "job_not_found";
  /** True when this application already existed (idempotent / dedup). */
  duplicate?: boolean;
}

/* ================================================================== */
/*  Provider Interface (for swappable backends)                        */
/* ================================================================== */

export interface JobDataProvider {
  search(params: JobSearchParams): Promise<JobSearchResponse>;
  getById(id: string, tenantId?: string): Promise<JobDetailResponse>;
  apply(application: Omit<JobApplication, "submittedAt">): Promise<ApplyResponse>;
}
