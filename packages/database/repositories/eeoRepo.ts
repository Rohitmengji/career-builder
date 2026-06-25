/*
 * EEO Self-ID Repository (ADR-0013) — ISOLATION-CRITICAL.
 *
 * Exposes ONLY: record() and listForAggregate(). There is deliberately NO
 * individual read (no findByApplication / findById / list-with-ids) — demographics
 * must never be retrievable per candidate. listForAggregate returns the demographic
 * columns WITHOUT id/applicationId (unlinkable), purely to feed the pure suppressed
 * aggregator (shared/eeo-aggregate). Tenant-scoped.
 */

import { prisma } from "../client";

export interface RecordEeoInput {
  tenantId: string;
  applicationId: string;
  gender?: string | null;
  race?: string | null;
  ethnicity?: string | null;
  veteranStatus?: string | null;
  disability?: string | null;
}

export const eeoRepo = {
  /** Record (or replace) one application's voluntary self-ID. One row per application. */
  async record(data: RecordEeoInput) {
    const payload = {
      gender: data.gender ?? null,
      race: data.race ?? null,
      ethnicity: data.ethnicity ?? null,
      veteranStatus: data.veteranStatus ?? null,
      disability: data.disability ?? null,
    };
    return prisma.eeoSelfId.upsert({
      where: { applicationId: data.applicationId },
      create: { tenantId: data.tenantId, applicationId: data.applicationId, ...payload },
      update: payload,
    });
  },

  /**
   * The ONLY read: unlinkable demographic rows (no id/applicationId) for the
   * suppressed aggregator. Never expose these directly — the caller MUST pass them
   * through shared/eeo-aggregate.computeEeoAggregate before returning anything.
   */
  async listForAggregate(tenantId: string) {
    return prisma.eeoSelfId.findMany({
      where: { tenantId },
      select: { gender: true, race: true, ethnicity: true, veteranStatus: true, disability: true },
    });
  },

  /** Erasure hook (ADR-0011): hard-delete EEO rows for the given applications. */
  async deleteForApplications(tenantId: string, applicationIds: string[]) {
    if (applicationIds.length === 0) return 0;
    const res = await prisma.eeoSelfId.deleteMany({ where: { tenantId, applicationId: { in: applicationIds } } });
    return res.count;
  },
};
