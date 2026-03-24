/*
 * Prisma client singleton.
 *
 * In development, Next.js hot-reload would create a new PrismaClient on every
 * file change, quickly exhausting connections. This module caches the client
 * on `globalThis` so only one instance ever exists per process.
 *
 * Usage:
 *   import { prisma } from "@career-builder/database/client";
 */

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
