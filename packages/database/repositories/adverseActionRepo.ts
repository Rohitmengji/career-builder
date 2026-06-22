/*
 * Adverse Action Repository — structured rejection reasons (ADR-0010).
 * Tenant-scoped throughout. One record per application (upsert). The candidate-safe
 * projection logic lives in @career-builder/shared/adverse-action (the route applies
 * it — packages/database must not import shared); this repo NEVER selects `freeText`
 * on the candidate-visible path (defense in depth).
 */

import { prisma } from "../client";

export interface UpsertAdverseActionInput {
  tenantId: string;
  applicationId: string;
  kind?: string; // rejection | offer_declined | offer_rescinded
  category: string;
  freeText?: string | null;
  stage?: string | null;
  sharedWithCandidate?: boolean;
  candidateMessage?: string | null;
  decidedById?: string | null;
}

const DECIDED_BY_SELECT = { select: { id: true, name: true, email: true } } as const;

export const adverseActionRepo = {
  /** Create or replace the application's adverse-action record (one per application). */
  async upsert(data: UpsertAdverseActionInput) {
    const payload = {
      kind: data.kind ?? "rejection",
      category: data.category,
      freeText: data.freeText ?? null,
      stage: data.stage ?? null,
      sharedWithCandidate: data.sharedWithCandidate ?? false,
      candidateMessage: data.candidateMessage ?? null,
      decidedById: data.decidedById ?? null,
      decidedAt: new Date(),
    };
    return prisma.adverseAction.upsert({
      where: { applicationId: data.applicationId },
      create: { tenantId: data.tenantId, applicationId: data.applicationId, ...payload },
      update: payload,
    });
  },

  /** Full record for one application (recruiter view), tenant-scoped. */
  async findForApplication(tenantId: string, applicationId: string) {
    return prisma.adverseAction.findFirst({
      where: { tenantId, applicationId },
      include: { decidedBy: DECIDED_BY_SELECT },
    });
  },

  /**
   * Candidate-visible reasons for the given applications: ONLY shared records,
   * projected to non-identifying fields (never `freeText`/`decidedBy`). The route
   * maps these through shared `candidateProjection` for the final message.
   */
  async findCandidateVisible(tenantId: string, applicationIds: string[]) {
    if (applicationIds.length === 0) return [];
    return prisma.adverseAction.findMany({
      where: { tenantId, applicationId: { in: applicationIds }, sharedWithCandidate: true },
      select: { applicationId: true, category: true, candidateMessage: true, sharedWithCandidate: true },
    });
  },

  /** Counts by category (+ stage) for the rejection funnel — counts only, never rows. */
  async aggregateByCategory(tenantId: string, filters: { from?: Date; to?: Date } = {}) {
    return prisma.adverseAction.groupBy({
      by: ["category"],
      where: {
        tenantId,
        ...(filters.from || filters.to
          ? { decidedAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } }
          : {}),
      },
      _count: { _all: true },
    });
  },
};
