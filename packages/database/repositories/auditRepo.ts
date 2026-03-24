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

export const auditRepo = {
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
