/*
 * Shared domain types for the Career Builder platform.
 *
 * These types are the canonical contract between the database layer,
 * API routes, and frontend components. They intentionally mirror
 * the Prisma schema but remain framework-agnostic.
 */

/* ================================================================== */
/*  Enums (string unions for JSON/SQLite compatibility)                */
/* ================================================================== */

export type UserRole = "super_admin" | "admin" | "hiring_manager" | "recruiter" | "viewer";
export const USER_ROLES: UserRole[] = ["super_admin", "admin", "hiring_manager", "recruiter", "viewer"];

export type EmploymentType = "full-time" | "part-time" | "contract" | "internship";
export const EMPLOYMENT_TYPES: EmploymentType[] = ["full-time", "part-time", "contract", "internship"];

export type ExperienceLevel = "entry" | "mid" | "senior" | "lead" | "executive";
export const EXPERIENCE_LEVELS: ExperienceLevel[] = ["entry", "mid", "senior", "lead", "executive"];

export type ApplicationStatus = "applied" | "screening" | "interview" | "offer" | "hired" | "rejected";
export const APPLICATION_STATUSES: ApplicationStatus[] = ["applied", "screening", "interview", "offer", "hired", "rejected"];

export type AnalyticsEventType = "job_view" | "apply_click" | "application_submit" | "search" | "page_view";
export const ANALYTICS_EVENT_TYPES: AnalyticsEventType[] = ["job_view", "apply_click", "application_submit", "search", "page_view"];

export type AuditAction =
  | "login" | "logout"
  | "create_job" | "update_job" | "delete_job" | "publish_job" | "unpublish_job"
  | "create_application" | "update_application"
  | "create_page" | "update_page" | "delete_page" | "page_restore"
  | "create_user" | "update_user" | "delete_user"
  | "update_tenant";

export type TenantPlan = "free" | "pro" | "enterprise";

/* ================================================================== */
/*  Domain types                                                       */
/* ================================================================== */

export interface TenantRecord {
  id: string;
  name: string;
  domain: string | null;
  theme: Record<string, unknown>;
  branding: Record<string, unknown>;
  settings: Record<string, unknown>;
  plan: TenantPlan;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: UserRole;
  department: string | null;
  isActive: boolean;
  lastLoginAt: Date | null;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

/** UserRecord without the password hash — safe for API responses */
export type SafeUser = Omit<UserRecord, "passwordHash">;

export interface JobRecord {
  id: string;
  title: string;
  slug: string;
  department: string;
  location: string;
  description: string;
  employmentType: EmploymentType;
  experienceLevel: ExperienceLevel;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
  salaryPeriod: string;
  requirements: string[];
  niceToHave: string[];
  benefits: string[];
  tags: string[];
  isRemote: boolean;
  isPublished: boolean;
  sortOrder: number;
  postedAt: Date;
  closesAt: Date | null;
  externalId: string | null;
  externalSource: string | null;
  externalUrl: string | null;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApplicationRecord {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  resumeUrl: string | null;
  resumePath: string | null;
  coverLetter: string | null;
  linkedinUrl: string | null;
  status: ApplicationStatus;
  rating: number | null;
  notes: string | null;
  source: string | null;
  jobId: string;
  tenantId: string;
  externalId: string | null;
  submittedAt: Date;
  updatedAt: Date;
}

export interface PageRecord {
  id: string;
  slug: string;
  title: string;
  blocks: unknown[];
  isPublished: boolean;
  sortOrder: number;
  version: number;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PageVersionRecord {
  id: string;
  version: number;
  blocks: string;
  title: string;
  savedBy: string | null;
  savedByEmail: string | null;
  pageId: string;
  tenantId: string;
  createdAt: Date;
}

export interface AuditLogRecord {
  id: string;
  action: AuditAction;
  entity: string | null;
  entityId: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  userId: string | null;
  tenantId: string;
  createdAt: Date;
}

export interface AnalyticsEventRecord {
  id: string;
  type: AnalyticsEventType;
  jobId: string | null;
  pageSlug: string | null;
  metadata: Record<string, unknown> | null;
  sessionId: string | null;
  tenantId: string;
  createdAt: Date;
}

export interface WebhookRecord {
  id: string;
  url: string;
  events: string[];
  secret: string | null;
  isActive: boolean;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

/* ================================================================== */
/*  Input types (for create/update operations)                         */
/* ================================================================== */

export interface CreateJobInput {
  title: string;
  department: string;
  location: string;
  description: string;
  employmentType?: EmploymentType;
  experienceLevel?: ExperienceLevel;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  salaryPeriod?: string;
  requirements?: string[];
  niceToHave?: string[];
  benefits?: string[];
  tags?: string[];
  isRemote?: boolean;
  isPublished?: boolean;
  sortOrder?: number;
  closesAt?: Date;
  externalId?: string;
  externalSource?: string;
  externalUrl?: string;
}

export interface UpdateJobInput extends Partial<CreateJobInput> {
  slug?: string;
}

export interface CreateApplicationInput {
  jobId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  resumeUrl?: string;
  resumePath?: string;
  coverLetter?: string;
  linkedinUrl?: string;
  source?: string;
}

export interface UpdateApplicationInput {
  status?: ApplicationStatus;
  rating?: number;
  notes?: string;
}

export interface CreatePageInput {
  slug: string;
  title?: string;
  blocks?: unknown[];
  isPublished?: boolean;
  sortOrder?: number;
}

export interface UpdatePageInput {
  title?: string;
  blocks?: unknown[];
  isPublished?: boolean;
  sortOrder?: number;
}

export interface CreateUserInput {
  email: string;
  name: string;
  passwordHash: string;
  role?: UserRole;
  department?: string;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  role?: UserRole;
  department?: string;
  isActive?: boolean;
  passwordHash?: string;
  lastLoginAt?: Date;
}

export interface CreateWebhookInput {
  url: string;
  events: string[];
  secret?: string;
}

/* ================================================================== */
/*  Query types                                                        */
/* ================================================================== */

export interface PaginationParams {
  page?: number;
  perPage?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

export interface JobFilters extends PaginationParams {
  q?: string;
  department?: string;
  location?: string;
  employmentType?: EmploymentType;
  experienceLevel?: ExperienceLevel;
  isRemote?: boolean;
  isPublished?: boolean;
  sortBy?: "postedAt" | "title" | "department" | "sortOrder";
  sortOrder?: "asc" | "desc";
}

export interface ApplicationFilters extends PaginationParams {
  jobId?: string;
  status?: ApplicationStatus;
  email?: string;
  sortBy?: "submittedAt" | "status" | "rating";
  sortOrder?: "asc" | "desc";
}

export interface AuditFilters extends PaginationParams {
  action?: AuditAction;
  userId?: string;
  entity?: string;
  entityId?: string;
}

export interface AnalyticsFilters {
  type?: AnalyticsEventType;
  jobId?: string;
  startDate?: Date;
  endDate?: Date;
}
