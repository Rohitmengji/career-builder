/*
 * Application Tag Repository (ADR-0016, B2b). Tenant-scoped CRUD over the per-tenant
 * tag library + the many-to-many link between tags and applications.
 *
 * WHY: recruiters annotate/segment candidates with tags and filter the pipeline by
 *   them. The tag library is per-tenant; renaming/recolouring a tag updates it
 *   everywhere it's applied (the join references tagId, not a copied label).
 * HOW: every method takes tenantId and scopes by it — including the link mutations,
 *   which verify BOTH the tag and the application belong to the tenant before
 *   inserting a join row (the cross-tenant-sensitive surface). The @@unique on the
 *   join makes "add" idempotent (a duplicate add is a no-op, not an error).
 */

import { Prisma } from "@prisma/client";
import { prisma } from "../client";

export interface CreateTagInput {
  tenantId: string;
  label: string;
  color?: string | null;
}

export const tagRepo = {
  /** The tenant's tag library, with how many applications carry each tag. */
  async listForTenant(tenantId: string) {
    return prisma.applicationTag.findMany({
      where: { tenantId },
      orderBy: { label: "asc" },
      include: { _count: { select: { applications: true } } },
    });
  },

  /** One tag, tenant-scoped (assignment validation). */
  async findByIdScoped(id: string, tenantId: string) {
    return prisma.applicationTag.findFirst({ where: { id, tenantId } });
  },

  async create(data: CreateTagInput) {
    return prisma.applicationTag.create({
      data: { tenantId: data.tenantId, label: data.label, color: data.color ?? null },
    });
  },

  /** Tenant-scoped rename/recolour. Returns rows changed (0 = not found / not owned). */
  async update(id: string, tenantId: string, data: Partial<{ label: string; color: string | null }>) {
    const res = await prisma.applicationTag.updateMany({ where: { id, tenantId }, data });
    return res.count;
  },

  /** Tenant-scoped delete (cascade removes its links). Returns rows deleted. */
  async delete(id: string, tenantId: string) {
    const res = await prisma.applicationTag.deleteMany({ where: { id, tenantId } });
    return res.count;
  },

  /**
   * Link a tag to an application. Caller MUST have already verified both belong to
   * the tenant; tenantId is stamped on the join for defense-in-depth. Idempotent:
   * a re-add hits the @@unique and is swallowed (returns false = "already present").
   */
  async addToApplication(tenantId: string, applicationId: string, tagId: string, createdById?: string) {
    try {
      await prisma.applicationTagOnApplication.create({
        data: { tenantId, applicationId, tagId, createdById: createdById ?? null },
      });
      return true;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return false;
      throw e;
    }
  },

  /** Remove a tag from an application (tenant-scoped). Returns rows removed. */
  async removeFromApplication(tenantId: string, applicationId: string, tagId: string) {
    const res = await prisma.applicationTagOnApplication.deleteMany({
      where: { tenantId, applicationId, tagId },
    });
    return res.count;
  },

  /**
   * Tags applied to a set of applications (tenant-scoped), for attaching to a list
   * payload. Returns a Map of applicationId -> [{ id, label, color }] in label order.
   */
  async listForApplications(tenantId: string, applicationIds: string[]) {
    const map = new Map<string, { id: string; label: string; color: string | null }[]>();
    if (applicationIds.length === 0) return map;
    const links = await prisma.applicationTagOnApplication.findMany({
      where: { tenantId, applicationId: { in: applicationIds } },
      include: { tag: { select: { id: true, label: true, color: true } } },
      orderBy: { tag: { label: "asc" } },
    });
    for (const link of links) {
      const list = map.get(link.applicationId) ?? [];
      list.push({ id: link.tag.id, label: link.tag.label, color: link.tag.color });
      map.set(link.applicationId, list);
    }
    return map;
  },
};
