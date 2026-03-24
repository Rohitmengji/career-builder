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
const password = z.string().min(6).max(128);
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
}).strict();

export const updateApplicationSchema = z.object({
  id: cuid,
  status: z.enum(["applied", "screening", "interview", "offer", "hired", "rejected"]).optional(),
  rating: z.number().int().min(1).max(5).optional(),
  notes: z.string().max(5000).optional(),
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

export const saveTenantSchema = z.object({
  id: tenantId,
  name: z.string().min(1).max(200).optional(),
  theme: z.record(z.string(), z.unknown()).optional(),
  branding: z.record(z.string(), z.unknown()).optional(),
}).passthrough();

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
