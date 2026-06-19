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
    if (filters.status) where.status = filters.status;
    if (filters.email) where.email = { contains: filters.email };
    if (filters.department) {
      where.job = { department: filters.department };
    }

    const [data, total] = await Promise.all([
      prisma.application.findMany({
        where,
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
      where: { id: { in: ids }, tenantId },
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

  async getRecentByTenant(tenantId: string, limit = 10) {
    return prisma.application.findMany({
      where: { tenantId },
      include: {
        job: { select: { id: true, title: true, department: true } },
      },
      orderBy: { submittedAt: "desc" },
      take: limit,
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
