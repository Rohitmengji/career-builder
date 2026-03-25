#!/usr/bin/env tsx
/*
 * Push schema to Turso database.
 *
 * Prisma CLI's `db push` doesn't work with libsql:// URLs (known Prisma 6 bug).
 * This script extracts SQL from the Prisma schema and executes it against Turso.
 *
 * Usage:
 *   cd packages/database
 *   TURSO_DATABASE_URL="libsql://..." TURSO_AUTH_TOKEN="..." npx tsx push-turso.ts
 */

import { createClient } from "@libsql/client";

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

// SQL statements to create all tables (matching schema.prisma)
const SQL_STATEMENTS = [
  // Tenant
  `CREATE TABLE IF NOT EXISTS "Tenant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "theme" TEXT NOT NULL DEFAULT '{}',
    "branding" TEXT NOT NULL DEFAULT '{}',
    "settings" TEXT NOT NULL DEFAULT '{}',
    "plan" TEXT NOT NULL DEFAULT 'free',
    "isActive" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Tenant_domain_key" ON "Tenant"("domain")`,

  // User
  `CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "department" TEXT,
    "isActive" INTEGER NOT NULL DEFAULT 1,
    "lastLoginAt" DATETIME,
    "passwordChangedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "tenantId" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "subscriptionStatus" TEXT NOT NULL DEFAULT 'none',
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "stripePriceId" TEXT,
    "aiCredits" INTEGER NOT NULL DEFAULT 0,
    "aiCreditsResetAt" DATETIME,
    "billingCycleStart" DATETIME,
    "jobAiCredits" INTEGER NOT NULL DEFAULT 0,
    "jobAiCreditsResetAt" DATETIME,
    "aiDailyUsed" INTEGER NOT NULL DEFAULT 0,
    "aiDailyResetAt" DATETIME,
    CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "User_email_tenantId_key" ON "User"("email", "tenantId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "User_stripeCustomerId_key" ON "User"("stripeCustomerId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "User_stripeSubscriptionId_key" ON "User"("stripeSubscriptionId")`,
  `CREATE INDEX IF NOT EXISTS "User_tenantId_idx" ON "User"("tenantId")`,
  `CREATE INDEX IF NOT EXISTS "User_email_idx" ON "User"("email")`,

  // Job
  `CREATE TABLE IF NOT EXISTS "Job" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "department" TEXT NOT NULL DEFAULT '',
    "location" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "employmentType" TEXT NOT NULL DEFAULT 'full-time',
    "experienceLevel" TEXT NOT NULL DEFAULT 'mid',
    "salaryMin" INTEGER,
    "salaryMax" INTEGER,
    "salaryCurrency" TEXT NOT NULL DEFAULT 'USD',
    "salaryPeriod" TEXT NOT NULL DEFAULT 'yearly',
    "requirements" TEXT NOT NULL DEFAULT '[]',
    "niceToHave" TEXT NOT NULL DEFAULT '[]',
    "benefits" TEXT NOT NULL DEFAULT '[]',
    "tags" TEXT NOT NULL DEFAULT '[]',
    "isRemote" INTEGER NOT NULL DEFAULT 0,
    "isPublished" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "views" INTEGER NOT NULL DEFAULT 0,
    "postedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closesAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "tenantId" TEXT NOT NULL,
    CONSTRAINT "Job_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Job_slug_tenantId_key" ON "Job"("slug", "tenantId")`,
  `CREATE INDEX IF NOT EXISTS "Job_tenantId_idx" ON "Job"("tenantId")`,
  `CREATE INDEX IF NOT EXISTS "Job_isPublished_idx" ON "Job"("isPublished")`,

  // Application
  `CREATE TABLE IF NOT EXISTS "Application" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "resumeUrl" TEXT,
    "coverLetter" TEXT NOT NULL DEFAULT '',
    "linkedinUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'applied',
    "rating" INTEGER,
    "notes" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT 'direct',
    "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "jobId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    CONSTRAINT "Application_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Application_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "Application_jobId_idx" ON "Application"("jobId")`,
  `CREATE INDEX IF NOT EXISTS "Application_tenantId_idx" ON "Application"("tenantId")`,
  `CREATE INDEX IF NOT EXISTS "Application_status_idx" ON "Application"("status")`,

  // Page
  `CREATE TABLE IF NOT EXISTS "Page" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "blocks" TEXT NOT NULL DEFAULT '[]',
    "isPublished" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "tenantId" TEXT NOT NULL,
    CONSTRAINT "Page_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Page_slug_tenantId_key" ON "Page"("slug", "tenantId")`,
  `CREATE INDEX IF NOT EXISTS "Page_tenantId_idx" ON "Page"("tenantId")`,

  // AuditLog
  `CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "entity" TEXT,
    "entityId" TEXT,
    "details" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "tenantId" TEXT NOT NULL,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "AuditLog_tenantId_idx" ON "AuditLog"("tenantId")`,
  `CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt")`,

  // AnalyticsEvent
  `CREATE TABLE IF NOT EXISTS "AnalyticsEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "event" TEXT NOT NULL,
    "page" TEXT,
    "referrer" TEXT,
    "metadata" TEXT,
    "sessionId" TEXT,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,
    CONSTRAINT "AnalyticsEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "AnalyticsEvent_tenantId_idx" ON "AnalyticsEvent"("tenantId")`,
  `CREATE INDEX IF NOT EXISTS "AnalyticsEvent_event_idx" ON "AnalyticsEvent"("event")`,
  `CREATE INDEX IF NOT EXISTS "AnalyticsEvent_createdAt_idx" ON "AnalyticsEvent"("createdAt")`,

  // Webhook
  `CREATE TABLE IF NOT EXISTS "Webhook" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "url" TEXT NOT NULL,
    "events" TEXT NOT NULL DEFAULT '[]',
    "secret" TEXT,
    "isActive" INTEGER NOT NULL DEFAULT 1,
    "lastTriggeredAt" DATETIME,
    "failCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "tenantId" TEXT NOT NULL,
    CONSTRAINT "Webhook_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "Webhook_tenantId_idx" ON "Webhook"("tenantId")`,

  // AppConfig (key-value settings store)
  `CREATE TABLE IF NOT EXISTS "AppConfig" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
];

// ── Migration statements ─────────────────────────────────────────
// These ALTER TABLE statements add columns that may be missing from
// older deployments. SQLite will throw "duplicate column" if the column
// already exists — we catch and skip those errors.
const MIGRATION_STATEMENTS = [
  // Added in auth-hardening: passwordChangedAt for session invalidation
  `ALTER TABLE "User" ADD COLUMN "passwordChangedAt" DATETIME`,
  // Added in daily-credit-limit: daily AI usage tracking
  `ALTER TABLE "User" ADD COLUMN "aiDailyUsed" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "User" ADD COLUMN "aiDailyResetAt" DATETIME`,
];

async function main() {
  console.log("🚀 Pushing schema to Turso...\n");
  console.log(`  URL: ${cleanUrl.replace(/\/\/.*@/, "//***@")}`);

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

  // Run migration statements (safe: catches "duplicate column" errors)
  let migrated = 0;
  let alreadyApplied = 0;
  console.log("\n🔄 Running migrations...");

  for (const sql of MIGRATION_STATEMENTS) {
    try {
      await client.execute(sql);
      migrated++;
      console.log(`  ✓ ${sql.slice(0, 80)}...`);
    } catch (err: any) {
      if (
        err.message?.includes("duplicate column") ||
        err.message?.includes("already exists")
      ) {
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
