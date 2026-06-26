/*
 * Hiring Team Repository (ADR-0020, B6b). Who may see/act on a job's applications.
 *
 * WHY: when the hiring_teams flag is on, non-admin roles are scoped to applications
 *   for jobs they are a team member of. This repo answers "who is on this job" and
 *   "which jobs is this user on" — the second feeds the application-visibility filter.
 * HOW: tenant-scoped throughout. Membership is binary (a row = access); the `role`
 *   field is informational. listJobIdsForUser is the hot path (every scoped read).
 */

import { Prisma } from "@prisma/client";
import { prisma } from "../client";

export const hiringTeamRepo = {
  /** Members of a job's hiring team (tenant-scoped), with the user's name/email/role. */
  async listForJob(tenantId: string, jobId: string) {
    return prisma.hiringTeamMember.findMany({
      where: { tenantId, jobId },
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
      orderBy: { createdAt: "asc" },
    });
  },

  /** The job ids a user is on the team of (the application-visibility allow-list). */
  async listJobIdsForUser(tenantId: string, userId: string): Promise<string[]> {
    const rows = await prisma.hiringTeamMember.findMany({
      where: { tenantId, userId },
      select: { jobId: true },
    });
    return rows.map((r) => r.jobId);
  },

  /**
   * Add a user to a job's team. Caller MUST have verified BOTH the job and the user
   * belong to the tenant. Idempotent: a re-add hits @@unique([jobId, userId]) → false.
   */
  async addMember(tenantId: string, jobId: string, userId: string, role = "member") {
    try {
      await prisma.hiringTeamMember.create({ data: { tenantId, jobId, userId, role } });
      return true;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return false;
      throw e;
    }
  },

  /** Remove a user from a job's team (tenant-scoped). Returns rows removed. */
  async removeMember(tenantId: string, jobId: string, userId: string) {
    const res = await prisma.hiringTeamMember.deleteMany({ where: { tenantId, jobId, userId } });
    return res.count;
  },
};
