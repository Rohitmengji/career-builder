/*
 * Prisma client singleton.
 *
 * In development, Next.js hot-reload would create a new PrismaClient on every
 * file change, quickly exhausting connections. This module caches the client
 * on `globalThis` so only one instance ever exists per process.
 *
 * Supports both local SQLite (file: URLs) and Turso/libsql (libsql: URLs).
 *
 * Usage:
 *   import { prisma } from "@career-builder/database/client";
 */

import { PrismaClient } from "@prisma/client";

// Prisma engine validates datasource URL against the provider at import time.
// For "sqlite" provider, it requires a "file:" URL. When using a Turso/libsql
// driver adapter, the engine doesn't actually use the URL — but still validates it.
// Save the real URL, then override so the engine validator passes.
const REAL_DATABASE_URL = process.env.DATABASE_URL ?? "";
if (REAL_DATABASE_URL.startsWith("libsql://")) {
  process.env.DATABASE_URL = "file:./placeholder.db";
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const logLevel: ("warn" | "error")[] =
    process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"];

  // If using Turso/libsql, use the driver adapter
  if (REAL_DATABASE_URL.startsWith("libsql://")) {
    const { createClient } = require("@libsql/client");
    const { PrismaLibSQL } = require("@prisma/adapter-libsql");

    // Auth token can be in the URL as ?authToken=... or as separate env var
    let tursoUrl = REAL_DATABASE_URL;
    let authToken = process.env.TURSO_AUTH_TOKEN;

    // Extract authToken from URL query params if present
    try {
      const parsed = new URL(REAL_DATABASE_URL);
      const urlToken = parsed.searchParams.get("authToken");
      if (urlToken) {
        authToken = urlToken;
        parsed.searchParams.delete("authToken");
        tursoUrl = parsed.toString();
      }
    } catch {
      // URL parsing failed — use as-is
    }

    const libsql = createClient({
      url: tursoUrl,
      authToken,
    });
    const adapter = new PrismaLibSQL(libsql);

    return new PrismaClient({ adapter, log: logLevel } as any);
  }

  // Default: local SQLite via file: URL
  return new PrismaClient({ log: logLevel });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
