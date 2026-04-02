/*
 * Page Repository — CRUD for CMS pages.
 *
 * Supports:
 *   - Optimistic locking via `version` field (detects concurrent edits)
 *   - Version history snapshots (delegated to pageVersionRepo)
 *   - Tenant-scoped queries
 */

import { prisma } from "../client";
import { pageVersionRepo } from "./pageVersionRepo";

export interface SavePageResult {
  success: boolean;
  version: number;
  updatedAt: Date;
  /** Set to true if the save was rejected due to a version conflict */
  conflict?: boolean;
}

export const pageRepo = {
  async findBySlug(slug: string, tenantId: string) {
    return prisma.page.findUnique({
      where: { slug_tenantId: { slug, tenantId } },
    });
  },

  async findByTenant(tenantId: string) {
    return prisma.page.findMany({
      where: { tenantId },
      orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        slug: true,
        title: true,
        isPublished: true,
        sortOrder: true,
        version: true,
        updatedAt: true,
      },
    });
  },

  /**
   * Save a page with version history and optional optimistic locking.
   *
   * @param slug - Page slug
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param blocks - JSON string of block definitions
   * @param title - Optional page title
   * @param expectedVersion - If provided, save is rejected if the current
   *   version doesn't match (concurrent edit detected). Pass `undefined`
   *   to skip conflict check (used by auto-save and initial creates).
   * @param savedBy - User ID who saved (for version history)
   * @param savedByEmail - User email (for version history display)
   */
  async upsert(
    slug: string,
    tenantId: string,
    blocks: string,
    title?: string,
    expectedVersion?: number,
    savedBy?: string,
    savedByEmail?: string,
  ): Promise<SavePageResult> {
    // Check for existing page
    const existing = await prisma.page.findUnique({
      where: { slug_tenantId: { slug, tenantId } },
      select: { id: true, version: true, updatedAt: true },
    });

    // Optimistic locking: reject if version mismatch
    if (expectedVersion !== undefined && existing && existing.version !== expectedVersion) {
      return {
        success: false,
        version: existing.version,
        updatedAt: existing.updatedAt,
        conflict: true,
      };
    }

    const nextVersion = existing ? existing.version + 1 : 1;

    const page = await prisma.page.upsert({
      where: { slug_tenantId: { slug, tenantId } },
      create: {
        slug,
        title: title || slug,
        blocks,
        version: 1,
        tenantId,
      },
      update: {
        blocks,
        version: nextVersion,
        ...(title ? { title } : {}),
      },
    });

    // Create version snapshot (best-effort — don't block the save)
    try {
      await pageVersionRepo.createSnapshot(
        page.id,
        tenantId,
        nextVersion,
        blocks,
        title || slug,
        savedBy,
        savedByEmail,
      );
      // Prune old versions to prevent unbounded growth
      await pageVersionRepo.pruneOldVersions(page.id, tenantId);
    } catch (err) {
      // Non-fatal — version history is best-effort
      console.error("[pageRepo] Failed to create version snapshot:", err);
    }

    return {
      success: true,
      version: page.version,
      updatedAt: page.updatedAt,
    };
  },

  async delete(slug: string, tenantId: string) {
    return prisma.page.delete({
      where: { slug_tenantId: { slug, tenantId } },
    });
  },

  async listSlugs(tenantId: string) {
    const pages = await prisma.page.findMany({
      where: { tenantId },
      select: { slug: true },
    });
    return pages.map((p) => p.slug);
  },
};
