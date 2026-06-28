/*
 * Application Repository — CRUD + pipeline management.
 */

import { prisma } from "../client";
import type { Prisma } from "@prisma/client";

export interface CreateApplicationInput {
  jobId: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  resumeUrl?: string;
  resumePath?: string;
  resumeText?: string;
  screeningAnswers?: string;
  coverLetter?: string;
  linkedinUrl?: string;
  source?: string;
}

export interface ApplicationFilters {
  tenantId: string;
  jobId?: string;
  status?: string;
  email?: string;
  department?: string; // filter by job's department
  /** Free-text candidate search across name / email / extracted résumé text.
   *  (SQLite LIKE is case-insensitive for ASCII.) Callers MUST NOT pass this
   *  while blind hiring is on — it would let a recruiter de-anonymize. */
  q?: string;
  /** Tag ids to filter by (ADR-0016). AND semantics: an application must carry
   *  ALL of these tags to match (narrowing filter). Ids are tenant-scoped via the
   *  join, so a foreign tagId simply matches nothing. */
  tags?: string[];
  /** Hiring-team visibility allow-list (ADR-0020, B6b). When set, results are
   *  restricted to these jobIds. An EMPTY array means "no access to any job" and
   *  MUST yield zero rows — never treat empty as "no filter". */
  jobIds?: string[];
}

export const applicationRepo = {
  async findById(id: string) {
    return prisma.application.findUnique({
      where: { id },
      include: { job: true },
    });
  },

  /** The candidate's own application ids in a tenant (EXACT email match, lowercased). */
  async findIdsByEmail(tenantId: string, email: string): Promise<string[]> {
    const rows = await prisma.application.findMany({
      where: { tenantId, email: email.toLowerCase() },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  },

  async findByTenant(
    filters: ApplicationFilters,
    page = 1,
    perPage = 20,
  ) {
    const where: Prisma.ApplicationWhereInput = {
      tenantId: filters.tenantId,
    };

    if (filters.jobId) where.jobId = filters.jobId;
    // Hiring-team scope (ADR-0020): restrict to the allow-list. Applied even when
    // empty — `{ in: [] }` matches nothing, so a user on no teams sees nothing. If a
    // single jobId is also set, intersect (the jobId must be in the allow-list).
    if (filters.jobIds !== undefined) {
      where.jobId = filters.jobId
        ? (filters.jobIds.includes(filters.jobId) ? filters.jobId : { in: [] })
        : { in: filters.jobIds };
    }
    if (filters.status) where.status = filters.status;
    if (filters.email) where.email = { contains: filters.email };
    if (filters.department) {
      where.job = { department: filters.department };
    }
    if (filters.q) {
      const q = filters.q.trim();
      if (q) {
        where.OR = [
          { firstName: { contains: q } },
          { lastName: { contains: q } },
          { email: { contains: q } },
          { resumeText: { contains: q } },
        ];
      }
    }
    if (filters.tags && filters.tags.length > 0) {
      // AND across tags: one `some` clause per tag id, so the application must
      // have a join row for EVERY requested tag. Tenant scoping comes from the
      // top-level tenantId — a foreign tagId just never matches.
      where.AND = filters.tags.map((tagId) => ({ tags: { some: { tagId } } }));
    }

    const [data, total] = await Promise.all([
      prisma.application.findMany({
        where,
        // List views never need the (large, PII-rich) extracted resume text —
        // keep it out of list payloads/memory; detail fetches (findById*) keep it.
        omit: { resumeText: true },
        include: {
          job: { select: { id: true, title: true, department: true, location: true } },
        },
        orderBy: { submittedAt: "desc" },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      prisma.application.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        perPage,
        total,
        totalPages: Math.max(1, Math.ceil(total / perPage)),
      },
    };
  },

  /**
   * Find an existing application for the same candidate + job within a tenant.
   * Used to prevent duplicate applications (a candidate applying twice to the
   * same role). Tenant-scoped so it can't surface another tenant's data.
   */
  async findDuplicate(tenantId: string, jobId: string, email: string) {
    return prisma.application.findFirst({
      where: { tenantId, jobId, email: email.toLowerCase() },
      select: { id: true },
    });
  },

  async create(data: CreateApplicationInput) {
    return prisma.application.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email.toLowerCase(),
        phone: data.phone,
        resumeUrl: data.resumeUrl,
        resumePath: data.resumePath,
        resumeText: data.resumeText,
        screeningAnswers: data.screeningAnswers,
        coverLetter: data.coverLetter,
        linkedinUrl: data.linkedinUrl,
        source: data.source,
        jobId: data.jobId,
        tenantId: data.tenantId,
      },
    });
  },

  /** Fetch one application SCOPED to a tenant (defense-in-depth vs find-then-check). */
  async findByIdScoped(id: string, tenantId: string) {
    return prisma.application.findFirst({
      where: { id, tenantId },
      include: { job: true },
    });
  },

  /**
   * Fetch multiple applications by id, SCOPED to a tenant. Foreign ids are
   * silently dropped (not returned) — the tenant filter is the isolation
   * boundary for bulk operations.
   */
  async findManyByIds(ids: string[], tenantId: string) {
    if (ids.length === 0) return [];
    return prisma.application.findMany({
      where: { id: { in: ids }, tenantId },
      omit: { resumeText: true }, // bulk/list path — exclude large resume text
      include: { job: { select: { title: true, department: true, location: true } } },
    });
  },

  /**
   * Bulk status change, tenant-scoped via the where clause so a foreign id can
   * never be mutated. Returns the number of rows actually changed.
   */
  async bulkUpdateStatus(ids: string[], tenantId: string, status: string) {
    if (ids.length === 0) return 0;
    const res = await prisma.application.updateMany({
      // Never reverse a candidate-owned "withdrawn" terminal (ADR-0035) — must match
      // shared/application-status.RECRUITER_LOCKED_STATUSES. The route also pre-filters.
      where: { id: { in: ids }, tenantId, status: { notIn: ["withdrawn"] } },
      data: { status },
    });
    return res.count;
  },

  async updateStatus(id: string, status: string, notes?: string) {
    return prisma.application.update({
      where: { id },
      data: { status, ...(notes !== undefined ? { notes } : {}) },
    });
  },

  /**
   * Atomic, status-guarded advance (ADR-0035 race fix). Only flips `id` to `toStatus`
   * when its CURRENT status is one of `fromStatuses` — folded into the WHERE so a
   * concurrent candidate withdrawal (or any other transition) can't be clobbered by a
   * stale-snapshot blind write. Tenant-scoped. Returns rows changed (0 = not advanced).
   */
  async advanceStatusIfIn(id: string, tenantId: string, fromStatuses: string[], toStatus: string) {
    const res = await prisma.application.updateMany({
      where: { id, tenantId, status: { in: fromStatuses } },
      data: { status: toStatus },
    });
    return res.count;
  },

  /**
   * Candidate withdrawal (ADR-0035). Atomic CAS: flips an application to "withdrawn"
   * ONLY if it is still in-play and pre-offer (applied/screening/interview) — never an
   * offer-stage or already-terminal app. Tenant-scoped; the caller verifies candidate
   * ownership (email+tenant) first. Returns the affected count (0 = not eligible /
   * already decided → the route returns 409). The status list MUST match
   * shared/application-status.WITHDRAWABLE_STATUSES.
   */
  async withdrawByIdIfActive(id: string, tenantId: string) {
    const res = await prisma.application.updateMany({
      where: { id, tenantId, status: { in: ["applied", "screening", "interview"] } },
      data: { status: "withdrawn" },
    });
    return res.count;
  },

  /** Assign a pipeline stage (ADR-0015) + the derived canonical status, tenant-scoped. Returns rows changed. */
  async setStage(id: string, tenantId: string, stageId: string, status: string) {
    const res = await prisma.application.updateMany({ where: { id, tenantId }, data: { stageId, status } });
    return res.count;
  },

  /** Release / un-release anonymized interview feedback to the candidate (ADR-0012). Tenant-scoped; returns rows changed. */
  async setFeedbackReleased(id: string, tenantId: string, releasedAt: Date | null) {
    const res = await prisma.application.updateMany({ where: { id, tenantId }, data: { feedbackReleasedAt: releasedAt } });
    return res.count;
  },

  async updateRating(id: string, rating: number) {
    return prisma.application.update({
      where: { id },
      data: { rating },
    });
  },

  async delete(id: string) {
    return prisma.application.delete({ where: { id } });
  },

  async countByJob(jobId: string) {
    return prisma.application.count({ where: { jobId } });
  },

  async countByStatus(tenantId: string) {
    const results = await prisma.application.groupBy({
      by: ["status"],
      where: { tenantId },
      _count: { status: true },
    });
    return results.reduce(
      (acc, r) => ({ ...acc, [r.status]: r._count.status }),
      {} as Record<string, number>,
    );
  },

  async getRecentByTenant(tenantId: string, limit = 10, jobIds?: string[]) {
    return prisma.application.findMany({
      // Hiring-team scope (ADR-0020): when jobIds is provided, restrict the
      // dashboard "recent applications" widget (which carries candidate identity) to
      // those jobs. Empty array → `{ in: [] }` → nothing (a user on no teams sees none).
      where: { tenantId, ...(jobIds !== undefined ? { jobId: { in: jobIds } } : {}) },
      omit: { resumeText: true }, // recent/list path — exclude large resume text
      include: {
        job: { select: { id: true, title: true, department: true } },
      },
      orderBy: { submittedAt: "desc" },
      take: limit,
    });
  },

  /**
   * Still-unanswered applications (status "applied") for the ghosting-risk nudge
   * (ADR-0033). Tenant-scoped + hiring-team-scoped (jobIds: undefined = all jobs,
   * [] = none). Selects only what the nudge shows: id, submittedAt, status, and the
   * candidate name + job title (the route REDACTS the name under blind hiring). Bounded
   * by `cap`, oldest first so the most-at-risk surface even if the cap truncates.
   */
  async findPendingForGhostingRisk(tenantId: string, jobIds?: string[], cap = 500) {
    return prisma.application.findMany({
      where: {
        tenantId,
        status: "applied",
        ...(jobIds !== undefined ? { jobId: { in: jobIds } } : {}),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        status: true,
        submittedAt: true,
        job: { select: { id: true, title: true } },
      },
      orderBy: { submittedAt: "asc" },
      take: cap,
    });
  },

  /**
   * Lean per-application status + submission time for a tenant, for computing
   * the Employer Responsiveness Score. Tenant-scoped; bounded by `cap`; selects
   * only the two fields the metric needs (no PII). Most-recent first so the cap
   * keeps the freshest window when a tenant exceeds it.
   */
  async findStatusSummary(
    tenantId: string,
    cap = 5000,
  ): Promise<{ status: string; submittedAt: Date }[]> {
    return prisma.application.findMany({
      where: { tenantId },
      select: { status: true, submittedAt: true },
      orderBy: { submittedAt: "desc" },
      take: cap,
    });
  },

  /** Find all applications by a candidate email, scoped to tenant. */
  async findByCandidateEmail(email: string, tenantId: string) {
    return prisma.application.findMany({
      where: { email: email.toLowerCase(), tenantId },
      include: {
        job: { select: { id: true, title: true, department: true, location: true } },
      },
      orderBy: { submittedAt: "desc" },
    });
  },
};
