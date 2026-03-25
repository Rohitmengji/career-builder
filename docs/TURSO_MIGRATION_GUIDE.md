# Turso Production Migration Guide

> **CRITICAL:** Every Prisma schema change requires a manual migration on the production Turso DB.
> Local `npm run db:push` only updates your local SQLite — it does NOT touch production.

## The Golden Rule

```
Schema change in schema.prisma  →  Local db:push  →  Turso ALTER TABLE  →  push-turso.ts update  →  Build  →  Push
```

**Skip any step = production 500 errors.**

## What Happened (March 25, 2026)

Production login was broken (500 Internal Server Error) for ALL users because:

1. `aiDailyUsed` and `aiDailyResetAt` columns were added to `schema.prisma`
2. `npm run db:push` was run locally (updated local SQLite dev.db)
3. **Turso production DB was never migrated** — missing columns
4. Prisma client (generated from updated schema) tried to SELECT those columns
5. Turso returned `"no such column: main.User.aiDailyUsed"` → 500

### Root Cause
The Prisma client is compiled at build time from `schema.prisma`. When deployed to Vercel, it queries ALL columns defined in the schema. If the production DB is missing any column, every query touching that table crashes.

## Step-by-Step: Adding a Column to Production

### 1. Update Prisma Schema
```prisma
// packages/database/prisma/schema.prisma
model User {
  // ...existing fields...
  newColumn String? // Add your new column
}
```

### 2. Push to Local DB
```bash
npm run db:push
```

### 3. Regenerate Prisma Types
```bash
npm run regen
# Or: ./scripts/prisma-regen.sh
```

### 4. Migrate Production Turso DB
```bash
# Option A: Turso CLI shell
echo 'ALTER TABLE "User" ADD COLUMN "newColumn" TEXT;' | turso db shell career-builder

# Option B: Run push-turso.ts (handles all pending migrations)
cd packages/database
TURSO_DATABASE_URL="libsql://career-builder-rohitmengji.aws-ap-south-1.turso.io" \
TURSO_AUTH_TOKEN="YOUR_TOKEN" \
npx tsx push-turso.ts
```

### 5. Update push-turso.ts
Add the column to BOTH:
- The `CREATE TABLE` statement (for fresh deployments)
- The `MIGRATION_STATEMENTS` array (for existing deployments)

### 6. Build & Verify
```bash
npm run build  # MUST pass before pushing
```

### 7. Commit & Push
```bash
git add -A && git commit -m "feat: add newColumn to User" && git push personal main
```

## Verifying Production DB Schema

```bash
# List all columns on User table
echo 'PRAGMA table_info("User");' | turso db shell career-builder

# List all tables
echo "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;" | turso db shell career-builder

# Check if a specific column exists
echo 'SELECT aiDailyUsed FROM "User" LIMIT 1;' | turso db shell career-builder
```

## Checking Vercel Logs for DB Errors

```bash
# Link to the correct project first
vercel link --yes --project career-builder-admin

# Stream logs
vercel logs https://career-builder-admin.vercel.app 2>&1 | head -100
```

## Vercel Project Structure

There are **separate Vercel projects** — set env vars on the right one:

| Project | URL | Purpose |
|---------|-----|---------|
| `career-builder-admin` | `career-builder-admin.vercel.app` | Admin app (port 3001) |
| `career-builder-web` | `career-builder-web.vercel.app` | Public site (port 3000) |
| `career-builder` | `career-builder-lac.vercel.app` | **Unused** — no production deployment |

Both `admin` and `web` share the same Turso database.

## Environment Variables

Set on **each Vercel project separately** via:
- Vercel Dashboard → Project → Settings → Environment Variables
- Or: `vercel link --yes --project <name> && vercel env add VAR_NAME production`

### Required for career-builder-admin:
| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | ✅ | `libsql://...?authToken=...` |
| `TENANT_ID` | ✅ | Default: `"default"` |
| `SESSION_SECRET` | ✅ (prod) | 32+ chars, `openssl rand -base64 32` |
| `NEXT_PUBLIC_APP_URL` | ✅ (prod) | `https://career-builder-admin.vercel.app` |
| `OPENAI_API_KEY` | Optional | For AI features |
| `STRIPE_SECRET_KEY` | Optional | For billing |

### Required for career-builder-web:
| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | ✅ | Same Turso URL as admin |
| `TENANT_ID` | ✅ | Same as admin |
| `NEXT_PUBLIC_SITE_URL` | Optional | `https://career-builder-web.vercel.app` |

## Health Check

```bash
curl -s https://career-builder-admin.vercel.app/api/health | python3 -m json.tool
```

> **Note:** The health endpoint may report `"provider": "sqlite"` even when using Turso.
> This is a cosmetic bug — `client.ts` swaps `DATABASE_URL` to a placeholder for Prisma 6 compatibility.
> The actual connection IS Turso. Verify by checking `"healthy": true` and that queries work.

## Pre-Deploy Checklist

Before every deployment that touches `schema.prisma`:

- [ ] `npm run db:push` — local schema updated
- [ ] `npm run regen` — Prisma types regenerated
- [ ] Turso `ALTER TABLE` — production DB migrated
- [ ] `push-turso.ts` — CREATE TABLE + MIGRATION_STATEMENTS updated
- [ ] `npm run build` — full build passes
- [ ] `git push` — code deployed
- [ ] `curl /api/health` — production healthy
- [ ] Test affected feature on production
