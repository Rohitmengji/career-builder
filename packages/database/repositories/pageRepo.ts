/*
 * Page Repository — CRUD for CMS pages.
 */

import { prisma } from "../client";

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
        updatedAt: true,
      },
    });
  },

  async upsert(
    slug: string,
    tenantId: string,
    blocks: string,
    title?: string,
  ) {
    return prisma.page.upsert({
      where: { slug_tenantId: { slug, tenantId } },
      create: {
        slug,
        title: title || slug,
        blocks,
        tenantId,
      },
      update: {
        blocks,
        ...(title ? { title } : {}),
      },
    });
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
