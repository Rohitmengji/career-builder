# 🚀 Production Deployment Guide

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Vercel (Free Tier)                     │
│                                                           │
│  ┌─────────────────┐     ┌─────────────────┐            │
│  │   Admin App      │     │    Web App       │            │
│  │  (Vercel Proj 1) │     │  (Vercel Proj 2) │            │
│  │                   │     │                   │            │
│  │  /login           │     │  /landing         │            │
│  │  /editor          │     │  /[slug]          │            │
│  │  /api/pages       │     │  /jobs            │            │
│  │  /api/ai/*        │     │  /api/health      │            │
│  │  /api/stripe/*    │     │  /api/jobs        │            │
│  └────────┬──────────┘     └────────┬──────────┘            │
│           │                         │                       │
│           └─────────┬───────────────┘                       │
│                     │                                       │
│              ┌──────┴──────┐                                │
│              │   Database   │                                │
│              │  Turso/Neon  │                                │
│              │  (Free Tier) │                                │
│              └─────────────┘                                │
└─────────────────────────────────────────────────────────────┘
```

## Zero-Cost Stack

| Service | Free Tier Limits | Purpose |
|---------|-----------------|---------|
| **Vercel** | 100GB bandwidth, 100 hrs compute | Hosting both apps |
| **Turso** | 8GB storage, 500 DBs | Persistent SQLite (libsql) |
| **GitHub Actions** | 2,000 min/month | CI/CD pipeline |
| **Stripe** | Test mode free | Billing (test mode in preview) |
| **OpenAI** | Pay-per-use | AI generation |

## Step-by-Step Deployment

### 1. Database Setup (Turso — Recommended)

```bash
# Install Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

# Create database
turso db create career-builder

# Get connection URL
turso db show career-builder --url

# Create auth token
turso db tokens create career-builder

# Your DATABASE_URL will be:
# libsql://career-builder-<your-username>.turso.io?authToken=<token>
```

**Alternative: Neon PostgreSQL**
```bash
# 1. Go to https://neon.tech, create a project
# 2. Copy the connection string
# 3. Update schema.prisma: provider = "postgresql"
# 4. Run: npx prisma migrate dev
```

### 2. Vercel Setup

#### Project 1: Admin App
```bash
npm i -g vercel
cd apps/admin
vercel link  # Create new project, Framework: Next.js, Root: apps/admin
```

#### Project 2: Web App
```bash
cd apps/web
vercel link  # Create new project, Framework: Next.js, Root: apps/web
```

### 3. Environment Variables

#### Admin App (Vercel Dashboard → Settings → Environment Variables)

| Variable | Production | Preview | Description |
|----------|-----------|---------|-------------|
| `DATABASE_URL` | `libsql://...` | `libsql://...` | Same DB |
| `TENANT_ID` | `default` | `default` | Default tenant |
| `SESSION_SECRET` | `openssl rand -base64 32` | different value | **REQUIRED in production.** Different per env! |
| `NEXT_PUBLIC_APP_URL` | `https://admin.yourdomain.com` | *(empty — auto)* | **REQUIRED in production.** Admin URL |
| `NEXT_PUBLIC_SITE_URL` | `https://yourdomain.com` | *(empty — auto)* | Web URL |
| `OPENAI_API_KEY` | `sk-proj-...` | `sk-proj-...` | AI features |
| `STRIPE_SECRET_KEY` | `sk_live_...` | `sk_test_...` | **DIFFERENT per env!** |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | `whsec_...` | Stripe webhooks |
| `STRIPE_PRO_PRICE_ID` | `price_...` | `price_...` | Pro plan |
| `STRIPE_ENT_PRICE_ID` | `price_...` | `price_...` | Enterprise plan |

#### Web App

| Variable | Production | Preview |
|----------|-----------|---------|
| `DATABASE_URL` | `libsql://...` | `libsql://...` |
| `TENANT_ID` | `default` | `default` |
| `NEXT_PUBLIC_SITE_URL` | `https://yourdomain.com` | *(empty — auto)* |
| `ADMIN_API_URL` | `https://admin.yourdomain.com` | *(empty — auto)* |
| `NEXT_PUBLIC_APP_URL` | `https://admin.yourdomain.com` | *(empty — auto)* |

### 4. Deploy
```bash
git push origin main  # Vercel auto-deploys
```

### 5. Database Migration
```bash
DATABASE_URL="libsql://..." npx prisma db push
DATABASE_URL="libsql://..." npx tsx packages/database/seed.ts
```

### 6. Stripe Webhook
Add endpoint in Stripe Dashboard:
`https://admin.yourdomain.com/api/stripe/webhook`

Events: `checkout.session.completed`, `customer.subscription.*`, `invoice.*`

## CI/CD Pipeline

`.github/workflows/ci.yml` runs on every PR:
```
Install → Type Check → Lint → Build → ✅ Safe to merge (or ❌ Blocked)
```

Migration safety: destructive schema changes require `[migration-safe]` in PR description.

## Preview Deployments

Every PR gets preview URLs. Safety:
- Stripe live keys **rejected** — checkout/portal routes block `sk_live_` in preview envs
- Stripe uses TEST mode (via `VERCEL_ENV=preview`)
- URLs auto-resolve from `VERCEL_URL`
- No production data mutation
- `dev_plan_switcher` feature flag auto-disabled in production

## Rollback

1. Vercel Dashboard → Deployments → Find good deploy → "Promote to Production" (~1 sec)
2. Schema changes are additive-only (no destructive migrations)

## Health Checks

### Liveness (always available)
```
GET /api/health → { status: "ok" }
```

### Readiness (deployment orchestration)
```
GET /api/ready → { status: "ready", timestamp }       # 200
GET /api/ready → { status: "not_ready", reason }       # 503
```

The readiness probe checks:
1. **Database connectivity** — `checkDbHealth()` runs a lightweight query
2. **Required environment variables** — SESSION_SECRET, NEXT_PUBLIC_APP_URL present

Use `/api/ready` for:
- **Vercel Checks** — add as a Deployment Protection check
- **Kubernetes** — use as `readinessProbe`
- **Load balancers** — route traffic only to healthy instances
- **CI/CD** — verify deployment succeeded before flipping DNS

## Feature Flags

The platform includes a lightweight feature flag system (`lib/feature-flags.ts`):

| Flag | Default | Production | Description |
|------|---------|-----------|-------------|
| `ai_content_generation` | ✅ on | ✅ on | AI block content generation |
| `stripe_billing` | ✅ on | ✅ on | Stripe checkout and billing |
| `geo_pricing` | ✅ on | ✅ on | Geo-based pricing display |
| `dev_plan_switcher` | ✅ on | ❌ off | Dev-only plan switcher |
| `site_generator` | ✅ on | ✅ on | AI full-page generation |
| `job_ai` | ✅ on | ✅ on | AI job posting generation |
| `background_jobs` | ✅ on | ✅ on | Background job queue |

**Override via env vars:**
```bash
FEATURE_FLAG_AI_CONTENT_GENERATION=false  # Disable AI in this env
FEATURE_FLAG_STRIPE_BILLING=false         # Disable billing
```

## Background Jobs

The job queue (`lib/jobs/queue.ts`) with registered handlers (`lib/jobs/handlers.ts`):

| Handler | Schedule | What It Does |
|---------|----------|-------------|
| `audit-log-flush` | On-demand | Batch writes audit log entries |
| `webhook-retry` | On-demand | Retries failed webhook deliveries |
| `periodic-cleanup` | Daily (24h) | Deletes audit logs >90 days, analytics >180 days |

> **Note:** The job queue is in-memory. Jobs are lost on process restart. For production workloads, consider migrating to a durable queue (BullMQ + Redis, Inngest, or Trigger.dev).

## Stripe Safety

### Live Key Guard

Checkout and Portal routes **reject `sk_live_` Stripe keys** when the deploy environment is `"preview"` or `"development"`. This prevents real charges during:
- Vercel preview deployments
- Local development
- PR review environments

**Environment detection order:** `VERCEL_ENV` → `NODE_ENV` → `"development"`

### Webhook Idempotency

Stripe webhooks are idempotent via event ID deduplication:
- TTL: 10 minutes
- Max entries: 5,000
- Forced cleanup when cap exceeded

## Cost Optimization

- ISR caching (pages cached, not re-rendered per request)
- API response caching (30s jobs, 60s details)
- AI responses stored in DB (no re-generation)
- GrapesJS loaded client-side only (dynamic import)
- No server loops, minimal payloads
