/*
 * Decision Ledger Repository (ADR-0027). The DB side of the sealed candidate decision
 * receipt. packages/database cannot import packages/shared, so this returns the RAW
 * shape (RawLedgerData) and BOTH apps run it through shared/decision-ledger.entriesFromRaw
 * — that single bridge guarantees the writer (admin, at decision) and reader (web, on
 * view) compose byte-identically.
 *
 * The seal digest is stored on the application's TERMINAL candidate-visible status_change
 * event, in its existing `metadata` JSON (namespaced under `decisionLedger`) — no new
 * table/migration, append-only spine, tenant-scoped, cascade-safe.
 */

import { prisma } from "../client";

const TERMINAL = ["hired", "rejected"];

export interface RawLedgerData {
  statuses: string[];
  screeningPassed: boolean | null;
  adverse: { category: string; candidateMessage: string | null; sharedWithCandidate: boolean } | null;
}

export const decisionLedgerRepo = {
  /**
   * Fetch the candidate-SAFE inputs for an application's ledger (tenant-scoped):
   *  - the ordered candidate-visible STATUS sequence,
   *  - screening pass/fail (parsed from the application's stored screeningAnswers),
   *  - the raw adverse-action fields (the app layer applies candidateProjection).
   */
  async buildInput(tenantId: string, applicationId: string, opts: { statusesAsOf?: Date } = {}): Promise<RawLedgerData> {
    const [events, app, adverse] = await Promise.all([
      prisma.applicationEvent.findMany({
        // `statusesAsOf` caps the status sequence at the SEALED terminal event, so a
        // later reopen / re-decision can't retroactively flip a sealed receipt to
        // "modified" (the reader passes the stored boundary; the writer caps at now).
        where: {
          tenantId, applicationId, type: "status_change", visibility: "candidate",
          ...(opts.statusesAsOf ? { createdAt: { lte: opts.statusesAsOf } } : {}),
        },
        select: { toStatus: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.application.findFirst({ where: { id: applicationId, tenantId }, select: { screeningAnswers: true } }),
      prisma.adverseAction.findFirst({
        where: { tenantId, applicationId },
        select: { category: true, candidateMessage: true, sharedWithCandidate: true },
      }),
    ]);

    let screeningPassed: boolean | null = null;
    if (app?.screeningAnswers) {
      try {
        const parsed = JSON.parse(app.screeningAnswers) as { passed?: unknown };
        if (typeof parsed?.passed === "boolean") screeningPassed = parsed.passed;
      } catch { /* malformed → no screening entry */ }
    }

    return {
      statuses: events.map((e) => e.toStatus).filter((s): s is string => !!s),
      screeningPassed,
      adverse: adverse ? { category: adverse.category, candidateMessage: adverse.candidateMessage, sharedWithCandidate: !!adverse.sharedWithCandidate } : null,
    };
  },

  /**
   * Persist the seal on the application's most-recent terminal status_change event.
   * Merges into existing metadata (namespaced). Returns true if a terminal event was
   * found + stamped.
   */
  async storeSeal(tenantId: string, applicationId: string, digest: string, sealedAt: string): Promise<boolean> {
    const ev = await prisma.applicationEvent.findFirst({
      where: { tenantId, applicationId, type: "status_change", toStatus: { in: TERMINAL } },
      orderBy: { createdAt: "desc" },
      select: { id: true, metadata: true, createdAt: true },
    });
    if (!ev) return false;
    let meta: Record<string, unknown> = {};
    if (ev.metadata) { try { meta = JSON.parse(ev.metadata) as Record<string, unknown>; } catch { meta = {}; } }
    // boundaryAt = the sealed terminal event's timestamp; the reader caps the status
    // sequence at it so later re-decisions never false-flag this receipt as modified.
    meta.decisionLedger = { v: 1, digest, sealedAt, boundaryAt: ev.createdAt.toISOString() };
    await prisma.applicationEvent.updateMany({ where: { id: ev.id, tenantId }, data: { metadata: JSON.stringify(meta) } });
    return true;
  },

  /** The stored seal for an application's terminal decision, or null if unsealed. */
  async getSeal(tenantId: string, applicationId: string): Promise<{ digest: string; sealedAt: string; boundaryAt: string | null } | null> {
    const ev = await prisma.applicationEvent.findFirst({
      where: { tenantId, applicationId, type: "status_change", toStatus: { in: TERMINAL } },
      orderBy: { createdAt: "desc" },
      select: { metadata: true },
    });
    if (!ev?.metadata) return null;
    try {
      const meta = JSON.parse(ev.metadata) as { decisionLedger?: { digest?: string; sealedAt?: string; boundaryAt?: string } };
      if (meta.decisionLedger?.digest) return { digest: meta.decisionLedger.digest, sealedAt: meta.decisionLedger.sealedAt ?? "", boundaryAt: meta.decisionLedger.boundaryAt ?? null };
    } catch { /* malformed */ }
    return null;
  },
};
