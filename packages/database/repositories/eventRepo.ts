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

/** Candidate-facing status labels (kept local — packages/database must not import shared). */
const STATUS_LABELS: Record<string, string> = {
  applied: "Applied",
  screening: "Under review",
  interview: "Interview",
  offer: "Offer",
  hired: "Hired",
  rejected: "Not selected",
  withdrawn: "Withdrawn",
};

/** Map a candidate-visible event to notification copy, or null if it shouldn't notify. */
function candidateNotificationContent(type: string, toStatus: string | null): { title: string; body: string | null } | null {
  switch (type) {
    case "status_change":
      return toStatus ? { title: "Application update", body: `Your status is now “${STATUS_LABELS[toStatus] ?? toStatus}”.` } : null;
    case "interview_scheduled":
      return { title: "Interview scheduled", body: "A new interview has been scheduled — open your applications to confirm." };
    case "interview_rescheduled":
      return { title: "Interview rescheduled", body: "Your interview time has changed." };
    case "interview_cancelled":
      return { title: "Interview cancelled", body: "An interview was cancelled. The team will be in touch about next steps." };
    case "offer_extended":
      return { title: "You’ve received an offer 🎉", body: "Open your applications to review and respond." };
    case "offer_rescinded":
      return { title: "Offer withdrawn", body: null };
    default:
      return null;
  }
}

/**
 * Best-effort: turn a candidate-visible event into a candidate notification.
 * Keyed by the application's email (ADR-0001). Never gated here — the API/UI gate
 * exposure (incl. per-tenant flag); writing history regardless means enabling the
 * feature surfaces recent activity immediately. Failures are swallowed by the caller.
 */
async function fanOutCandidateNotification(tenantId: string, applicationId: string, type: string, toStatus: string | null) {
  const content = candidateNotificationContent(type, toStatus);
  if (!content) return;
  const app = await prisma.application.findFirst({ where: { id: applicationId, tenantId }, select: { email: true } });
  if (!app?.email) return;
  await prisma.notification.create({
    data: {
      tenantId,
      recipientType: "candidate",
      recipientId: app.email.toLowerCase(),
      type,
      title: content.title,
      body: content.body,
      link: "/applications",
      applicationId,
    },
  });
}

export const eventRepo = {
  /** Append an event. metadata is JSON-stringified; never put candidate PII in it. */
  async record(input: RecordEventInput) {
    const event = await prisma.applicationEvent.create({
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
    // Candidate-visible events NOT initiated by the candidate become candidate
    // notifications (don't notify someone about their own action). Best-effort.
    if ((input.visibility ?? "internal") === "candidate" && (input.actorType ?? "system") !== "candidate") {
      try {
        await fanOutCandidateNotification(input.tenantId, input.applicationId, input.type, input.toStatus ?? null);
      } catch {
        /* notifications are best-effort — never block event recording */
      }
    }
    return event;
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
