/*
 * Tenant Repository — CRUD operations for tenants.
 */

import { prisma } from "../client";
import type { Prisma } from "@prisma/client";

export const tenantRepo = {
  async findById(id: string) {
    return prisma.tenant.findUnique({ where: { id } });
  },

  async findByDomain(domain: string) {
    return prisma.tenant.findUnique({ where: { domain } });
  },

  async findAll() {
    return prisma.tenant.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
  },

  async create(data: Prisma.TenantCreateInput) {
    return prisma.tenant.create({ data });
  },

  async update(id: string, data: Prisma.TenantUpdateInput) {
    return prisma.tenant.update({ where: { id }, data });
  },

  async delete(id: string) {
    return prisma.tenant.update({
      where: { id },
      data: { isActive: false },
    });
  },

  async getStats(tenantId: string) {
    const [jobs, applications, users] = await Promise.all([
      prisma.job.count({ where: { tenantId, isPublished: true } }),
      prisma.application.count({ where: { tenantId } }),
      prisma.user.count({ where: { tenantId, isActive: true } }),
    ]);
    return { jobs, applications, users };
  },
};
