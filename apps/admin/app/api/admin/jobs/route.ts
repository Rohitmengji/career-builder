/*
 * Admin Jobs API — CRUD for job management.
 *
 * GET    /api/admin/jobs             — list all jobs (including unpublished)
 * POST   /api/admin/jobs             — create a new job
 * PUT    /api/admin/jobs             — update a job
 * DELETE /api/admin/jobs?id=<jobId>  — delete a job
 * PATCH  /api/admin/jobs             — publish/unpublish/reorder
 */

import { NextResponse } from "next/server";
import { getSession, getSessionReadOnly, validateCsrf, writeAuditLog } from "@/lib/auth";
import { jobRepo } from "@career-builder/database";
import {
  createJobSchema,
  updateJobSchema,
  jobActionSchema,
  safeParse,
} from "@career-builder/security/validate";
import { sanitizeString, sanitizeSlug, stripHtml } from "@career-builder/security/sanitize";
import { getRateLimiter, getClientIp } from "@career-builder/security/rate-limit";
import { withRequestLogging } from "@career-builder/observability/request-logger";
import { logger } from "@career-builder/observability/logger";

const log = logger.api;

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** GET /api/admin/jobs — list all jobs for the tenant */
export async function GET(req: Request) {
  const session = await getSessionReadOnly();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const jobs = await jobRepo.findByTenant(session.tenantId, true);
  return NextResponse.json({ jobs });
}

/** POST /api/admin/jobs — create a new job */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!["super_admin", "admin", "hiring_manager"].includes(session.role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const csrfValid = await validateCsrf(req);
  if (!csrfValid) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  // Rate limit
  const limiter = getRateLimiter("api");
  const ip = getClientIp(req) || "unknown";
  const rl = limiter.check(`job-create:${ip}`);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = await req.json();

  // Validate with Zod schema
  const parsed = safeParse(createJobSchema, body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const data = parsed.data;
  const slug = data.slug ? sanitizeSlug(data.slug) : slugify(data.title);

  try {
    const job = await jobRepo.create({
      title: sanitizeString(data.title, 200),
      slug,
      department: sanitizeString(data.department, 100),
      location: sanitizeString(data.location, 200),
      description: stripHtml(data.description),
      employmentType: data.employmentType || "full-time",
      experienceLevel: data.experienceLevel || "mid",
      salaryMin: data.salaryMin,
      salaryMax: data.salaryMax,
      salaryCurrency: data.salaryCurrency || "USD",
      salaryPeriod: data.salaryPeriod || "yearly",
      requirements: (data.requirements || []).map((r: string) => sanitizeString(r, 500)),
      niceToHave: (data.niceToHave || []).map((r: string) => sanitizeString(r, 500)),
      benefits: (data.benefits || []).map((r: string) => sanitizeString(r, 500)),
      tags: (data.tags || []).map((t: string) => sanitizeString(t, 50)),
      isRemote: data.isRemote || false,
      isPublished: data.isPublished || false,
      tenantId: session.tenantId,
    });

    await writeAuditLog(session.userId, session.email, "job_create", `${job.title} (${job.id})`);
    return NextResponse.json({ job });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create job";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/** PUT /api/admin/jobs — update a job */
export async function PUT(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!["super_admin", "admin", "hiring_manager"].includes(session.role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const csrfValid = await validateCsrf(req);
  if (!csrfValid) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  const body = await req.json();

  // Validate with Zod schema
  const parsed = safeParse(updateJobSchema, body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { id, ...data } = parsed.data;

  // Verify job belongs to tenant
  const existing = await jobRepo.findById(id);
  if (!existing || existing.tenantId !== session.tenantId) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Sanitize mutable string fields
  const sanitized: Record<string, unknown> = { ...data };
  if (data.title) sanitized.title = sanitizeString(data.title, 200);
  if (data.description) sanitized.description = stripHtml(data.description);
  if (data.department) sanitized.department = sanitizeString(data.department, 100);
  if (data.location) sanitized.location = sanitizeString(data.location, 200);

  try {
    const job = await jobRepo.update(id, sanitized);
    await writeAuditLog(session.userId, session.email, "job_update", `${job.title} (${job.id})`);
    return NextResponse.json({ job });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update job";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/** DELETE /api/admin/jobs?id=<jobId> */
export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role !== "admin" && session.role !== "super_admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const csrfValid = await validateCsrf(req);
  if (!csrfValid) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Job ID is required" }, { status: 400 });
  }

  // Verify job belongs to tenant
  const existing = await jobRepo.findById(id);
  if (!existing || existing.tenantId !== session.tenantId) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  await jobRepo.delete(id);
  await writeAuditLog(session.userId, session.email, "job_delete", `${existing.title} (${id})`);

  return NextResponse.json({ success: true });
}

/** PATCH /api/admin/jobs — publish/unpublish/reorder */
export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!["super_admin", "admin", "hiring_manager"].includes(session.role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const csrfValid = await validateCsrf(req);
  if (!csrfValid) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  const body = await req.json();

  // Validate with Zod schema
  const parsed = safeParse(jobActionSchema, body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { action } = parsed.data;

  if (action === "publish" && "id" in parsed.data) {
    const job = await jobRepo.publish(parsed.data.id);
    await writeAuditLog(session.userId, session.email, "job_publish", `${job.title} (${job.id})`);
    return NextResponse.json({ job });
  }

  if (action === "unpublish" && "id" in parsed.data) {
    const job = await jobRepo.unpublish(parsed.data.id);
    await writeAuditLog(session.userId, session.email, "job_unpublish", `${job.title} (${job.id})`);
    return NextResponse.json({ job });
  }

  if (action === "reorder" && "orderedIds" in parsed.data) {
    await jobRepo.reorder(session.tenantId, parsed.data.orderedIds);
    await writeAuditLog(session.userId, session.email, "job_reorder", `${parsed.data.orderedIds.length} jobs`);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
