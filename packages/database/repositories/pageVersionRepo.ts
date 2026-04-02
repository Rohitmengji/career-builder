/*
 * Page Version Repository — versioned snapshots for page history and rollback.
 *
 * Every save creates a new version snapshot. The repo supports:
 *   - Creating version snapshots
 *   - Listing version history (paginated)
 *   - Loading a specific version for rollback
 *   - Pruning old versions to prevent unbounded growth
 *
 * Design notes:
 *   - tenantId is denormalized on PageVersion for query efficiency
 *   - version number is monotonically increasing per page
 *   - Max 50 versions per page by default (configurable) — oldest pruned on save
 */

import { prisma } from "../client";

/** Maximum number of version snapshots to keep per page */
const MAX_VERSIONS_PER_PAGE = 50;

export interface PageVersionSummary {
  id: string;
  version: number;
  title: string;
  savedBy: string | null;
  savedByEmail: string | null;
  createdAt: Date;
  /** Number of blocks in this version (parsed from JSON) */
  blockCount: number;
}

export interface PageVersionDetail {
  id: string;
  version: number;
  blocks: string;
  title: string;
  savedBy: string | null;
  savedByEmail: string | null;
  createdAt: Date;
  pageId: string;
  tenantId: string;
}

export const pageVersionRepo = {
  /**
   * Create a new version snapshot for a page.
   * Called internally by the save flow — not directly by API consumers.
   */
  async createSnapshot(
    pageId: string,
    tenantId: string,
    version: number,
    blocks: string,
    title: string,
    savedBy?: string,
    savedByEmail?: string,
  ): Promise<void> {
    await prisma.pageVersion.create({
      data: {
        pageId,
        tenantId,
        version,
        blocks,
        title,
        savedBy: savedBy ?? null,
        savedByEmail: savedByEmail ?? null,
      },
    });
  },

  /**
   * List version history for a page, newest first.
   * Returns summary info (no full blocks JSON) for UI display.
   */
  async listByPage(
    pageId: string,
    tenantId: string,
    limit = 20,
    offset = 0,
  ): Promise<PageVersionSummary[]> {
    const versions = await prisma.pageVersion.findMany({
      where: { pageId, tenantId },
      orderBy: { version: "desc" },
      take: limit,
      skip: offset,
      select: {
        id: true,
        version: true,
        title: true,
        blocks: true,
        savedBy: true,
        savedByEmail: true,
        createdAt: true,
      },
    });

    return versions.map((v) => {
      let blockCount = 0;
      try {
        const parsed = JSON.parse(v.blocks);
        blockCount = Array.isArray(parsed) ? parsed.length : 0;
      } catch {
        // Corrupted JSON — report 0 blocks
      }
      return {
        id: v.id,
        version: v.version,
        title: v.title,
        savedBy: v.savedBy,
        savedByEmail: v.savedByEmail,
        createdAt: v.createdAt,
        blockCount,
      };
    });
  },

  /**
   * Load a specific version's full data (including blocks JSON).
   */
  async findByVersion(
    pageId: string,
    version: number,
    tenantId: string,
  ): Promise<PageVersionDetail | null> {
    return prisma.pageVersion.findUnique({
      where: {
        pageId_version: { pageId, version },
      },
    });
  },

  /**
   * Count total versions for a page.
   */
  async countByPage(pageId: string, tenantId: string): Promise<number> {
    return prisma.pageVersion.count({
      where: { pageId, tenantId },
    });
  },

  /**
   * Prune old versions beyond the retention limit.
   * Keeps the newest `maxVersions` and deletes the rest.
   * This is called after every save to prevent unbounded growth.
   */
  async pruneOldVersions(
    pageId: string,
    tenantId: string,
    maxVersions = MAX_VERSIONS_PER_PAGE,
  ): Promise<number> {
    const count = await prisma.pageVersion.count({
      where: { pageId, tenantId },
    });

    if (count <= maxVersions) return 0;

    // Find the version number cutoff — keep newest maxVersions
    const cutoffVersions = await prisma.pageVersion.findMany({
      where: { pageId, tenantId },
      orderBy: { version: "desc" },
      take: maxVersions,
      select: { version: true },
    });

    const minKeepVersion = cutoffVersions[cutoffVersions.length - 1]?.version;
    if (minKeepVersion === undefined) return 0;

    const deleted = await prisma.pageVersion.deleteMany({
      where: {
        pageId,
        tenantId,
        version: { lt: minKeepVersion },
      },
    });

    return deleted.count;
  },
};
