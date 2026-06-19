/*
 * Audit Log Repository — immutable log of all mutations.
 */

import { prisma } from "../client";

export interface CreateAuditInput {
  action: string;
  entity?: string;
  entityId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userId?: string;
  tenantId: string;
}

/** Action name for a recruiter viewing a candidate's application detail. */
export const CANDIDATE_PROFILE_VIEW = "candidate_profile_view";

export const auditRepo = {
  /**
   * Record that a recruiter viewed a candidate's application (feeds the
   * candidate-visible "who viewed me" log). Tenant-scoped, append-only.
   */
  async logProfileView(tenantId: string, applicationId: string, viewerId: string, ipAddress?: string) {
    return prisma.auditLog.create({
      data: {
        action: CANDIDATE_PROFILE_VIEW,
        entity: "application",
        entityId: applicationId,
        userId: viewerId,
        tenantId,
        ipAddress,
      },
    });
  },

  /**
   * The "who viewed me" feed for a candidate: profile-view rows for the given
   * application ids, tenant-scoped, with the viewer's display name. Returns only
   * non-sensitive fields (viewer name + timestamp) — never the wider audit log.
   */
  async findProfileViews(tenantId: string, applicationIds: string[], limit = 100) {
    if (applicationIds.length === 0) return [];
    const rows = await prisma.auditLog.findMany({
      where: { tenantId, action: CANDIDATE_PROFILE_VIEW, entityId: { in: applicationIds } },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { user: { select: { name: true } } },
    });
    return rows.map((r) => ({ viewerName: r.user?.name ?? "A team member", viewedAt: r.createdAt }));
  },

  async log(entry: CreateAuditInput) {
    return prisma.auditLog.create({
      data: {
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        details: entry.details ? JSON.stringify(entry.details) : null,
        ipAddress: entry.ipAddress,
        userId: entry.userId,
        tenantId: entry.tenantId,
      },
    });
  },

  async findByTenant(tenantId: string, page = 1, perPage = 50) {
    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: { tenantId },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      prisma.auditLog.count({ where: { tenantId } }),
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

  async findByEntity(tenantId: string, entity: string, entityId: string) {
    return prisma.auditLog.findMany({
      where: { tenantId, entity, entityId },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  },
};
