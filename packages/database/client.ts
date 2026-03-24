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

// ── Prisma 6 + Driver Adapter Workaround ─────────────────────────
// Prisma 6 has a known bug with driver adapters:
//   - Engine requires a valid file: URL for "sqlite" provider
//   - Driver adapter rejects datasourceUrl/datasources overrides
//   - Engine loads .env file independently, overriding process.env swaps
//
// The ONLY reliable fix: swap process.env.DATABASE_URL at module load
// time AND patch it again right before PrismaClient instantiation
// (to survive Prisma's .env auto-loading).
const REAL_DATABASE_URL = process.env.DATABASE_URL ?? "";
const IS_LIBSQL = REAL_DATABASE_URL.startsWith("libsql://");
const PLACEHOLDER_URL = "file:/tmp/prisma-placeholder.db";

if (IS_LIBSQL) {
  process.env.DATABASE_URL = PLACEHOLDER_URL;
}

// ── Fail-fast: DATABASE_URL not set ──────────────────────────────
if (!REAL_DATABASE_URL) {
  const isVercel = !!process.env.VERCEL;
  const msg = isVercel
    ? "[database] DATABASE_URL is not set. For Vercel, use a Turso libsql:// URL. See docs/TURSO_SETUP.md"
    : "[database] DATABASE_URL is not set. Add it to packages/database/.env";
  console.error(`\n❌ ${msg}\n`);
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const logLevel: ("warn" | "error")[] =
    process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"];

  // If using Turso/libsql, use the driver adapter
  if (IS_LIBSQL) {
    // Re-enforce placeholder — Prisma's .env auto-loading may have
    // overridden our module-scope swap by this point.
    process.env.DATABASE_URL = PLACEHOLDER_URL;

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

    // @prisma/adapter-libsql v6.19+ takes a Config object (not a pre-built client).
    // It creates its own internal libsql client from this config.
    const adapter = new PrismaLibSQL({ url: tursoUrl, authToken });

    return new PrismaClient({ adapter, log: logLevel } as any);
  }

  // Default: local SQLite via file: URL
  // ⚠️ On Vercel, SQLite is ephemeral — data won't persist between deployments
  if (process.env.VERCEL && !IS_LIBSQL) {
    console.warn(
      "\n⚠️  [database] Using SQLite on Vercel — data is EPHEMERAL and will be lost between deployments!\n" +
      "   Set DATABASE_URL to a Turso libsql:// URL for persistent data.\n" +
      "   See: docs/TURSO_SETUP.md\n"
    );
  }
  return new PrismaClient({ log: logLevel });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
