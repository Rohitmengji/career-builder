#!/usr/bin/env tsx
/*
 * Push schema to Turso database.
 *
 * Prisma CLI's `db push` doesn't work with libsql:// URLs (known Prisma 6 bug).
 * This script executes SQL against Turso instead.
 *
 * IMPORTANT: The CREATE TABLE / CREATE INDEX statements are NO LONGER
 * hand-maintained here. They are GENERATED from prisma/schema.prisma into
 * prisma/turso-schema.sql (run `npm run db:gen-turso-sql`). This script reads
 * that generated file, so the Turso DDL can never silently drift from the
 * Prisma schema again. CI enforces parity via `npm run db:verify-turso`.
 *
 * The MIGRATION_STATEMENTS below handle *existing* (older / previously-drifted)
 * deployments: additive ALTER TABLE / RENAME COLUMN statements that bring an
 * already-created table up to the current schema. They are idempotent —
 * "duplicate column" / "no such column" errors are caught and skipped.
 *
 * Usage:
 *   cd packages/database
 *   TURSO_DATABASE_URL="libsql://..." TURSO_AUTH_TOKEN="..." npx tsx push-turso.ts
 */

import { createClient } from "@libsql/client";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL || "";
const authToken = process.env.TURSO_AUTH_TOKEN || "";

if (!url.startsWith("libsql://")) {
  console.error("❌ Set TURSO_DATABASE_URL to your libsql:// URL");
  process.exit(1);
}

if (!authToken) {
  // Try extracting from URL query params
  try {
    const parsed = new URL(url);
    const token = parsed.searchParams.get("authToken");
    if (token) {
      console.log("  Using authToken from URL");
    } else {
      console.error("❌ Set TURSO_AUTH_TOKEN or include ?authToken= in your URL");
      process.exit(1);
    }
  } catch {
    console.error("❌ Set TURSO_AUTH_TOKEN");
    process.exit(1);
  }
}

// Extract authToken from URL if present
let cleanUrl = url;
let token = authToken;
try {
  const parsed = new URL(url);
  const urlToken = parsed.searchParams.get("authToken");
  if (urlToken) {
    token = urlToken;
    parsed.searchParams.delete("authToken");
    cleanUrl = parsed.toString();
  }
} catch {
  // use as-is
}

const client = createClient({ url: cleanUrl, authToken: token });

/**
 * Load the generated DDL (single source of truth = prisma/schema.prisma).
 * Split into individual statements and make each idempotent so re-running
 * against an existing database is a safe no-op.
 */
function loadSchemaStatements(): string[] {
  const sqlPath = join(__dirname, "prisma", "turso-schema.sql");
  let raw: string;
  try {
    raw = readFileSync(sqlPath, "utf8");
  } catch {
    console.error(
      `❌ Missing ${sqlPath}. Generate it first: npm run db:gen-turso-sql`
    );
    process.exit(1);
  }

  return raw
    // strip line comments so they don't ride along into execute()
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    // make idempotent: CREATE TABLE/INDEX -> CREATE ... IF NOT EXISTS
    .map((s) =>
      s
        .replace(/^CREATE TABLE "/i, 'CREATE TABLE IF NOT EXISTS "')
        .replace(/^CREATE INDEX "/i, 'CREATE INDEX IF NOT EXISTS "')
        .replace(/^CREATE UNIQUE INDEX "/i, 'CREATE UNIQUE INDEX IF NOT EXISTS "')
    );
}

const SQL_STATEMENTS = loadSchemaStatements();

// ── Migration statements ─────────────────────────────────────────
// Additive changes for EXISTING deployments whose tables were created by an
// older version of this script. On fresh deployments the columns already exist
// (created above) so these are caught-and-skipped no-ops.
const MIGRATION_STATEMENTS = [
  // auth-hardening: passwordChangedAt for session invalidation
  `ALTER TABLE "User" ADD COLUMN "passwordChangedAt" DATETIME`,
  // daily-credit-limit: daily AI usage tracking
  `ALTER TABLE "User" ADD COLUMN "aiDailyUsed" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "User" ADD COLUMN "aiDailyResetAt" DATETIME`,
  // version-history / draft-publish: Page columns
  `ALTER TABLE "Page" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE "Page" ADD COLUMN "title" TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE "Page" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "Page" ADD COLUMN "publishedBlocks" TEXT NOT NULL DEFAULT '[]'`,
  `ALTER TABLE "Page" ADD COLUMN "publishedVersion" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "Page" ADD COLUMN "publishedAt" DATETIME`,
  // Backfill: keep already-live pages live
  `UPDATE "Page" SET "publishedBlocks" = "blocks", "publishedVersion" = "version" WHERE "publishedBlocks" = '[]' AND "blocks" != '[]'`,
  // ── schema-parity fixes (previously missing from the hand-written DDL) ──
  // Job ATS-integration fields the app reads — their absence caused prod query failures.
  `ALTER TABLE "Job" ADD COLUMN "externalId" TEXT`,
  `ALTER TABLE "Job" ADD COLUMN "externalSource" TEXT`,
  `ALTER TABLE "Job" ADD COLUMN "externalUrl" TEXT`,
  // Application: resumePath + externalId were missing; appliedAt was misnamed.
  `ALTER TABLE "Application" ADD COLUMN "resumePath" TEXT`,
  `ALTER TABLE "Application" ADD COLUMN "externalId" TEXT`,
  // Rename the legacy column to match the Prisma schema (no-op on fresh DBs).
  `ALTER TABLE "Application" RENAME COLUMN "appliedAt" TO "submittedAt"`,
  // analytics-funnel: columns added to older AnalyticsEvent tables
  `ALTER TABLE "AnalyticsEvent" ADD COLUMN "type" TEXT`,
  `ALTER TABLE "AnalyticsEvent" ADD COLUMN "jobId" TEXT`,
  `ALTER TABLE "AnalyticsEvent" ADD COLUMN "pageSlug" TEXT`,
  `ALTER TABLE "AnalyticsEvent" ADD COLUMN "sessionId" TEXT`,
  `ALTER TABLE "AnalyticsEvent" ADD COLUMN "referrer" TEXT`,
  `ALTER TABLE "AnalyticsEvent" ADD COLUMN "utmSource" TEXT`,
  `ALTER TABLE "AnalyticsEvent" ADD COLUMN "utmMedium" TEXT`,
  `ALTER TABLE "AnalyticsEvent" ADD COLUMN "utmCampaign" TEXT`,
];

/** A column ALTER that fails because the column/table is already in the target state. */
function isAlreadyAppliedError(message: string | undefined): boolean {
  if (!message) return false;
  return (
    message.includes("duplicate column") ||
    message.includes("already exists") ||
    // RENAME COLUMN on a fresh DB: the legacy column isn't there.
    message.includes("no such column") ||
    message.includes("no such table")
  );
}

async function main() {
  console.log("🚀 Pushing schema to Turso (from generated prisma/turso-schema.sql)...\n");
  console.log(`  URL: ${cleanUrl.replace(/\/\/.*@/, "//***@")}`);
  console.log(`  Statements: ${SQL_STATEMENTS.length}`);

  let success = 0;
  let skipped = 0;

  for (const sql of SQL_STATEMENTS) {
    try {
      await client.execute(sql);
      success++;
    } catch (err: any) {
      if (err.message?.includes("already exists")) {
        skipped++;
      } else {
        console.error(`  ❌ Error: ${err.message}`);
        console.error(`     SQL: ${sql.slice(0, 100)}...`);
      }
    }
  }

  console.log(`\n  ✓ ${success} statements executed, ${skipped} skipped (already exist)`);

  // Run migration statements (safe: catches "duplicate column"/"no such column" errors)
  let migrated = 0;
  let alreadyApplied = 0;
  console.log("\n🔄 Running migrations...");

  for (const sql of MIGRATION_STATEMENTS) {
    try {
      await client.execute(sql);
      migrated++;
      console.log(`  ✓ ${sql.slice(0, 80)}...`);
    } catch (err: any) {
      if (isAlreadyAppliedError(err.message)) {
        alreadyApplied++;
      } else {
        console.error(`  ❌ Migration error: ${err.message}`);
        console.error(`     SQL: ${sql.slice(0, 100)}...`);
      }
    }
  }

  console.log(`  ✓ ${migrated} migrations applied, ${alreadyApplied} already applied`);

  console.log("\n✅ Schema pushed to Turso!\n");
  console.log("Next: Run seed-production.ts to create the admin user.");

  client.close();
}

main().catch((e) => {
  console.error("❌ Push failed:", e);
  process.exit(1);
});
