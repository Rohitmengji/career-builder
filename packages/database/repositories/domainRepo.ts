/*
 * Domain repository — custom domains per tenant.
 *
 * Every mutation is tenant-scoped via updateMany/deleteMany with a
 * { id, tenantId } filter, so a guessed/foreign domain id can never be mutated
 * across tenants (returns count 0 instead of touching another tenant's row).
 */

import { prisma } from "../client";
import { normalizeHostname } from "../host";

export { normalizeHostname };

export const DOMAIN_STATUSES = ["pending", "verified", "active", "failed"] as const;
export type DomainStatus = (typeof DOMAIN_STATUSES)[number];

export interface CreateDomainInput {
  tenantId: string;
  hostname: string;
  verifyToken: string;
}

const SELECT = {
  id: true,
  hostname: true,
  status: true,
  verifyToken: true,
  isPrimary: true,
  createdAt: true,
  verifiedAt: true,
} as const;

export const domainRepo = {
  normalizeHostname,

  async listByTenant(tenantId: string) {
    return prisma.domain.findMany({
      where: { tenantId },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      select: SELECT,
    });
  },

  /** Exact host lookup (any status). Used to reject duplicates on add. */
  async findByHostname(hostname: string) {
    return prisma.domain.findUnique({ where: { hostname: normalizeHostname(hostname) } });
  },

  /** The tenant that owns an ACTIVE custom domain — used by request resolution. */
  async findActiveTenantId(hostname: string): Promise<string | null> {
    const row = await prisma.domain.findFirst({
      where: { hostname: normalizeHostname(hostname), status: "active" },
      select: { tenantId: true, tenant: { select: { isActive: true } } },
    });
    if (!row || !row.tenant?.isActive) return null;
    return row.tenantId;
  },

  async getOwned(id: string, tenantId: string) {
    return prisma.domain.findFirst({ where: { id, tenantId }, select: { ...SELECT, tenantId: true } });
  },

  async create(input: CreateDomainInput) {
    return prisma.domain.create({
      data: {
        tenantId: input.tenantId,
        hostname: normalizeHostname(input.hostname),
        verifyToken: input.verifyToken,
        status: "pending",
      },
      select: SELECT,
    });
  },

  /** Tenant-scoped status update. Returns the number of rows changed (0 = not owned). */
  async setStatus(id: string, tenantId: string, status: DomainStatus, verifiedAt: Date | null = null) {
    const res = await prisma.domain.updateMany({
      where: { id, tenantId },
      data: { status, verifiedAt },
    });
    return res.count;
  },

  /** Make one domain primary, clearing the previous primary — atomic. */
  async setPrimary(id: string, tenantId: string) {
    const [, set] = await prisma.$transaction([
      prisma.domain.updateMany({ where: { tenantId, isPrimary: true }, data: { isPrimary: false } }),
      prisma.domain.updateMany({ where: { id, tenantId }, data: { isPrimary: true } }),
    ]);
    return set.count;
  },

  async delete(id: string, tenantId: string) {
    const res = await prisma.domain.deleteMany({ where: { id, tenantId } });
    return res.count;
  },
};
