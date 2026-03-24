/*
 * Job Data Types — strict contract for the entire job system.
 *
 * These types are the single source of truth. Every layer —
 * data providers, API routes, frontend components — uses them.
 *
 * Designed for ATS integration (Greenhouse / Lever / Employ style).
 */

/* ================================================================== */
/*  Core Job Types                                                     */
/* ================================================================== */

export type EmploymentType = "full-time" | "part-time" | "contract" | "internship";

export type ExperienceLevel = "entry" | "mid" | "senior" | "lead" | "executive";

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
}

/* ================================================================== */
/*  Provider Interface (for swappable backends)                        */
/* ================================================================== */

export interface JobDataProvider {
  search(params: JobSearchParams): Promise<JobSearchResponse>;
  getById(id: string, tenantId?: string): Promise<JobDetailResponse>;
  apply(application: Omit<JobApplication, "submittedAt">): Promise<ApplyResponse>;
}
