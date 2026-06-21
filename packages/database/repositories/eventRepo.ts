/*
 * Application Event Repository — the hiring-workflow timeline (ADR-0005).
 *
 * Typed, append-only, tenant-scoped lifecycle events (status changes,
 * interview/offer activity). Distinct from AuditLog (security/compliance).
 * The candidate-facing reader projects to NON-identifying fields only.
 */

import { prisma } from "../client";

export type ApplicationEventType =
  | "status_change"
  | "interview_scheduled"
  | "interview_confirmed"
  | "interview_rescheduled"
  | "interview_cancelled"
  | "interview_completed"
  | "scorecard_submitted"
  | "offer_extended"
  | "offer_accepted"
  | "offer_declined"
  | "offer_expired";

export interface RecordEventInput {
  tenantId: string;
  applicationId: string;
  type: ApplicationEventType | string;
  fromStatus?: string | null;
  toStatus?: string | null;
  actorId?: string | null;
  actorType?: "recruiter" | "candidate" | "system";
  visibility?: "candidate" | "internal";
  metadata?: Record<string, unknown>;
}

/** Minimal, non-identifying projection safe to send to a candidate. */
export interface CandidateVisibleEvent {
  applicationId: string;
  type: string;
  toStatus: string | null;
  at: Date;
}

export const eventRepo = {
  /** Append an event. metadata is JSON-stringified; never put candidate PII in it. */
  async record(input: RecordEventInput) {
    return prisma.applicationEvent.create({
      data: {
        tenantId: input.tenantId,
        applicationId: input.applicationId,
        type: input.type,
        fromStatus: input.fromStatus ?? null,
        toStatus: input.toStatus ?? null,
        actorId: input.actorId ?? null,
        actorType: input.actorType ?? "system",
        visibility: input.visibility ?? "internal",
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      },
    });
  },

  /** Full event history for ONE application (internal/admin), tenant-scoped, chronological. */
  async listForApplication(tenantId: string, applicationId: string) {
    return prisma.applicationEvent.findMany({
      where: { tenantId, applicationId },
      orderBy: { createdAt: "asc" },
    });
  },

  /**
   * Candidate-facing timeline: ONLY visibility:"candidate" events for the given
   * application ids, projected to non-identifying fields (never actor identity or
   * internal metadata). Mirrors auditRepo.findProfileViews. No DB hit when empty.
   */
  async listCandidateVisible(
    tenantId: string,
    applicationIds: string[],
  ): Promise<CandidateVisibleEvent[]> {
    if (applicationIds.length === 0) return [];
    const rows = await prisma.applicationEvent.findMany({
      where: { tenantId, applicationId: { in: applicationIds }, visibility: "candidate" },
      select: { applicationId: true, type: true, toStatus: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((r) => ({
      applicationId: r.applicationId,
      type: r.type,
      toStatus: r.toStatus,
      at: r.createdAt,
    }));
  },

  /** All status-change events for a tenant (for responsiveness time metrics), bounded. */
  async listStatusChanges(tenantId: string, cap = 10_000) {
    return prisma.applicationEvent.findMany({
      where: { tenantId, type: "status_change" },
      select: { applicationId: true, toStatus: true, createdAt: true },
      orderBy: { createdAt: "asc" },
      take: cap,
    });
  },
};
