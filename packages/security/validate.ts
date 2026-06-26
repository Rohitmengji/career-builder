/*
 * @career-builder/security — Zod Validation Schemas
 *
 * Centralized input validation for all API endpoints.
 * Every schema is strict — unknown keys are stripped.
 *
 * Usage:
 *   const data = loginSchema.parse(body);        // throws on invalid
 *   const result = loginSchema.safeParse(body);   // returns { success, data?, error? }
 */

import { z } from "zod";

/* ================================================================== */
/*  Shared primitives                                                  */
/* ================================================================== */

const email = z.string().email().max(254).transform((v) => v.trim().toLowerCase());
// Min 8 per OWASP for NEW credentials. (The login schema intentionally uses its
// own min(1) so existing/shorter passwords can still authenticate.)
const password = z.string().min(8).max(128);
const name = z.string().min(1).max(200).transform((v) => v.trim());
const slug = z.string().regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and hyphens").min(1).max(100);
const tenantId = z.string().regex(/^[a-z0-9-]+$/).min(1).max(50);
const cuid = z.string().min(1).max(50);
const safeString = z.string().max(5000).transform((v) => v.trim());
const richText = z.string().max(50000).transform((v) => v.trim());
const hexColor = z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, "Invalid hex color");

/* ================================================================== */
/*  Auth schemas                                                       */
/* ================================================================== */

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(128),
}).strict();

export const createUserSchema = z.object({
  email,
  name,
  password,
  role: z.enum(["super_admin", "admin", "hiring_manager", "recruiter", "viewer"]),
}).strict();

export const updateUserSchema = z.object({
  id: cuid,
  name: name.optional(),
  role: z.enum(["super_admin", "admin", "hiring_manager", "recruiter", "viewer"]).optional(),
  password: password.optional(),
  department: z.string().max(100).optional(),
}).strict();

/* ================================================================== */
/*  Job schemas                                                        */
/* ================================================================== */

export const createJobSchema = z.object({
  title: z.string().min(1).max(200).transform((v) => v.trim()),
  slug: slug.optional(),
  department: z.string().min(1).max(100).transform((v) => v.trim()),
  location: z.string().min(1).max(200).transform((v) => v.trim()),
  description: richText,
  employmentType: z.enum(["full-time", "part-time", "contract", "internship"]).default("full-time"),
  experienceLevel: z.enum(["entry", "mid", "senior", "lead", "executive"]).default("mid"),
  salaryMin: z.number().int().min(0).max(10_000_000).optional(),
  salaryMax: z.number().int().min(0).max(10_000_000).optional(),
  salaryCurrency: z.string().length(3).default("USD"),
  salaryPeriod: z.enum(["yearly", "monthly", "hourly"]).default("yearly"),
  requirements: z.array(z.string().max(500)).max(50).default([]),
  niceToHave: z.array(z.string().max(500)).max(50).default([]),
  benefits: z.array(z.string().max(500)).max(50).default([]),
  tags: z.array(z.string().max(50)).max(20).default([]),
  screeningQuestions: z
    .array(
      z.object({
        q: z.string().min(1).max(300).transform((v) => v.trim()),
        requiredAnswer: z.enum(["yes", "no"]).default("yes"),
      }).strict(),
    )
    .max(15)
    .default([]),
  scorecardCriteria: z.array(z.string().min(1).max(120).transform((v) => v.trim())).max(12).default([]),
  isRemote: z.boolean().default(false),
  isPublished: z.boolean().default(false),
}).strict().refine(
  (data) => !data.salaryMin || !data.salaryMax || data.salaryMin <= data.salaryMax,
  { message: "salaryMin must be <= salaryMax" },
);

export const updateJobSchema = z.object({
  id: cuid,
  title: z.string().min(1).max(200).transform((v) => v.trim()).optional(),
  slug: slug.optional(),
  department: z.string().min(1).max(100).optional(),
  location: z.string().min(1).max(200).optional(),
  description: richText.optional(),
  employmentType: z.enum(["full-time", "part-time", "contract", "internship"]).optional(),
  experienceLevel: z.enum(["entry", "mid", "senior", "lead", "executive"]).optional(),
  salaryMin: z.number().int().min(0).max(10_000_000).optional().nullable(),
  salaryMax: z.number().int().min(0).max(10_000_000).optional().nullable(),
  salaryCurrency: z.string().length(3).optional(),
  salaryPeriod: z.enum(["yearly", "monthly", "hourly"]).optional(),
  requirements: z.array(z.string().max(500)).max(50).optional(),
  niceToHave: z.array(z.string().max(500)).max(50).optional(),
  benefits: z.array(z.string().max(500)).max(50).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  screeningQuestions: z
    .array(
      z.object({
        q: z.string().min(1).max(300).transform((v) => v.trim()),
        requiredAnswer: z.enum(["yes", "no"]).default("yes"),
      }).strict(),
    )
    .max(15)
    .optional(),
  scorecardCriteria: z.array(z.string().min(1).max(120).transform((v) => v.trim())).max(12).optional(),
  isRemote: z.boolean().optional(),
  isPublished: z.boolean().optional(),
}).strict();

export const jobActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("publish"), id: cuid }).strict(),
  z.object({ action: z.literal("unpublish"), id: cuid }).strict(),
  z.object({ action: z.literal("reorder"), orderedIds: z.array(cuid).min(1).max(1000) }).strict(),
]);

/* ================================================================== */
/*  Application schemas                                                */
/* ================================================================== */

export const createApplicationSchema = z.object({
  jobId: cuid,
  tenantId: tenantId.optional().default("default"),
  firstName: z.string().min(1).max(100).transform((v) => v.trim()),
  lastName: z.string().min(1).max(100).transform((v) => v.trim()),
  email,
  phone: z.string().max(30).transform((v) => v.trim()).optional().default(""),
  resumeUrl: z.string().url().max(2048).optional().or(z.literal("")),
  coverLetter: z.string().max(10000).transform((v) => v.trim()).optional().default(""),
  linkedinUrl: z.string().url().max(500).optional().or(z.literal("")),
  // Screening answers arrive as a JSON string in the (multipart) form; parsed +
  // validated against the job's questions by the apply route.
  screeningAnswers: z.string().max(4000).optional(),
}).strict();

export const updateApplicationSchema = z.object({
  id: cuid,
  status: z.enum(["applied", "screening", "interview", "offer", "hired", "rejected"]).optional(),
  // Custom pipeline stage assignment (ADR-0015) — validated against the tenant's
  // stages in-route; derives a canonical `status` via shared/pipeline.statusForStage.
  stageId: cuid.optional(),
  rating: z.number().int().min(1).max(5).optional(),
  notes: z.string().max(5000).optional(),
  // Structured rejection reason (ADR-0010) — recorded when status → rejected.
  adverseAction: z.object({
    category: z.enum(["screening_failed", "experience_gap", "role_filled", "stronger_candidates", "not_responsive", "other"]),
    freeText: z.string().max(5000).transform((v) => v.trim()).optional(),
    sharedWithCandidate: z.boolean().optional().default(false),
    candidateMessage: z.string().max(2000).transform((v) => v.trim()).optional(),
  }).strict().optional(),
}).strict();

/** Internal comment on an application (mentions are parsed from the body server-side). */
export const createCommentSchema = z.object({
  body: z.string().min(1).max(5000).transform((v) => v.trim()),
}).strict();

/* ================================================================== */
/*  Interview schemas (ADR-0006)                                       */
/* ================================================================== */

export const createInterviewSchema = z.object({
  applicationId: cuid,
  scheduledAt: z.string().datetime(), // ISO-8601 UTC instant
  durationMins: z.number().int().min(5).max(480).default(45),
  type: z.enum(["phone", "video", "onsite"]).default("video"),
  round: z.number().int().min(1).max(20).default(1),
  interviewerId: cuid.optional(),
  timezone: z.string().max(64).default("UTC"),
  location: z.string().max(300).optional(),
  meetingUrl: z.string().url().max(2048).optional().or(z.literal("")),
  notes: z.string().max(2000).optional(),
}).strict();

export const updateInterviewSchema = z.object({
  id: cuid,
  action: z.enum(["cancel", "complete", "no_show"]),
}).strict();

/* ================================================================== */
/*  Scorecard schema (ADR-0007)                                        */
/* ================================================================== */

export const submitScorecardSchema = z.object({
  applicationId: cuid,
  interviewId: cuid.optional(),
  recommendation: z.enum(["strong_yes", "yes", "no", "strong_no"]),
  overallNotes: z.string().max(5000).transform((v) => v.trim()).optional(),
  ratings: z
    .array(
      z.object({
        criterion: z.string().min(1).max(120).transform((v) => v.trim()),
        score: z.number().int().min(1).max(5),
        comment: z.string().max(1000).transform((v) => v.trim()).optional(),
      }).strict(),
    )
    .max(12)
    .default([]),
}).strict();

/* ================================================================== */
/*  Offer schemas (ADR-0008)                                           */
/* ================================================================== */

export const createOfferSchema = z.object({
  applicationId: cuid,
  salaryAmount: z.number().int().positive().max(100_000_000).optional(),
  salaryCurrency: z.string().regex(/^[A-Z]{3}$/).default("USD"),
  salaryPeriod: z.enum(["yearly", "monthly", "hourly"]).default("yearly"),
  startDate: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
  terms: z.string().max(10_000).transform((v) => v.trim()).optional(),
  notes: z.string().max(5000).transform((v) => v.trim()).optional(),
}).strict();

/** Admin offer lifecycle action (recruiter+, with approve/rescind/request_changes gated stricter in the route). */
export const updateOfferSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("submit_for_approval"), id: cuid }).strict(),
  z.object({ action: z.literal("approve"), id: cuid }).strict(),
  z.object({ action: z.literal("request_changes"), id: cuid }).strict(),
  z.object({ action: z.literal("send"), id: cuid }).strict(),
  z.object({ action: z.literal("accept"), id: cuid }).strict(),
  z.object({ action: z.literal("decline"), id: cuid }).strict(),
  z.object({ action: z.literal("rescind"), id: cuid }).strict(),
]);

/* ================================================================== */
/*  EEO voluntary self-ID (ADR-0013) — closed vocab incl. decline_to_state */
/* ================================================================== */

export const eeoSelfIdSchema = z.object({
  applicationId: cuid,
  gender: z.enum(["female", "male", "nonbinary", "other", "decline_to_state"]).optional(),
  race: z.enum(["american_indian", "asian", "black", "hispanic", "native_hawaiian", "white", "two_or_more", "other", "decline_to_state"]).optional(),
  ethnicity: z.enum(["hispanic_latino", "not_hispanic_latino", "decline_to_state"]).optional(),
  veteranStatus: z.enum(["veteran", "not_veteran", "decline_to_state"]).optional(),
  disability: z.enum(["yes", "no", "decline_to_state"]).optional(),
}).strict();

/** Candidate-side accept/decline on their own offer. */
export const offerDecisionSchema = z.object({
  action: z.enum(["accept", "decline"]),
  note: z.string().max(1000).transform((v) => v.trim()).optional(),
}).strict();

/** Bulk action over a bounded set of applications (status change / reject / export). */
export const bulkApplicationActionSchema = z.object({
  ids: z.array(cuid).min(1).max(100),
  action: z.enum(["status", "reject", "export"]),
  status: z.enum(["applied", "screening", "interview", "offer", "hired", "rejected"]).optional(),
  message: z.string().max(2000).transform((v) => v.trim()).optional(),
}).strict();

/* ================================================================== */
/*  Page schemas                                                       */
/* ================================================================== */

export const savePageSchema = z.object({
  slug: slug,
  blocks: z.array(z.record(z.string(), z.unknown())).max(500),
});

/* ================================================================== */
/*  Tenant schemas                                                     */
/* ================================================================== */

// Declares every field a caller legitimately sends (the full TenantConfig plus
// the optional `colors` map the route reads). Unknown keys are STRIPPED (Zod
// default) instead of passed through, so arbitrary client fields can no longer
// ride into mergeTenantConfig / persistence.
export const saveTenantSchema = z.object({
  id: tenantId,
  name: z.string().min(1).max(200).optional(),
  theme: z.record(z.string(), z.unknown()).optional(),
  branding: z.record(z.string(), z.unknown()).optional(),
  colors: z.record(z.string(), z.string()).optional(),
  createdAt: z.string().max(40).optional(),
  updatedAt: z.string().max(40).optional(),
});

/* ================================================================== */
/*  Query parameter schemas                                            */
/* ================================================================== */

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});

export const jobSearchSchema = z.object({
  q: z.string().max(200).optional(),
  location: z.string().max(200).optional(),
  department: z.string().max(100).optional(),
  employmentType: z.enum(["full-time", "part-time", "contract", "internship"]).optional(),
  experienceLevel: z.enum(["entry", "mid", "senior", "lead", "executive"]).optional(),
  isRemote: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
  tenantId: tenantId.optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  perPage: z.coerce.number().int().min(1).max(50).default(10),
  sortBy: z.enum(["postedAt", "title", "department"]).default("postedAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

/* ================================================================== */
/*  Application tags + saved views (ADR-0016, B2b)                      */
/* ================================================================== */

// Closed tag-colour palette. MUST stay in sync with shared/tags.TAG_COLORS
// (inlined here because @career-builder/security does not depend on /shared).
const tagColor = z.enum([
  "gray", "red", "orange", "amber", "green", "teal", "blue", "indigo", "purple", "pink",
]);
const tagLabel = z.string().min(1).max(40).transform((v) => v.replace(/\s+/g, " ").trim());

export const createTagSchema = z.object({
  label: tagLabel,
  color: tagColor.optional(),
}).strict();

export const updateTagSchema = z.object({
  id: cuid,
  label: tagLabel.optional(),
  color: tagColor.optional(),
}).strict().refine((d) => d.label !== undefined || d.color !== undefined, {
  message: "Provide at least one of label or color",
});

export const deleteTagSchema = z.object({ id: cuid }).strict();

/** Add or remove a single tag on an application (the [id]/tags route). */
export const applicationTagMutationSchema = z.object({ tagId: cuid }).strict();

// A saved view's persisted filters — whitelisted keys only. MUST stay in sync
// with shared/saved-view.SAVED_VIEW_FILTER_KEYS.
const savedViewFilters = z.object({
  status: z.string().max(40).optional(),
  jobId: z.string().max(50).optional(),
  department: z.string().max(100).optional(),
  q: z.string().max(200).optional(),
  tags: z.array(cuid).max(50).optional(),
}).strict();

export const createSavedViewSchema = z.object({
  name: z.string().min(1).max(60).transform((v) => v.trim()),
  filters: savedViewFilters,
}).strict();

export const deleteSavedViewSchema = z.object({ id: cuid }).strict();

/* ================================================================== */
/*  Talent pool / CRM (ADR-0018, B3)                                    */
/* ================================================================== */

export const createTalentPoolSchema = z.object({
  name: z.string().min(1).max(80).transform((v) => v.trim()),
  description: z.string().max(500).transform((v) => v.trim()).optional(),
}).strict();

export const updateTalentPoolSchema = z.object({
  id: cuid,
  name: z.string().min(1).max(80).transform((v) => v.trim()).optional(),
  description: z.string().max(500).transform((v) => v.trim()).optional(),
}).strict().refine((d) => d.name !== undefined || d.description !== undefined, {
  message: "Provide at least one of name or description",
});

export const deleteTalentPoolSchema = z.object({ id: cuid }).strict();

// Add a candidate to a pool BY APPLICATION — the route resolves the email from the
// tenant-scoped application (never trusts a client-supplied email).
export const addPoolMemberSchema = z.object({
  applicationId: cuid,
  note: z.string().max(500).transform((v) => v.trim()).optional(),
}).strict();

export const removePoolMemberSchema = z.object({ email }).strict();

// Consent-gated re-engagement broadcast to a pool.
export const reengagePoolSchema = z.object({
  subject: z.string().min(1).max(200).transform((v) => v.trim()),
  message: z.string().min(1).max(5000).transform((v) => v.trim()),
}).strict();

/* ================================================================== */
/*  Requisition approval (ADR-0020, B6a)                                */
/* ================================================================== */

export const createRequisitionSchema = z.object({
  jobId: cuid.optional(),
  title: z.string().min(1).max(200).transform((v) => v.trim()),
  department: z.string().max(100).transform((v) => v.trim()).optional(),
  headcount: z.number().int().min(1).max(1000).optional(),
  justification: z.string().max(2000).transform((v) => v.trim()).optional(),
}).strict();

export const updateRequisitionSchema = z.object({
  id: cuid,
  title: z.string().min(1).max(200).transform((v) => v.trim()).optional(),
  department: z.string().max(100).transform((v) => v.trim()).optional(),
  headcount: z.number().int().min(1).max(1000).optional(),
  justification: z.string().max(2000).transform((v) => v.trim()).optional(),
}).strict().refine(
  (d) => d.title !== undefined || d.department !== undefined || d.headcount !== undefined || d.justification !== undefined,
  { message: "Provide at least one field to update" },
);

// Drive the state machine: submit (recruiter+) / approve | reject (manager+) / reopen.
export const requisitionActionSchema = z.object({
  id: cuid,
  action: z.enum(["submit", "approve", "reject", "reopen"]),
  decisionNote: z.string().max(2000).transform((v) => v.trim()).optional(),
}).strict();

export const deleteRequisitionSchema = z.object({ id: cuid }).strict();

/* ================================================================== */
/*  Hiring teams (ADR-0020, B6b)                                        */
/* ================================================================== */

export const addTeamMemberSchema = z.object({
  userId: cuid,
  role: z.enum(["lead", "member"]).optional(),
}).strict();

export const removeTeamMemberSchema = z.object({ userId: cuid }).strict();

/* ================================================================== */
/*  Helpers                                                            */
/* ================================================================== */

/** Parse and return validation errors as a flat error string. */
export function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((e) => `${e.path.join(".")}: ${e.message}`)
    .join("; ");
}

/** Safe parse that returns a discriminated union result with formatted error. */
export function safeParse<T>(schema: z.ZodSchema<T>, input: unknown):
  | { success: true; data: T; error?: undefined }
  | { success: false; data?: undefined; error: string } {
  const result = schema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: formatZodError(result.error!) };
}
