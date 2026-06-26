/*
 * Requisition Repository (ADR-0020, B6a). Tenant-scoped CRUD over requisitions — the
 * approval record that authorizes a job to be published.
 *
 * WHY: organizations gate job postings behind headcount approval. A job may be
 *   published only once its requisition is `approved` (enforced at the publish route).
 * HOW: `transition` is an ATOMIC compare-and-set (updateMany WHERE status === from) so
 *   the state machine (shared/requisition.canTransition, validated in the route) can't
 *   be raced — a concurrent approve/reject can apply at most once. One req per job
 *   (@@unique jobId) → a duplicate create surfaces P2002 (route → 409).
 */

import { Prisma } from "@prisma/client";
import { prisma } from "../client";

export interface CreateRequisitionInput {
  tenantId: string;
  jobId?: string | null;
  title: string;
  department?: string | null;
  headcount?: number;
  justification?: string | null;
  createdById?: string | null;
}

export const requisitionRepo = {
  /** Tenant's requisitions (optionally filtered by status), newest first. */
  async listForTenant(tenantId: string, status?: string) {
    return prisma.requisition.findMany({
      where: { tenantId, ...(status ? { status } : {}) },
      orderBy: { createdAt: "desc" },
    });
  },

  /** One requisition, tenant-scoped. */
  async findByIdScoped(id: string, tenantId: string) {
    return prisma.requisition.findFirst({ where: { id, tenantId } });
  },

  /** The requisition authorizing a given job (for the publish gate). Tenant-scoped. */
  async findByJob(jobId: string, tenantId: string) {
    return prisma.requisition.findFirst({ where: { jobId, tenantId } });
  },

  async create(data: CreateRequisitionInput) {
    return prisma.requisition.create({
      data: {
        tenantId: data.tenantId,
        jobId: data.jobId ?? null,
        title: data.title,
        department: data.department ?? null,
        headcount: data.headcount ?? 1,
        justification: data.justification ?? null,
        createdById: data.createdById ?? null,
      },
    });
  },

  /**
   * Edit draft-editable fields (tenant-scoped). ATOMIC: the WHERE pins status to
   * `draft`, so a concurrent submit/approve between the route's read and this write
   * makes the edit apply to 0 rows (route → 409) — a non-draft req can never be
   * mutated. Returns rows changed.
   */
  async update(
    id: string,
    tenantId: string,
    data: Partial<{ title: string; department: string | null; headcount: number; justification: string | null }>,
  ) {
    const res = await prisma.requisition.updateMany({ where: { id, tenantId, status: "draft" }, data });
    return res.count;
  },

  /**
   * Atomic state-machine transition: only applies if the row is STILL in `fromStatus`
   * (compare-and-set). The route validates canTransition + RBAC first; this closes the
   * race. Returns rows changed (1 = applied, 0 = stale/not found/not owned).
   */
  async transition(
    id: string,
    tenantId: string,
    fromStatus: string,
    toStatus: string,
    extra: { approverId?: string | null; decisionNote?: string | null; decidedAt?: Date | null } = {},
  ) {
    const data: Record<string, unknown> = { status: toStatus };
    if (extra.approverId !== undefined) data.approverId = extra.approverId;
    if (extra.decisionNote !== undefined) data.decisionNote = extra.decisionNote;
    if (extra.decidedAt !== undefined) data.decidedAt = extra.decidedAt;
    const res = await prisma.requisition.updateMany({
      where: { id, tenantId, status: fromStatus },
      data,
    });
    return res.count;
  },

  /** Tenant-scoped delete. Returns rows deleted. */
  async delete(id: string, tenantId: string) {
    const res = await prisma.requisition.deleteMany({ where: { id, tenantId } });
    return res.count;
  },

  /** Map a create P2002 (jobId already has a requisition) for the route. */
  isDuplicateJobError(e: unknown): boolean {
    return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
  },
};
