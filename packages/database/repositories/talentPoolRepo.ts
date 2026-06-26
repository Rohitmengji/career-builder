/*
 * Talent Pool Repository (ADR-0018, B3). Tenant-scoped CRUD over talent pools (named
 * candidate buckets) + their members (keyed by candidate email — ADR-0001).
 *
 * WHY: recruiters keep promising past candidates warm for future roles (CRM). A pool
 *   groups candidates; re-engagement emails go out consent-gated (ADR-0011).
 * HOW: every method takes tenantId and scopes by it. Membership is by lowercased
 *   candidateEmail with @@unique([poolId, candidateEmail]) so add is idempotent.
 *   deleteMembersByEmail is the GDPR §17 erasure hook (ADR-0011) — pool membership
 *   holds the candidate's email/name (PII) and must be purged on erasure.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "../client";

export interface CreateTalentPoolInput {
  tenantId: string;
  name: string;
  description?: string | null;
  createdById?: string | null;
}

export const talentPoolRepo = {
  /** The tenant's pools, with member counts (newest first). */
  async listForTenant(tenantId: string) {
    return prisma.talentPool.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { members: true } } },
    });
  },

  /** One pool, tenant-scoped. */
  async findByIdScoped(id: string, tenantId: string) {
    return prisma.talentPool.findFirst({ where: { id, tenantId } });
  },

  async create(data: CreateTalentPoolInput) {
    return prisma.talentPool.create({
      data: {
        tenantId: data.tenantId,
        name: data.name,
        description: data.description ?? null,
        createdById: data.createdById ?? null,
      },
    });
  },

  /** Tenant-scoped rename / re-describe. Returns rows changed. */
  async update(id: string, tenantId: string, data: Partial<{ name: string; description: string | null }>) {
    const res = await prisma.talentPool.updateMany({ where: { id, tenantId }, data });
    return res.count;
  },

  /** Tenant-scoped delete (cascade removes members). Returns rows deleted. */
  async delete(id: string, tenantId: string) {
    const res = await prisma.talentPool.deleteMany({ where: { id, tenantId } });
    return res.count;
  },

  /**
   * Add a candidate (by email) to a pool. Caller MUST have verified the pool belongs
   * to the tenant. Idempotent: a re-add hits @@unique([poolId, candidateEmail]) and
   * returns false ("already a member").
   */
  async addMember(
    tenantId: string,
    poolId: string,
    candidateEmail: string,
    opts: { candidateName?: string | null; note?: string | null; addedById?: string | null } = {},
  ) {
    try {
      await prisma.talentPoolMember.create({
        data: {
          tenantId,
          poolId,
          candidateEmail: candidateEmail.toLowerCase(),
          candidateName: opts.candidateName ?? null,
          note: opts.note ?? null,
          addedById: opts.addedById ?? null,
        },
      });
      return true;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return false;
      throw e;
    }
  },

  /** Remove a candidate from a pool (tenant-scoped). Returns rows removed. */
  async removeMember(tenantId: string, poolId: string, candidateEmail: string) {
    const res = await prisma.talentPoolMember.deleteMany({
      where: { tenantId, poolId, candidateEmail: candidateEmail.toLowerCase() },
    });
    return res.count;
  },

  /** Members of a pool (tenant-scoped), newest first. Bounded — large pools page
   *  via future cursors; the re-engage cap (route) is separate. */
  async listMembers(tenantId: string, poolId: string, take = 1000) {
    return prisma.talentPoolMember.findMany({
      where: { tenantId, poolId },
      orderBy: { createdAt: "desc" },
      take,
    });
  },

  /**
   * GDPR §17 erasure hook (ADR-0011): delete ALL of a candidate's pool memberships
   * across the tenant (their email/name are PII). Returns rows deleted.
   */
  async deleteMembersByEmail(tenantId: string, candidateEmail: string) {
    const res = await prisma.talentPoolMember.deleteMany({
      where: { tenantId, candidateEmail: candidateEmail.toLowerCase() },
    });
    return res.count;
  },
};
