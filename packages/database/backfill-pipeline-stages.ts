/*
 * Backfill: seed each tenant's default pipeline + set Application.stageId (ADR-0015, B1a).
 * Idempotent — safe to re-run. Run via tsx (like seed-production.ts):
 *   cd packages/database && npx tsx backfill-pipeline-stages.ts
 *
 * Default stages mirror today's 6 statuses 1:1 (kept inline — packages/database must
 * not import packages/shared; this duplicates DEFAULT_STAGES from shared/pipeline.ts).
 */

import { prisma } from "./client";

const DEFAULT_STAGES = [
  { key: "applied", label: "Applied", kind: "applied", order: 0, isTerminal: false },
  { key: "screening", label: "Under Review", kind: "in_process", order: 1, isTerminal: false },
  { key: "interview", label: "Interview", kind: "in_process", order: 2, isTerminal: false },
  { key: "offer", label: "Offer", kind: "offer", order: 3, isTerminal: false },
  { key: "hired", label: "Hired", kind: "hired", order: 4, isTerminal: true },
  { key: "rejected", label: "Not Selected", kind: "rejected", order: 5, isTerminal: true },
] as const;

async function main() {
  const tenants = await prisma.tenant.findMany({ select: { id: true } });
  console.log(`[backfill] ${tenants.length} tenant(s)`);

  for (const t of tenants) {
    // 1. Seed the tenant-default pipeline (jobId null) once.
    const existing = await prisma.pipelineStage.count({ where: { tenantId: t.id, jobId: null } });
    if (existing === 0) {
      await prisma.pipelineStage.createMany({
        data: DEFAULT_STAGES.map((s) => ({ ...s, tenantId: t.id })),
      });
      console.log(`[backfill] tenant ${t.id}: seeded ${DEFAULT_STAGES.length} default stages`);
    }

    // 2. Map applications status → stageId (only those not yet mapped).
    for (const s of DEFAULT_STAGES) {
      const stage = await prisma.pipelineStage.findFirst({
        where: { tenantId: t.id, jobId: null, key: s.key },
        select: { id: true },
      });
      if (!stage) continue;
      await prisma.application.updateMany({
        where: { tenantId: t.id, stageId: null, status: s.key },
        data: { stageId: stage.id },
      });
    }

    // 3. Any remaining unmapped (unknown legacy status) → the applied stage, logged.
    const applied = await prisma.pipelineStage.findFirst({
      where: { tenantId: t.id, jobId: null, key: "applied" },
      select: { id: true },
    });
    if (applied) {
      const r = await prisma.application.updateMany({
        where: { tenantId: t.id, stageId: null },
        data: { stageId: applied.id },
      });
      if (r.count > 0) console.log(`[backfill] tenant ${t.id}: ${r.count} app(s) with unknown status → applied`);
    }
  }
  console.log("[backfill] done");
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
