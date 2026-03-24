/*
 * Webhook Repository — CRUD for webhook subscriptions.
 */

import { prisma } from "../client";

export interface CreateWebhookInput {
  url: string;
  events: string[];
  secret?: string;
  tenantId: string;
}

export const webhookRepo = {
  async findByTenant(tenantId: string) {
    return prisma.webhook.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });
  },

  async findActiveByEvent(tenantId: string, event: string) {
    const all = await prisma.webhook.findMany({
      where: { tenantId, isActive: true },
    });
    // Filter by event match (events is stored as JSON string array)
    return all.filter((w) => {
      try {
        const events: string[] = JSON.parse(String(w.events));
        return events.includes(event);
      } catch {
        return false;
      }
    });
  },

  async create(data: CreateWebhookInput) {
    return prisma.webhook.create({
      data: {
        url: data.url,
        events: JSON.stringify(data.events),
        secret: data.secret,
        tenantId: data.tenantId,
      },
    });
  },

  async update(id: string, data: { url?: string; events?: string[]; isActive?: boolean }) {
    const updateData: Record<string, unknown> = {};
    if (data.url !== undefined) updateData.url = data.url;
    if (data.events !== undefined) updateData.events = JSON.stringify(data.events);
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    return prisma.webhook.update({ where: { id }, data: updateData });
  },

  async delete(id: string) {
    return prisma.webhook.delete({ where: { id } });
  },
};
