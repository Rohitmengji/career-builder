/*
 * Email Campaign (nurture) Repository (ADR-0019, B4). Tenant-scoped CRUD over
 * campaigns, their steps, enrollments, and the idempotent send log.
 *
 * WHY: scheduled multi-step candidate re-engagement. The C1 cron dispatcher reads the
 *   dispatch helpers here; the consent gate + email send live in the cron task (this
 *   repo stays pure data access).
 * HOW: tenant-scoped throughout. recordSend relies on @@unique([enrollmentId,
 *   stepIndex]) → a duplicate send (race / re-run) returns false, making dispatch
 *   idempotent. enroll is likewise idempotent. deleteEnrollmentsByEmail is the GDPR
 *   §17 erasure hook (enrollment PII + cascade of its sends).
 */

import { Prisma } from "@prisma/client";
import { prisma } from "../client";

export interface CreateCampaignInput {
  tenantId: string;
  name: string;
  createdById?: string | null;
}

export const campaignRepo = {
  /* ---- Campaigns ---- */
  async listForTenant(tenantId: string) {
    return prisma.emailCampaign.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { steps: true, enrollments: true } } },
    });
  },
  async findByIdScoped(id: string, tenantId: string) {
    return prisma.emailCampaign.findFirst({ where: { id, tenantId } });
  },
  async create(data: CreateCampaignInput) {
    return prisma.emailCampaign.create({ data: { tenantId: data.tenantId, name: data.name, createdById: data.createdById ?? null } });
  },
  async update(id: string, tenantId: string, data: Partial<{ name: string; status: string }>) {
    const res = await prisma.emailCampaign.updateMany({ where: { id, tenantId }, data });
    return res.count;
  },
  async delete(id: string, tenantId: string) {
    const res = await prisma.emailCampaign.deleteMany({ where: { id, tenantId } });
    return res.count;
  },

  /* ---- Steps ---- */
  async listSteps(tenantId: string, campaignId: string) {
    return prisma.campaignStep.findMany({ where: { tenantId, campaignId }, orderBy: { stepIndex: "asc" } });
  },
  /** Append a step at the next index. Caller verified campaign ownership. */
  async addStep(tenantId: string, campaignId: string, data: { offsetDays: number; subject: string; body: string }) {
    const last = await prisma.campaignStep.findFirst({ where: { tenantId, campaignId }, orderBy: { stepIndex: "desc" }, select: { stepIndex: true } });
    const stepIndex = (last?.stepIndex ?? -1) + 1;
    return prisma.campaignStep.create({ data: { tenantId, campaignId, stepIndex, offsetDays: data.offsetDays, subject: data.subject, body: data.body } });
  },
  async deleteStep(id: string, tenantId: string) {
    const res = await prisma.campaignStep.deleteMany({ where: { id, tenantId } });
    return res.count;
  },

  /* ---- Enrollments ---- */
  /** Enroll a candidate (idempotent: re-enroll → false). Caller verified ownership. */
  async enroll(tenantId: string, campaignId: string, candidateEmail: string, candidateName?: string | null) {
    try {
      await prisma.campaignEnrollment.create({
        data: { tenantId, campaignId, candidateEmail: candidateEmail.toLowerCase(), candidateName: candidateName ?? null },
      });
      return true;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return false;
      throw e;
    }
  },
  async listEnrollments(tenantId: string, campaignId: string, take = 1000) {
    return prisma.campaignEnrollment.findMany({ where: { tenantId, campaignId }, orderBy: { enrolledAt: "desc" }, take });
  },
  async setEnrollmentStatus(id: string, tenantId: string, status: string) {
    const res = await prisma.campaignEnrollment.updateMany({ where: { id, tenantId }, data: { status } });
    return res.count;
  },
  /** GDPR §17 erasure hook: delete a candidate's enrollments (PII) — cascades sends. */
  async deleteEnrollmentsByEmail(tenantId: string, candidateEmail: string) {
    const res = await prisma.campaignEnrollment.deleteMany({ where: { tenantId, candidateEmail: candidateEmail.toLowerCase() } });
    return res.count;
  },

  /* ---- Dispatch (cron) ---- */
  /** Active campaigns (any tenant) that have at least one step, with their steps. */
  async listActiveCampaignsForDispatch(cap = 200) {
    return prisma.emailCampaign.findMany({
      where: { status: "active", steps: { some: {} } },
      include: { steps: { select: { stepIndex: true, offsetDays: true, subject: true, body: true }, orderBy: { stepIndex: "asc" } } },
      take: cap,
    });
  },
  /** Active enrollments of a campaign with the stepIndexes already sent (for nextDueStep). */
  async listActiveEnrollmentsForDispatch(tenantId: string, campaignId: string, cap = 1000) {
    return prisma.campaignEnrollment.findMany({
      where: { tenantId, campaignId, status: "active" },
      include: { sends: { select: { stepIndex: true } } },
      take: cap,
    });
  },
  /**
   * Record a send (idempotent dedupe via @@unique([enrollmentId, stepIndex])). Returns
   * true if THIS call created the row (safe to actually send the email), false if it
   * already existed (another run/raced — do NOT send again).
   */
  async recordSend(tenantId: string, campaignId: string, enrollmentId: string, stepIndex: number, candidateEmail: string) {
    try {
      await prisma.campaignSend.create({ data: { tenantId, campaignId, enrollmentId, stepIndex, candidateEmail: candidateEmail.toLowerCase() } });
      return true;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return false;
      throw e;
    }
  },
};
