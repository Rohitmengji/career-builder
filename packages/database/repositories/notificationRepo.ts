/*
 * Notification Repository — in-app notification center (ADR-0009, Phase 4).
 * Tenant-scoped throughout. Recipients are polymorphic: a recruiter ("user",
 * keyed by User id) or a candidate ("candidate", keyed by lowercased application
 * email — no candidateId FK, ADR-0001). Every read/write is scoped by
 * (tenantId, recipientType, recipientId) so one recipient can never see another's.
 */

import { prisma } from "../client";

export type RecipientType = "user" | "candidate";

export interface CreateNotificationInput {
  tenantId: string;
  recipientType: RecipientType;
  recipientId: string;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
  applicationId?: string | null;
}

/** Candidate recipients are keyed by lowercased email; normalize defensively. */
function normId(recipientType: RecipientType, recipientId: string): string {
  return recipientType === "candidate" ? recipientId.toLowerCase() : recipientId;
}

const LIST_CAP = 30;

export const notificationRepo = {
  async create(input: CreateNotificationInput) {
    return prisma.notification.create({
      data: {
        tenantId: input.tenantId,
        recipientType: input.recipientType,
        recipientId: normId(input.recipientType, input.recipientId),
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        link: input.link ?? null,
        applicationId: input.applicationId ?? null,
      },
    });
  },

  /** Create many at once (fan-out to multiple recipients), best-effort. */
  async createMany(inputs: CreateNotificationInput[]) {
    if (inputs.length === 0) return 0;
    const res = await prisma.notification.createMany({
      data: inputs.map((i) => ({
        tenantId: i.tenantId,
        recipientType: i.recipientType,
        recipientId: normId(i.recipientType, i.recipientId),
        type: i.type,
        title: i.title,
        body: i.body ?? null,
        link: i.link ?? null,
        applicationId: i.applicationId ?? null,
      })),
    });
    return res.count;
  },

  /** Most recent notifications for one recipient, tenant-scoped, newest first, bounded. */
  async listForRecipient(tenantId: string, recipientType: RecipientType, recipientId: string, limit = LIST_CAP) {
    return prisma.notification.findMany({
      where: { tenantId, recipientType, recipientId: normId(recipientType, recipientId) },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(1, limit), LIST_CAP),
    });
  },

  /** Unread count for the badge, tenant + recipient scoped. */
  async countUnread(tenantId: string, recipientType: RecipientType, recipientId: string) {
    return prisma.notification.count({
      where: { tenantId, recipientType, recipientId: normId(recipientType, recipientId), readAt: null },
    });
  },

  /** Mark every unread notification for this recipient read. Returns rows changed. */
  async markAllRead(tenantId: string, recipientType: RecipientType, recipientId: string, now: Date) {
    const res = await prisma.notification.updateMany({
      where: { tenantId, recipientType, recipientId: normId(recipientType, recipientId), readAt: null },
      data: { readAt: now },
    });
    return res.count;
  },

  /** Mark ONE notification read — only if it belongs to this recipient. Returns rows changed. */
  async markRead(id: string, tenantId: string, recipientType: RecipientType, recipientId: string, now: Date) {
    const res = await prisma.notification.updateMany({
      where: { id, tenantId, recipientType, recipientId: normId(recipientType, recipientId), readAt: null },
      data: { readAt: now },
    });
    return res.count;
  },
};
