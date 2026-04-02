/*
 * Page store — now backed by the database via @career-builder/database.
 *
 * The API surface stays identical to the old file-based version,
 * with added support for:
 *   - Version tracking (optimistic locking for concurrent edit detection)
 *   - Version history snapshots (auto-created on every save)
 *   - Conflict detection (rejects saves when version mismatch detected)
 */

import { pageRepo } from "@career-builder/database";

const DEFAULT_TENANT_ID = process.env.TENANT_ID || "default";

export interface PageBlock {
  type: string;
  props: Record<string, unknown>;
}

export interface SavePageOptions {
  /** If provided, save is rejected on version mismatch (concurrent edit detected) */
  expectedVersion?: number;
  /** User ID who saved — recorded in version history */
  savedBy?: string;
  /** User email — recorded in version history for display */
  savedByEmail?: string;
}

export interface SaveResult {
  success: boolean;
  version: number;
  updatedAt: Date;
  /** True if save was rejected due to concurrent edit */
  conflict?: boolean;
}

export async function savePage(
  slug: string,
  blocks: PageBlock[],
  tenantId?: string,
  options?: SavePageOptions,
): Promise<SaveResult> {
  const result = await pageRepo.upsert(
    slug,
    tenantId || DEFAULT_TENANT_ID,
    JSON.stringify(blocks),
    undefined,
    options?.expectedVersion,
    options?.savedBy,
    options?.savedByEmail,
  );

  return {
    success: result.success,
    version: result.version,
    updatedAt: result.updatedAt,
    conflict: result.conflict,
  };
}

export interface LoadPageResult {
  blocks: PageBlock[];
  version: number;
  updatedAt: Date;
}

export async function loadPage(slug: string, tenantId?: string): Promise<LoadPageResult> {
  const page = await pageRepo.findBySlug(slug, tenantId || DEFAULT_TENANT_ID);
  if (!page) return { blocks: [], version: 0, updatedAt: new Date() };
  try {
    return {
      blocks: JSON.parse(String(page.blocks)),
      version: page.version,
      updatedAt: page.updatedAt,
    };
  } catch {
    return { blocks: [], version: page.version, updatedAt: page.updatedAt };
  }
}

export async function listPages(tenantId?: string): Promise<string[]> {
  return pageRepo.listSlugs(tenantId || DEFAULT_TENANT_ID);
}

export async function deletePage(slug: string, tenantId?: string): Promise<void> {
  try {
    await pageRepo.delete(slug, tenantId || DEFAULT_TENANT_ID);
  } catch {
    // Page may not exist — non-fatal
  }
}

export interface PublishResult {
  success: boolean;
  version: number;
  publishedAt: Date;
}

export async function publishPage(slug: string, tenantId?: string): Promise<PublishResult> {
  const result = await pageRepo.publish(slug, tenantId || DEFAULT_TENANT_ID);
  return {
    success: result.success,
    version: result.version,
    publishedAt: result.publishedAt,
  };
}

export async function getPublishStatus(slug: string, tenantId?: string) {
  return pageRepo.getPublishStatus(slug, tenantId || DEFAULT_TENANT_ID);
}
