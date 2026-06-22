/*
 * Offer Repository — offer lifecycle (ADR-0008). Tenant-scoped throughout.
 * Candidate↔offer ownership resolves via the application's email (no candidateId
 * FK, ADR-0001). The route verifies cross-tenant user references (createdBy /
 * approver) — not this repo. Status transitions are atomic compare-and-swap
 * (status guarded in the WHERE) so concurrent actions can't double-apply.
 */

import { prisma } from "../client";

export interface CreateOfferInput {
  tenantId: string;
  applicationId: string;
  createdById: string;
  jobId?: string | null;
  salaryAmount?: number | null;
  salaryCurrency?: string;
  salaryPeriod?: string;
  startDate?: Date | null;
  expiresAt?: Date | null;
  terms?: string | null;
  notes?: string | null;
}

const USER_SELECT = { select: { id: true, name: true, email: true } } as const;
const ACTIVE_STATUSES = ["draft", "pending_approval", "approved", "sent"] as const;

/** Mutable fields a transition may set alongside status. */
export type OfferUpdateData = Partial<{
  status: string;
  salaryAmount: number | null;
  salaryCurrency: string;
  salaryPeriod: string;
  startDate: Date | null;
  expiresAt: Date | null;
  terms: string | null;
  notes: string | null;
  approverId: string | null;
  approvedAt: Date | null;
  sentAt: Date | null;
  respondedAt: Date | null;
  decisionNote: string | null;
}>;

export const offerRepo = {
  async create(data: CreateOfferInput) {
    return prisma.offer.create({
      data: {
        tenantId: data.tenantId,
        applicationId: data.applicationId,
        createdById: data.createdById,
        jobId: data.jobId ?? null,
        status: "draft",
        salaryAmount: data.salaryAmount ?? null,
        salaryCurrency: data.salaryCurrency ?? "USD",
        salaryPeriod: data.salaryPeriod ?? "yearly",
        startDate: data.startDate ?? null,
        expiresAt: data.expiresAt ?? null,
        terms: data.terms ?? null,
        notes: data.notes ?? null,
      },
      include: { createdBy: USER_SELECT, approver: USER_SELECT },
    });
  },

  /** One offer, tenant-scoped, with people + minimal application. */
  async findByIdScoped(id: string, tenantId: string) {
    return prisma.offer.findFirst({
      where: { id, tenantId },
      include: {
        createdBy: USER_SELECT,
        approver: USER_SELECT,
        application: {
          select: { id: true, firstName: true, lastName: true, email: true, status: true, job: { select: { title: true } } },
        },
      },
    });
  },

  /** Offers for one application (recruiter view), tenant-scoped, newest first. */
  async listForApplication(tenantId: string, applicationId: string) {
    return prisma.offer.findMany({
      where: { tenantId, applicationId },
      include: { createdBy: USER_SELECT, approver: USER_SELECT },
      orderBy: { createdAt: "desc" },
    });
  },

  /** Count NON-terminal offers for an application (supersede / concurrency guard). */
  async countActiveForApplication(tenantId: string, applicationId: string) {
    return prisma.offer.count({
      where: { tenantId, applicationId, status: { in: [...ACTIVE_STATUSES] } },
    });
  },

  /** The candidate's own offers (matched by application email), tenant-scoped. */
  async listForCandidate(email: string, tenantId: string) {
    return prisma.offer.findMany({
      where: { tenantId, application: { email: email.toLowerCase() } },
      include: { application: { select: { id: true, job: { select: { title: true, department: true } } } } },
      orderBy: { createdAt: "desc" },
    });
  },

  /** Fetch an offer ONLY if it belongs to this candidate (email+tenant). */
  async findForCandidate(id: string, email: string, tenantId: string) {
    return prisma.offer.findFirst({
      where: { id, tenantId, application: { email: email.toLowerCase() } },
      include: { application: { select: { id: true, job: { select: { title: true } } } } },
    });
  },

  /** Unconditional tenant-scoped update (e.g. editing a draft). Returns rows changed. */
  async update(id: string, tenantId: string, data: OfferUpdateData) {
    const res = await prisma.offer.updateMany({ where: { id, tenantId }, data });
    return res.count;
  },

  /**
   * Atomic compare-and-swap transition: flips status ONLY if the row is still in
   * `expectedFrom`. Returns rows changed (0 = lost the race / not owned / not found).
   * This is what serializes concurrent recruiter actions safely.
   */
  async transition(id: string, tenantId: string, expectedFrom: string, data: OfferUpdateData) {
    const res = await prisma.offer.updateMany({
      where: { id, tenantId, status: expectedFrom },
      data,
    });
    return res.count;
  },

  /**
   * Candidate accept/decline — atomic + authoritative. Transitions ONLY a SENT,
   * not-yet-expired offer owned by this candidate (email+tenant). Expiry is folded
   * into the WHERE so there's no check-then-act window. Returns rows changed
   * (0 = not owned / already terminal / expired). `toStatus` must be accepted|declined.
   */
  async decideAsCandidate(
    id: string,
    tenantId: string,
    email: string,
    toStatus: "accepted" | "declined",
    note: string | null,
    now: Date,
  ) {
    const res = await prisma.offer.updateMany({
      where: {
        id,
        tenantId,
        application: { email: email.toLowerCase() },
        status: "sent",
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      data: { status: toStatus, respondedAt: now, decisionNote: note },
    });
    return res.count;
  },
};
