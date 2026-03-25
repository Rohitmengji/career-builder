# 🗄️ Database Architecture — Prisma 6 + SQLite/Turso

> **This document explains the database layer in detail, including the Prisma 6 driver adapter workaround, schema migration workflow, and production debugging.**

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                  packages/database/                      │
│                                                         │
│  schema.prisma ──→ prisma generate ──→ .prisma/client   │
│                                                         │
│  client.ts ─────→ PrismaClient (singleton)              │
│       │                                                 │
│       ├─ file:   URL → Standard SQLite driver           │
│       └─ libsql: URL → @prisma/adapter-libsql (Turso)  │
│                                                         │
│  resilience.ts ─→ withDbRetry() wrapper                 │
│                                                         │
│  repositories/ ─→ 10 repository modules                 │
│       tenantRepo, userRepo, jobRepo, applicationRepo,   │
│       pageRepo, analyticsRepo, auditRepo, webhookRepo,  │
│       subscriptionRepo, index                           │
│                                                         │
│  types.ts ──────→ Domain types + enum unions             │
│  seed.ts ───────→ Sample data seeder                    │
└─────────────────────────────────────────────────────────┘
```

---

## Prisma 6 Driver Adapter — The Workaround

### The Problem

Prisma 6 has a **known design mismatch** between three subsystems:

| Component | Behavior |
|-----------|----------|
| **Engine** | Requires a valid `file:` URL when `provider = "sqlite"` |
| **Driver Adapter** | Rejects `datasourceUrl` and `datasources` overrides |
| **Client** | Embeds `DATABASE_URL` at `prisma generate` time AND auto-loads `.env` files at runtime |

This means:
- You can't pass Turso URLs directly (engine complains about non-file: URL)
- You can't override the URL at runtime (adapter rejects it)
- Changing `process.env.DATABASE_URL` isn't enough (Prisma re-reads `.env` internally)

### The Solution (`client.ts`)

```typescript
// 1. Capture real URL at module load time (before Prisma touches it)
const REAL_DATABASE_URL = process.env.DATABASE_URL ?? "";
const IS_LIBSQL = REAL_DATABASE_URL.startsWith("libsql://");

// 2. Swap to placeholder so engine is happy (for Turso mode)
if (IS_LIBSQL) {
  process.env.DATABASE_URL = "file:/tmp/prisma-placeholder.db";
}

function createPrismaClient() {
  if (IS_LIBSQL) {
    // 3. Re-enforce swap (Prisma may have re-read .env by now)
    process.env.DATABASE_URL = "file:/tmp/prisma-placeholder.db";

    // 4. Create adapter with REAL Turso URL
    const adapter = new PrismaLibSQL({ url: tursoUrl, authToken });
    return new PrismaClient({ adapter });
  }

  // Standard SQLite — no adapter needed
  return new PrismaClient();
}
```

### Why This Works

1. The engine sees `file:/tmp/prisma-placeholder.db` → doesn't complain
2. The adapter receives the real Turso URL → connects to actual database
3. No `datasourceUrl`/`datasources` override → adapter doesn't reject the config
4. Module-scope swap + pre-instantiation re-enforcement → survives Prisma's `.env` auto-loading

---

## Schema (9 Models)

| Model | Tenant-Isolated | Key Fields | Purpose |
|-------|:-:|---|---|
| **Tenant** | — (is tenant) | theme, branding, settings (JSON), plan | Company configuration |
| **User** | ✅ | email, passwordHash, role, plan, stripeCustomerId, aiCredits | Auth + billing |
| **Job** | ✅ | slug, department, requirements (JSON), isPublished | Job postings |
| **Application** | ✅ | firstName, lastName, email, resumeUrl, status, rating | Job applications |
| **Page** | ✅ | slug, blocks (JSON), isPublished | Visual editor pages |
| **AuditLog** | ✅ | action, entity, details, userId | Mutation audit trail |
| **AnalyticsEvent** | ✅ | type, jobId, sessionId, utmSource | Traffic analytics |
| **Webhook** | ✅ | url, events (JSON), secret, isActive | Outbound integrations |
| **AppConfig** | — (global) | key, value | Dynamic configuration |

### Multi-Tenant Isolation

Every entity with `tenantId` has:
- `@@index([tenantId])` for efficient filtering
- `@@unique([slug, tenantId])` or `@@unique([email, tenantId])` for per-tenant uniqueness
- Cascading deletes: `onDelete: Cascade` from Tenant → all child entities

---

## Resilience Layer

### `withDbRetry(fn, options?)`

Wraps database operations with automatic retry on transient errors:

| Error Code | Meaning | Retried? |
|-----------|---------|:--------:|
| `SQLITE_BUSY` | Database locked (concurrent writes) | ✅ |
| `SQLITE_LOCKED` | Table locked | ✅ |
| `P2024` | Prisma: timed out fetching connection | ✅ |
| `P2034` | Prisma: write conflict (optimistic locking) | ✅ |

**Backoff schedule:** 50ms → 100ms → 250ms → 500ms → 1000ms (5 retries max)

### Where It's Used

All critical subscription operations in `subscriptionRepo.ts`:
- `activateSubscription()` — Stripe webhook callback
- `updateStatus()` — status changes (past_due, canceled)
- `decrementCredit()` — atomic AI credit deduction
- `decrementJobCredit()` — atomic job AI credit deduction
- `resetCredits()` — billing cycle renewal
- `resetJobCredits()` — weekly job credit reset

---

## Repository Pattern

All data access goes through repositories. **No direct Prisma calls from components or route handlers.**

```
Route Handler → Repository → Prisma Client → Database
```

### Exports

```typescript
import { prisma, jobRepo, subscriptionRepo } from "@career-builder/database";
```

### Key Repository Methods

| Repository | Critical Methods |
|-----------|-----------------|
| `subscriptionRepo` | `canUseAi()`, `decrementCredit()` (atomic via `updateMany`), `activateSubscription()` |
| `jobRepo` | `search(filters)` with pagination + facets, `findBySlug()` |
| `pageRepo` | `upsert(slug, tenantId, blocksJson)`, `findBySlug()` |
| `auditRepo` | `log(input)` — all mutations logged |
| `analyticsRepo` | `track(event)` — job views, searches, applications |

---

## Migration Workflow

### Local Development

```bash
# 1. Edit schema.prisma
# 2. Push to local SQLite
cd packages/database
npx prisma db push

# 3. Regenerate types
npx prisma generate
# Or from root: npm run regen
```

### Production (Turso)

```bash
# 1-3: Same as local
# 4. Manually migrate Turso
echo 'ALTER TABLE "User" ADD COLUMN "newField" TEXT;' | turso db shell career-builder

# 5. Update push-turso.ts (both CREATE TABLE and MIGRATION_STATEMENTS)
# 6. Build and verify
npm run build

# 7. Deploy
git push
```

> **⚠️ CRITICAL:** `npm run db:push` only updates LOCAL SQLite. It does NOT touch production Turso. You MUST run `ALTER TABLE` manually. See `docs/TURSO_MIGRATION_GUIDE.md`.

---

## Debugging

### Check Production DB Health

```bash
curl -s https://career-builder-admin.vercel.app/api/health | python3 -m json.tool
```

### Verify Column Exists

```bash
echo 'PRAGMA table_info("User");' | turso db shell career-builder
```

### Check Vercel Logs for DB Errors

```bash
vercel link --yes --project career-builder-admin
vercel logs https://career-builder-admin.vercel.app 2>&1 | head -100
```

### Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `URL 'undefined'` | `DATABASE_URL` not set or Prisma re-loaded stale `.env` | Set absolute path. Run `rm -rf node_modules/.prisma && npx prisma generate` |
| `no such column: main.User.xxx` | Schema updated but Turso not migrated | Run `ALTER TABLE` on Turso |
| `SQLITE_BUSY` | Concurrent writes to SQLite | Operations wrapped with `withDbRetry()` — should auto-recover |
| `P2025: Record not found` | Stale session references deleted user | All repos handle P2025 gracefully |

### Nuclear Reset (Local Only)

```bash
cd packages/database
rm -rf node_modules/.prisma
rm -rf ../../node_modules/.prisma
rm -f prisma/dev.db
npx prisma generate
npx prisma db push
npx tsx seed.ts
```

---

## Configuration

### `.env` (packages/database/)

```properties
# MUST be absolute path for SQLite
DATABASE_URL="file:/Users/yourname/Desktop/career-builder/packages/database/prisma/dev.db"
```

### Production (Vercel Environment Variables)

```properties
# Turso libsql URL with auth token
DATABASE_URL="libsql://career-builder-yourname.turso.io?authToken=eyJ..."
```

### Schema Provider

```prisma
datasource db {
  provider = "sqlite"    # ← Keep as "sqlite" even for Turso
  url      = env("DATABASE_URL")
}
```

The provider stays `"sqlite"` because:
1. Turso is SQLite-compatible (it's a libsql fork of SQLite)
2. Prisma doesn't have a `"libsql"` provider
3. The driver adapter handles the actual connection to Turso
