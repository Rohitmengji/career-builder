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
   * Save a page draft with optional optimistic locking.
   * This ONLY saves the draft — no version snapshot is created.
   * Version snapshots are created on PUBLISH, not on save.
   *
   * @param slug - Page slug
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param blocks - JSON string of block definitions
   * @param title - Optional page title
   * @param expectedVersion - If provided, save is rejected if the current
   *   version doesn't match (concurrent edit detected). Pass `undefined`
   *   to skip conflict check (used by auto-save and initial creates).
   * @param savedBy - User ID who saved
   * @param savedByEmail - User email
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

    // NOTE: Version snapshots are NOT created on save.
    // Snapshots are only created on PUBLISH to avoid storing every minor edit.
    // The `version` field still increments on every save for optimistic locking.

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

  /**
   * Publish a page — copies draft `blocks` → `publishedBlocks`.
   * Also creates a version snapshot — versions are only stored on publish, not on every save.
   * Returns the published version number and timestamp.
   */
  async publish(slug: string, tenantId: string, publishedBy?: string, publishedByEmail?: string): Promise<{
    success: boolean;
    version: number;
    publishedAt: Date;
    hasUnpublishedChanges: boolean;
  }> {
    const page = await prisma.page.findUnique({
      where: { slug_tenantId: { slug, tenantId } },
      select: { id: true, blocks: true, title: true, version: true, publishedVersion: true },
    });

    if (!page) {
      return { success: false, version: 0, publishedAt: new Date(), hasUnpublishedChanges: false };
    }

    const now = new Date();
    await prisma.page.update({
      where: { slug_tenantId: { slug, tenantId } },
      data: {
        publishedBlocks: page.blocks,
        publishedVersion: page.version,
        publishedAt: now,
        isPublished: true,
      },
    });

    // Create a version snapshot on publish — this is the ONLY place versions are stored.
    // Every publish captures the state so users can restore to any previously published version.
    try {
      await pageVersionRepo.createSnapshot(
        page.id,
        tenantId,
        page.version,
        page.blocks,
        page.title || slug,
        publishedBy,
        publishedByEmail,
      );
      // Prune old versions to prevent unbounded growth
      await pageVersionRepo.pruneOldVersions(page.id, tenantId);
    } catch (err) {
      // Non-fatal — version history is best-effort, don't break the publish
      console.error("[pageRepo] Failed to create publish version snapshot:", err);
    }

    return {
      success: true,
      version: page.version,
      publishedAt: now,
      hasUnpublishedChanges: false,
    };
  },

  /**
   * Check if a page has unpublished changes (draft differs from published).
   */
  async getPublishStatus(slug: string, tenantId: string): Promise<{
    version: number;
    publishedVersion: number;
    hasUnpublishedChanges: boolean;
    publishedAt: Date | null;
  } | null> {
    const page = await prisma.page.findUnique({
      where: { slug_tenantId: { slug, tenantId } },
      select: { version: true, publishedVersion: true, publishedAt: true },
    });

    if (!page) return null;

    return {
      version: page.version,
      publishedVersion: page.publishedVersion,
      hasUnpublishedChanges: page.version !== page.publishedVersion,
      publishedAt: page.publishedAt,
    };
  },

  async listSlugs(tenantId: string) {
    const pages = await prisma.page.findMany({
      where: { tenantId },
      select: { slug: true },
    });
    return pages.map((p) => p.slug);
  },
};
