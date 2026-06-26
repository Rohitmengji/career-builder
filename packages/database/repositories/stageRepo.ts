/*
 * Pipeline Stage Repository (ADR-0015, B1b). Tenant-scoped CRUD over the
 * per-tenant pipeline. `Application.status` stays the canonical 6-value field the
 * reasoners use; a stage carries a `kind` that maps to one of those statuses
 * (shared/pipeline.statusForStage). Deletion is a soft-retire (isActive=false) so
 * historical applications keep referencing their stage.
 */

import { prisma } from "../client";

export interface CreateStageInput {
  tenantId: string;
  key: string;
  label: string;
  kind: string;
  order?: number;
  color?: string | null;
  isTerminal?: boolean;
}

export const stageRepo = {
  /** Tenant-default pipeline (jobId null). `activeOnly` for assignment dropdowns. */
  async listForTenant(tenantId: string, activeOnly = false) {
    return prisma.pipelineStage.findMany({
      where: { tenantId, jobId: null, ...(activeOnly ? { isActive: true } : {}) },
      orderBy: { order: "asc" },
    });
  },

  /** One stage, tenant-scoped (for assignment validation). */
  async findByIdScoped(id: string, tenantId: string) {
    return prisma.pipelineStage.findFirst({ where: { id, tenantId } });
  },

  async create(data: CreateStageInput) {
    return prisma.pipelineStage.create({
      data: {
        tenantId: data.tenantId,
        jobId: null,
        key: data.key,
        label: data.label,
        kind: data.kind,
        order: data.order ?? 0,
        color: data.color ?? null,
        isTerminal: data.isTerminal ?? (data.kind === "hired" || data.kind === "rejected"),
        isActive: true,
      },
    });
  },

  /** Tenant-scoped update (label/color/order/isActive). Returns rows changed. */
  async update(
    id: string,
    tenantId: string,
    data: Partial<{ label: string; color: string | null; order: number; isActive: boolean }>,
  ) {
    const res = await prisma.pipelineStage.updateMany({ where: { id, tenantId }, data });
    return res.count;
  },

  /** Reorder the tenant pipeline: set each stage's order by its position. Tenant-scoped. */
  async reorder(tenantId: string, orderedIds: string[]) {
    await prisma.$transaction(
      orderedIds.map((id, i) => prisma.pipelineStage.updateMany({ where: { id, tenantId }, data: { order: i } })),
    );
    return orderedIds.length;
  },

  /** How many active stages of a given kind exist (required-kind coverage guard). */
  async countActiveByKind(tenantId: string, kind: string) {
    return prisma.pipelineStage.count({ where: { tenantId, jobId: null, kind, isActive: true } });
  },
};
