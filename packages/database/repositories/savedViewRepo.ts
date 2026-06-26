/*
 * Saved View Repository (ADR-0016, B2b). Named filter presets on the applications
 * list, PRIVATE to the user who created them.
 *
 * WHY: recruiters re-run the same filtered views (e.g. "Eng — interview stage,
 *   tagged referral"). Saved views remove the repeated clicking.
 * HOW: every method scopes by BOTH tenantId AND userId — a view is owned by one
 *   user in one tenant and is never visible to anyone else. `filters` is an
 *   already-sanitized JSON string (see shared/saved-view.serializeViewFilters); this
 *   repo treats it as opaque storage.
 */

import { prisma } from "../client";

export interface CreateSavedViewInput {
  tenantId: string;
  userId: string;
  name: string;
  filters: string; // pre-sanitized JSON (shared/saved-view)
}

export const savedViewRepo = {
  /** The caller's own saved views in this tenant (newest first). */
  async listForUser(tenantId: string, userId: string) {
    return prisma.savedView.findMany({
      where: { tenantId, userId },
      orderBy: { createdAt: "desc" },
    });
  },

  async create(data: CreateSavedViewInput) {
    return prisma.savedView.create({
      data: { tenantId: data.tenantId, userId: data.userId, name: data.name, filters: data.filters },
    });
  },

  /** Delete one of the caller's OWN views. Scoped by tenant+user — returns rows deleted. */
  async delete(id: string, tenantId: string, userId: string) {
    const res = await prisma.savedView.deleteMany({ where: { id, tenantId, userId } });
    return res.count;
  },
};
