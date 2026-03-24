/*
 * Page store — now backed by the database via @career-builder/database.
 *
 * The API surface stays identical to the old file-based version.
 * In production you'd call these from route handlers only (they're async).
 */

import { pageRepo } from "@career-builder/database";

const DEFAULT_TENANT_ID = process.env.TENANT_ID || "default";

export interface PageBlock {
  type: string;
  props: Record<string, unknown>;
}

export async function savePage(slug: string, blocks: PageBlock[], tenantId?: string): Promise<void> {
  await pageRepo.upsert(slug, tenantId || DEFAULT_TENANT_ID, JSON.stringify(blocks));
}

export async function loadPage(slug: string, tenantId?: string): Promise<PageBlock[]> {
  const page = await pageRepo.findBySlug(slug, tenantId || DEFAULT_TENANT_ID);
  if (!page) return [];
  try {
    return JSON.parse(String(page.blocks));
  } catch {
    return [];
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
