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
    const whereUnique = { slug_tenantId: { slug, tenantId } } as const;

    const existing = await prisma.page.findUnique({
      where: whereUnique,
      select: { id: true, version: true, updatedAt: true },
    });

    // ── CREATE path ────────────────────────────────────────────────
    if (!existing) {
      try {
        const page = await prisma.page.create({
          data: { slug, title: title || slug, blocks, version: 1, tenantId },
        });
        return { success: true, version: page.version, updatedAt: page.updatedAt };
      } catch {
        // Lost the create race to a concurrent request — fall through and
        // treat it as an update below.
      }
    }

    // ── UPDATE path (atomic compare-and-set) ────────────────────────
    // Previously this read the version then wrote in a separate query, so two
    // concurrent saves could both pass the check and one would clobber the
    // other (lost update). We now increment atomically and, when an
    // expectedVersion is supplied, gate the write on it in the same statement.
    const result = await prisma.page.updateMany({
      where: {
        slug,
        tenantId,
        ...(expectedVersion !== undefined ? { version: expectedVersion } : {}),
      },
      data: {
        blocks,
        version: { increment: 1 },
        ...(title ? { title } : {}),
      },
    });

    if (result.count === 0) {
      // No row matched. Either a version conflict (someone saved first) or the
      // row vanished. Re-read to report the authoritative current version.
      const current = await prisma.page.findUnique({
        where: whereUnique,
        select: { version: true, updatedAt: true },
      });
      return {
        success: false,
        version: current?.version ?? expectedVersion ?? 0,
        updatedAt: current?.updatedAt ?? new Date(),
        conflict: true,
      };
    }

    // Read back the freshly-incremented version/timestamp.
    const updated = await prisma.page.findUnique({
      where: whereUnique,
      select: { version: true, updatedAt: true },
    });

    // NOTE: Version snapshots are NOT created on save — only on PUBLISH.
    return {
      success: true,
      version: updated?.version ?? (expectedVersion !== undefined ? expectedVersion + 1 : 1),
      updatedAt: updated?.updatedAt ?? new Date(),
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
