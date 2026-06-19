/*
 * ApplicationComment repository — internal hiring-team discussion threads.
 *
 * Every method is tenant-scoped. Reads/lists filter by tenantId; delete is
 * author-AND-tenant scoped via deleteMany so a guessed/foreign id can never be
 * removed across tenants or by a non-author.
 */

import { prisma } from "../client";

export interface CreateCommentInput {
  tenantId: string;
  applicationId: string;
  authorId: string;
  body: string;
  /** userIds (already validated as tenant members) — stored as JSON. */
  mentions: string[];
}

const AUTHOR_SELECT = { author: { select: { id: true, name: true, email: true } } } as const;

export const commentRepo = {
  async listByApplication(applicationId: string, tenantId: string) {
    return prisma.applicationComment.findMany({
      where: { applicationId, tenantId },
      orderBy: { createdAt: "asc" },
      include: AUTHOR_SELECT,
    });
  },

  async create(input: CreateCommentInput) {
    return prisma.applicationComment.create({
      data: {
        tenantId: input.tenantId,
        applicationId: input.applicationId,
        authorId: input.authorId,
        body: input.body,
        mentions: JSON.stringify(input.mentions ?? []),
      },
      include: AUTHOR_SELECT,
    });
  },

  /** Delete a comment only if it belongs to this tenant AND this author. */
  async deleteOwn(id: string, tenantId: string, authorId: string) {
    const res = await prisma.applicationComment.deleteMany({ where: { id, tenantId, authorId } });
    return res.count;
  },
};
