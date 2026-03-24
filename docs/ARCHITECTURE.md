# Architecture Overview

> How the Career Builder system is designed, how data flows, and why decisions were made.

---

## 🏛️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          MONOREPO (Turborepo)                           │
│                                                                         │
│  ┌──────────────────────────┐    ┌──────────────────────────┐          │
│  │   apps/admin (:3001)     │    │   apps/web (:3000)       │          │
│  │                          │    │                          │          │
│  │  ┌────────────────────┐  │    │  ┌────────────────────┐  │          │
│  │  │  GrapesJS Editor   │  │    │  │    Renderer        │  │          │
│  │  │  (drag & drop)     │──┼─SSE──│  (25+ blocks)      │  │          │
│  │  └────────────────────┘  │    │  └────────────────────┘  │          │
│  │  ┌────────────────────┐  │    │  ┌────────────────────┐  │          │
│  │  │  Admin APIs        │  │    │  │  Job System        │  │          │
│  │  │  (auth, pages,     │  │    │  │  (search, apply,   │  │          │
│  │  │   jobs, metrics)   │  │    │  │   detail, API)     │  │          │
│  │  └────────────────────┘  │    │  └────────────────────┘  │          │
│  │  ┌────────────────────┘  │    │  ┌────────────────────┐  │          │
│  │  │  Auth + RBAC       │  │    │  │  ThemeProvider      │  │          │
│  │  └────────────────────┘  │    │  └────────────────────┘  │          │
│  │  ┌────────────────────┐  │    │  ┌────────────────────┐  │          │
│  │  │  Observability UI  │  │    │  │  Tenant Pages       │  │          │
│  │  │  (/observability)  │  │    │  │  (/[slug]/jobs/*)   │  │          │
│  │  └────────────────────┘  │    │  └────────────────────┘  │          │
│  │  ┌────────────────────┐  │    │  ┌────────────────────┐  │          │
│  │  │  Edge Middleware   │  │    │  │  Edge Middleware     │  │          │
│  │  │  (rate limit,CSRF) │  │    │  │  (rate limit,CSRF)  │  │          │
│  │  └────────────────────┘  │    │  └────────────────────┘  │          │
│  └──────────────────────────┘    └──────────────────────────┘          │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                  packages/ (shared libraries)                    │   │
│  │                                                                  │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌──────────────┐ ┌──────────┐ │   │
│  │  │ database    │ │ security    │ │ observability│ │ tenant-  │ │   │
│  │  │ Prisma ORM  │ │ Sanitize,   │ │ Logger, Met- │ │ config   │ │   │
│  │  │ 8 repos     │ │ Zod, CSP,   │ │ rics, Alerts,│ │ Themes,  │ │   │
│  │  │ SQLite      │ │ Rate limit, │ │ Tracing, Bot │ │ Tokens,  │ │   │
│  │  │             │ │ Crypto      │ │ detection    │ │ Validate │ │   │
│  │  └─────────────┘ └─────────────┘ └──────────────┘ └──────────┘ │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │              SQLite Database (packages/database/prisma/dev.db)    │   │
│  │  Tenant │ User │ Job │ Application │ Page │ AuditLog │ ...       │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Data Flow Diagrams

### 1. Page Editing Flow

```
Admin User                  Admin App (:3001)                 Web App (:3000)
    │                            │                                │
    │  drag block into canvas    │                                │
    ├───────────────────────────►│                                │
    │                            │  POST /api/pages               │
    │                            │  save to data/pages/slug.json  │
    │                            │                                │
    │                            │  POST /api/preview (SSE push)  │
    │                            ├───────────────────────────────►│
    │                            │                                │  re-render blocks
    │                            │                                │  in real-time
    │                            │                                │
```

### 2. Job Search Flow

```
Visitor                     Web App (:3000)                   Job Engine
    │                            │                                │
    │  GET /jobs?q=engineer      │                                │
    ├───────────────────────────►│                                │
    │                            │  useJobSearch hook (debounced) │
    │                            │  GET /api/jobs?q=engineer      │
    │                            ├───────────────────────────────►│
    │                            │                                │ filter → search
    │                            │                                │ → facets → sort
    │                            │                                │ → paginate
    │                            │◄───────────────────────────────┤
    │                            │  { jobs, facets, pagination }  │
    │◄───────────────────────────┤                                │
    │  render job cards + facets │                                │
```

### 3. Job Application Flow

```
Applicant                   Web App (:3000)                   File System
    │                            │                                │
    │  Fill form + upload resume │                                │
    ├───────────────────────────►│                                │
    │                            │  POST /api/jobs/apply          │
    │                            │  (multipart/form-data)         │
    │                            │                                │
    │                            │  validate fields + file        │
    │                            │  save resume to data/resumes/  │
    │                            ├───────────────────────────────►│
    │                            │                                │
    │                            │  provider.apply(application)   │
    │◄───────────────────────────┤                                │
    │  { success, applicationId }│                                │
```

### 4. Multi-Tenant Theming Flow

```
Tenant Config               ThemeProvider                     Block Components
    │                            │                                │
    │  TenantTheme object        │                                │
    ├───────────────────────────►│                                │
    │                            │  normalizeTheme()              │
    │                            │  validateBranding()            │
    │                            │  getDesignTokens()             │
    │                            │                                │
    │                            │  inject CSS custom properties  │
    │                            │  load Google Fonts             │
    │                            │                                │
    │                            │  useTheme() → { tokens }      │
    │                            ├───────────────────────────────►│
    │                            │                                │ tokens.colors.primary
    │                            │                                │ tokens.button.radiusClass
    │                            │                                │ getAccent("blue")
```

### 5. AI Content Generation Flow

```
Admin User                  AiAssistant.tsx                   POST /api/ai              OpenAI
    │                            │                                │                        │
    │  click "Generate"          │                                │                        │
    ├───────────────────────────►│                                │                        │
    │                            │  POST /api/ai                  │                        │
    │                            │  { action, blockType, data }   │                        │
    │                            ├───────────────────────────────►│                        │
    │                            │                                │ getSession() → userId  │
    │                            │                                │ canUseAi(userId) ──────│
    │                            │                                │   ← allowed: true      │
    │                            │                                │                        │
    │                            │                                │ buildPrompt(action)    │
    │                            │                                ├───────────────────────►│
    │                            │                                │                        │ GPT-5.4-mini
    │                            │                                │◄───────────────────────┤
    │                            │                                │ parseAiJson()          │
    │                            │                                │ validateAiOutput()     │
    │                            │                                │ decrementCredit(userId)│
    │                            │◄───────────────────────────────┤                        │
    │                            │  { success, data }             │                        │
    │  side-by-side diff preview │                                │                        │
    │◄───────────────────────────┤                                │                        │
    │  select fields → Apply     │                                │                        │
```

### 6. Stripe Subscription Flow

```
Admin User          UpgradeModal          /api/stripe/checkout      Stripe          /api/stripe/webhook
    │                    │                      │                      │                    │
    │  click "Pro"       │                      │                      │                    │
    ├───────────────────►│                      │                      │                    │
    │                    │  POST { plan: "pro" }│                      │                    │
    │                    ├─────────────────────►│                      │                    │
    │                    │                      │ create/get customer  │                    │
    │                    │                      ├─────────────────────►│                    │
    │                    │                      │ create checkout      │                    │
    │                    │                      │◄─────────────────────┤                    │
    │                    │◄─────────────────────┤                      │                    │
    │                    │  redirect to url     │                      │                    │
    │  Stripe payment    │                      │                      │                    │
    ├────────────────────────────────────────────────────────────────►│                    │
    │                    │                      │                      │ checkout.completed │
    │                    │                      │                      ├───────────────────►│
    │                    │                      │                      │                    │ activateSubscription
    │                    │                      │                      │                    │ set credits=500
    │  redirect back     │                      │                      │                    │
    │  /editor?checkout=success                 │                      │                    │
    │                    │                      │                      │                    │
    │  useSubscription() │                      │                      │                    │
    │  GET /api/subscription → plan=pro, credits=500                  │                    │
```

---

## 🧱 Core Architecture Patterns

### 1. Schema-Driven Blocks

Every visual block (Hero, Job List, Features, etc.) is defined by a **single schema** in `blockSchemas.ts`. This schema drives:

- **Admin sidebar** — form fields auto-generated from schema
- **GrapesJS registration** — block registered with default props
- **Frontend rendering** — `renderer.tsx` maps block type → React component

```
blockSchemas.ts (source of truth)
    │
    ├──► registerHeroBlock.tsx (GrapesJS block)
    ├──► Sidebar.tsx (auto-generated form)
    └──► renderer.tsx → HeroBlock component
```

**To add a new block type:**
1. Add schema in `blockSchemas.ts`
2. Create `registerXBlock.ts` in `apps/admin/app/editor/blocks/`
3. Import & call in `apps/admin/app/editor/page.tsx`
4. Add renderer component in `apps/web/lib/renderer.tsx`

### 2. Provider Pattern (Jobs)

The job system uses an **abstract provider interface** so the data source can be swapped:

```typescript
interface JobDataProvider {
  search(params: JobSearchParams): Promise<JobSearchResponse>;
  getById(id: string, tenantId?: string): Promise<JobDetailResponse>;
  apply(application: JobApplication): Promise<ApplyResponse>;
}
```

Currently: `MockJobProvider` (in-memory data)
Future: `GreenhouseProvider`, `LeverProvider`, `WorkdayProvider`

### 3. Design Token System (Theming)

Raw tenant theme → **normalize** → **validate** → **design tokens** → components

```
TenantTheme (raw input, may be partial/invalid)
    │
    ▼
normalizeTheme() — fills missing fields with defaults
    │
    ▼
validateTheme() — validates hex colors, enums; logs warnings in dev
    │
    ▼
getDesignTokens() — computes pre-built CSS classes, styles, and color values
    │
    ▼
Components use tokens.colors.primary, tokens.button.radiusClass, etc.
```

### 4. BFF (Backend for Frontend) APIs

Each API route is a thin orchestration layer:

```
Browser → /api/jobs?q=... → parse params → JobProvider.search() → JSON response
                                                    │
                                              query engine:
                                              filter → search → facets → sort → paginate
```

The BFF pattern means:
- Frontend only talks to `/api/*` routes (never directly to data layer)
- API routes handle validation, caching headers, error normalization
- Data source can be swapped without touching frontend code

---

## 🔐 Authentication Architecture

```
Login Form → POST /api/auth { email, password, csrf }
    │
    ▼
Rate limiter (5 attempts / 60s per IP)
    │
    ▼
bcrypt-style hash comparison (crypto.subtle)
    │
    ▼
HMAC-signed session cookie (7-day sliding expiry)
+ CSRF double-submit cookie
    │
    ▼
Audit log entry written to AuditLog table (via Prisma)
```

**Roles:**
| Role | Permissions |
|------|------------|
| `admin` | Full access: users, themes, pages, settings, observability |
| `hiring_manager` | Manage jobs and applications in their department |
| `recruiter` | View and manage applications across jobs |
| `viewer` | Read-only access to admin dashboard |

**Session handling:**
- `getSession()` — reads session + renews cookie (for mutations)
- `getSessionReadOnly()` — reads session without cookie write (for Server Components)

---

## 📡 API Route Map

### Admin APIs (port 3001)

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/auth` | Login / logout / session check. Rate-limited, CSRF-protected. Uses `withRequestLogging`. |
| GET/POST | `/api/pages` | List pages / save page blocks. Triggers SSE preview push. Writes audit log. |
| GET/POST/DELETE | `/api/tenants` | CRUD for tenant configs. GET accepts `?id=tenantId`. |
| GET/POST | `/api/preview` | GET = SSE stream (clients subscribe). POST = push update to all subscribers. |
| GET/POST/PUT/DELETE | `/api/users` | User management. Admin-only. |
| POST | `/api/media` | File upload for images. Saves to `data/media/`. |
| GET | `/api/media/file/[filename]` | Serve uploaded media files with proper content-type. |
| GET | `/api/audit` | Read audit log. Admin-only. |
| GET/POST | `/api/admin/metrics` | **Observability dashboard data.** GET returns metrics snapshot, history, anomaly stats, alerts, blocked IPs, budget violations. POST accepts admin actions (`unblock_ip`). |
| GET/POST/PUT/DELETE | `/api/admin/jobs` | Admin job CRUD. Create, update, publish/unpublish, delete jobs. |
| GET/PUT | `/api/admin/applications` | View and update job applications. Filter by status, job, date. |
| GET | `/api/admin/analytics` | Analytics data — job views, application stats, conversion rates. |
| GET | `/api/health` | Health check endpoint. Returns `{ status: "ok" }`. |
| POST | `/api/ai` | AI content generation. Auth + subscription + rate-limited. 5 actions. Dual OpenAI API support. |
| POST | `/api/stripe/checkout` | Create Stripe Checkout Session. Idempotency key, duplicate sub prevention. Returns `{ url }`. |
| POST | `/api/stripe/portal` | Create Stripe Billing Portal session. Auth + role-gated. Self-service: manage/cancel subscription, update payment, view invoices. Returns `{ url }`. |
| POST | `/api/stripe/webhook` | Stripe webhook handler. Signature-verified, idempotent, handles 5 event types. |
| GET | `/api/subscription` | Server-side subscription status. Returns plan, credits, status, hasStripeCustomer, billing dates. |
| GET | `/api/geo` | Server-side IP geolocation (fallback for CSP-blocked clients). |
| POST | `/api/dev/set-plan` | **Dev-only.** Directly sets user plan in DB for testing subscription gating. Hard-blocked in production. |

### Web APIs (port 3000)

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/jobs` | Search jobs with filters, facets, pagination |
| GET | `/api/jobs/[id]` | Get job detail + related jobs |
| POST | `/api/jobs/apply` | Submit application (multipart or JSON) |
| GET | `/api/health` | Health check endpoint |

### Admin Pages (port 3001)

| Route | Purpose |
|-------|---------|
| `/` | Main landing — redirects to editor or login |
| `/login` | Login form |
| `/editor` | GrapesJS visual page editor + AI Assistant panel + subscription gating + checkout redirect handling |
| `/dashboard` | Admin overview dashboard |
| `/jobs` | Job management — list, create, edit, publish + AI Job Assistant |
| `/applications` | Application tracking — view, filter, update status |
| `/settings` | Tenant settings and configuration |
| `/theme` | Theme customization UI |
| `/observability` | Real-time observability dashboard — metrics, alerts, blocked IPs, performance budgets |

### Web Pages (port 3000)

| Route | Purpose |
|-------|---------|
| `/` | Landing page |
| `/[slug]` | Dynamic SSR page — renders saved blocks via ThemeProvider + RenderPage |
| `/[slug]/jobs/[jobId]` | Tenant-scoped job detail page |
| `/[slug]/jobs/[jobId]/apply` | Tenant-scoped application form |
| `/jobs` | Job search page — search bar, facet filters, job cards, pagination |
| `/jobs/[id]` | Job detail page — SSR for SEO, requirements, benefits, related jobs |

---

## 🗄️ Database Architecture

### Prisma + SQLite

The platform uses **Prisma ORM** with SQLite for development. The database lives at `packages/database/prisma/dev.db`.

```
DATABASE_URL=file:/absolute/path/to/packages/database/prisma/dev.db
```

> **Important:** All three `.env` files (root, admin, web) must use **absolute paths** to the SQLite file. Relative `file:./dev.db` breaks when Next.js runs from the app directory.

### Schema (8 models)

```
┌──────────┐    ┌────────────────────┐    ┌──────────────┐
│  Tenant  │◄───│       User         │    │  Application │
│          │◄───│                    │    │              │
│ id       │    │ id                 │    │ id           │
│ name     │    │ email              │    │ firstName    │
│ domain   │    │ name               │    │ email        │
│ theme {} │    │ role               │    │ status       │
│ branding │    │ tenantId           │    │ resumePath   │
│ plan     │    │─── Billing ────────│    │ jobId ──────────► Job
│          │    │ plan (free|pro|ent)│    │ tenantId     │
│          │    │ stripeCustomerId   │    └──────────────┘
│          │    │ stripeSubscriptionId│
│          │    │ stripePriceId      │
│          │    │ subscriptionStatus │
│          │    │ aiCredits          │
│          │    │ aiCreditsResetAt   │
│          │    │ billingCycleStart  │
│          │    └────────────────────┘
│          │◄───┌──────────┐
│          │    │   Job    │    ┌──────────────┐
│          │    │ title    │    │  AuditLog    │
│          │    │ dept     │    │ action       │
│          │    │ location │    │ entity       │
│          │    │ salary*  │    │ details {}   │
│          │    │ isPubl.  │    │ userId ──────────► User
│          │    │ tenantId │    │ tenantId     │
│          │    └──────────┘    └──────────────┘
│          │
│          │◄───┌──────────┐    ┌──────────────┐
│          │    │   Page   │    │ AnalyticsEvt │
│          │    │ slug     │    │ type         │
│          │    │ blocks{} │    │ jobId        │
│          │    │ tenantId │    │ metadata {}  │
│          │    └──────────┘    │ tenantId     │
│          │                    └──────────────┘
│          │◄───┌──────────┐
│          │    │ Webhook  │
│          │    │ url      │
│          │    │ events[] │
│          │    │ secret   │
│          │    │ tenantId │
│          │    └──────────┘
└──────────┘
```

**Key design decisions:**
- All entities carry `tenantId` for **multi-tenant isolation**
- JSON blobs (`theme`, `branding`, `blocks`, `requirements`, etc.) stored as `String` — parsed at the repository layer
- `User.email` is unique per tenant (`@@unique([email, tenantId])`)
- `Job.slug` is unique per tenant (`@@unique([slug, tenantId])`)
- Composite indexes on `[tenantId, isPublished]`, `[tenantId, status]` for common queries
- ATS fields (`externalId`, `externalSource`) on Job and Application for future integrations

### Repository Layer

Each Prisma model has a dedicated repository (`packages/database/repositories/`) that encapsulates queries and JSON parsing:

| Repository | Model | Key Methods |
|-----------|-------|-------------|
| `tenantRepo` | Tenant | `findById`, `findByDomain`, `upsert`, `delete` |
| `userRepo` | User | `findByEmail`, `create`, `update`, `delete`, `listByTenant` |
| `jobRepo` | Job | `search` (with filters), `findBySlug`, `create`, `update`, `publish`, `delete` |
| `applicationRepo` | Application | `create`, `findByJob`, `updateStatus`, `listByTenant` |
| `pageRepo` | Page | `findBySlug`, `upsert`, `listByTenant`, `delete` |
| `analyticsRepo` | AnalyticsEvent | `track`, `queryByType`, `countByJob` |
| `auditRepo` | AuditLog | `create`, `listByTenant`, `listByUser` |
| `webhookRepo` | Webhook | `create`, `listActive`, `update`, `delete` |
| `subscriptionRepo` | User (billing) | `getByUserId`, `activateSubscription`, `decrementCredit`, `canUseAi`, `resetCredits`, `updateStatus`, `setStripeCustomerId` |

### Seed Data

`packages/database/seed.ts` populates the database with:
- 1 tenant ("default" / Acme Inc)
- 3 users (admin, hiring manager, recruiter)
- 8 jobs across departments
- 5 sample applications
- 1 page ("home")

```bash
cd packages/database && npx tsx seed.ts
```

---

## 🛡️ Security Architecture

### `packages/security/` — 9 Modules

The security package provides defense-in-depth utilities used across both apps.

```
Request → Middleware (CSRF, rate limit) → API Route → Security checks → Database
              │                              │
              │                              ├─ sanitize.ts  (XSS prevention)
              │                              ├─ validate.ts  (Zod schemas)
              │                              ├─ file-upload.ts (file validation)
              │                              ├─ url.ts       (URL validation)
              │                              └─ tenant.ts    (tenant isolation)
              │
              ├─ headers.ts   (CSP, security headers)
              ├─ rate-limit.ts (IP-based rate limiting)
              ├─ middleware.ts (request checking, CSRF)
              └─ crypto.ts    (HMAC, encrypt/decrypt, tokens)
```

| Module | Purpose | Key Exports |
|--------|---------|-------------|
| `sanitize.ts` | XSS prevention | `escapeHtml`, `stripHtml`, `sanitizeRichText`, `sanitizeBlockProps`, `sanitizeEmail`, `sanitizeSlug` |
| `validate.ts` | Zod v4 request schemas | `loginSchema`, `createJobSchema`, `savePageSchema`, `jobSearchSchema`, `safeParse`, `formatZodError` |
| `rate-limit.ts` | IP-based sliding window | `RateLimiter` class, `getRateLimiter(name)`, `getClientIp(request)`, preset configs per route |
| `headers.ts` | CSP & security headers | `buildCsp(config)`, `getSecurityHeaders()`, `toNextHeaders()` — CSP allows GrapesJS (inline scripts/styles, font CDNs, YouTube/Vimeo iframes) |
| `middleware.ts` | Request validation | `checkRequest()` (combined rate limit + size + content-type check), `validateCsrf()`, `secureCookie()` |
| `file-upload.ts` | Upload validation | `validateUpload()`, `generateSafeFilename()`, `sanitizeFilename()`, `isPathSafe()`, `UPLOAD_PRESETS` (resume, image, media) |
| `url.ts` | URL validation | `validateUrl()`, `safeUrl()`, `validateResumeUrl()`, `validateLinkedInUrl()`, `validateWebhookUrl()` |
| `tenant.ts` | Tenant isolation | `extractTenantId(request)`, `scopeToTenant()`, `assertTenantOwnership()`, `requireTenantContext()`, `TenantAccessError` |
| `crypto.ts` | Cryptographic primitives | `generateToken()`, `generateCsrfToken()`, `hmacSign()`, `hmacVerify()`, `timingSafeEqual()`, `sha256()`, `encrypt()`, `decrypt()` |

### CSP Configuration

GrapesJS requires a permissive CSP. Key directives in `headers.ts`:

```
script-src:  'self' 'unsafe-inline' 'unsafe-eval'
style-src:   'self' 'unsafe-inline' fonts.googleapis.com cdnjs.cloudflare.com
font-src:    'self' fonts.gstatic.com cdnjs.cloudflare.com
img-src:     'self' data: blob: https:
frame-src:   youtube.com vimeo.com
connect-src: 'self' ws://localhost:* (dev only)
```

---

## 🔭 Observability Architecture

### `packages/observability/` — 16 Modules (v0.2.0)

Enterprise-grade observability stack running in-process (no external services required).

```
Request → Edge Middleware ──────────────── rate-limiter-edge.ts (edge-safe)
              │
              ▼
         Route Handler
              │
              ├─ withRequestLogging() ──── request-logger.ts
              │       │
              │       ├─ correlation.ts ── AsyncLocalStorage request context
              │       ├─ logger.ts ─────── Structured JSON logging
              │       ├─ metrics.ts ────── Counters, histograms, gauges
              │       ├─ bot-detection.ts ─ Multi-signal bot scoring
              │       ├─ anomaly.ts ────── Z-score anomaly detection
              │       └─ performance.ts ── Timing + budget checks
              │
              ├─ tracing.ts ──────────── Distributed span tracing
              ├─ api-protection.ts ───── Payload limits, JSON depth
              └─ rate-limiter.ts ─────── Route-based sliding window
                                          │
                       ┌──────────────────┘
                       ▼
              alertManager (alerts.ts)
              │    │    │
              │    │    └─ DatabaseAlertChannel → AuditLog table
              │    └────── SlackAlertChannel → Webhook
              └─────────── ConsoleAlertChannel → stdout
                                          │
              persistence.ts ─────── FileLogSink (JSONL rotation)
                                     ExternalLogSink (Datadog/Logflare)
                                          │
              /api/admin/metrics ──── metricsHistory (time-series snapshots)
                    │
                    ▼
              /observability (dashboard UI)
```

| Module | Runtime | Purpose |
|--------|---------|---------|
| `logger.ts` | Node.js | Structured JSON logging with 5 levels, PII redaction, child loggers, listener hooks. Singletons: `logger.admin`, `logger.web`, `logger.api`, `logger.db`, `logger.security`. |
| `correlation.ts` | Node.js | `AsyncLocalStorage`-based request context. `generateRequestId()`, `withRequestContext()`, `getRequestId()`. |
| `metrics.ts` | Node.js | Prometheus-style counters/histograms/gauges. `MetricsCollector` singleton. `MetricsHistory` with `startCapture()` (every 60s), `query(from, to)`, `recent(n)`. |
| `alerts.ts` | Node.js | `AlertManager` with rule evaluation, cooldowns, severity-based routing. Channels: Console, Slack, Email, **Database**. `addChannelForSeverity()` routes critical→Slack, warning→logs. |
| `bot-detection.ts` | Node.js | Multi-signal scoring 0–100. Known bad/good bots, headless browser detection, request pattern analysis, suspicious path probes. IP blocklist with auto-expiry. |
| `anomaly.ts` | Node.js | Z-score anomaly detection on sliding windows. `anomalyDetector` singleton. Tracks request rate, error rate, p95 latency, login failures. |
| `request-logger.ts` | Node.js | `withRequestLogging()` route handler wrapper. Combines logging, metrics, bot detection, IP blocklist, and anomaly feed per minute. `recordLoginFailure()`. |
| `performance.ts` | Node.js | `timer()`, `stopwatch()`, `timedDbQuery()`, `timedRender()`. Performance budgets: `checkBudget()`, `getBudgetViolations()`. Default budgets: API>500ms warn, DB>200ms warn, render>1s warn. |
| `api-protection.ts` | Node.js | Payload size limits, JSON depth/key analysis, content-type validation, `withTimeout()`. |
| `rate-limiter.ts` | Node.js | Route-based sliding window. Per-IP and per-user limits. `checkRouteRateLimit()` for route handlers. |
| `rate-limiter-edge.ts` | **Edge** | Edge-safe rate limiter (zero Node.js imports). `checkMiddlewareRateLimit()` and `extractClientIpEdge()`. Used by both `middleware.ts` files. |
| `persistence.ts` | Node.js | `FileLogSink` (JSONL rotation at 10MB, retention cleanup). `ExternalLogSink` (batch POST to Datadog/Logflare). `shouldSample()` configurable sampling. |
| `tracing.ts` | Node.js | Distributed tracing. `startSpan()`, `withSpan()`, `SpanHandle` class, `getTrace()`, `getCurrentTrace()`. Nested span support. Auto-logs slow spans (>1s) and errors. |
| `edge.ts` | **Edge** | `extractClientIp()` (respects Cloudflare, Vercel, X-Forwarded-For with configurable proxy hop trust). `extractEdgeMeta()`, `isEdgeRuntime()`, `configureTrustedProxy()`. |
| `sentry.ts` | Node.js | Optional Sentry integration. Dynamic import (no-op if `@sentry/nextjs` not installed). `captureError()`, `captureMessage()`, `initSentry()`. |
| `index.ts` | — | Barrel export of all modules. |

### Edge vs Node.js Runtime Split

Next.js middleware runs in the **Edge runtime** which lacks `node:crypto`, `node:async_hooks`, and other Node.js built-ins. The observability package handles this with two separate modules:

| Context | Import From | Why |
|---------|------------|-----|
| `middleware.ts` (Edge) | `rate-limiter-edge.ts`, `edge.ts` | Zero Node.js imports — edge-safe |
| Route handlers (Node.js) | `rate-limiter.ts`, `correlation.ts`, `logger.ts`, etc. | Full feature set with Node.js APIs |

### Observability Dashboard (`/observability`)

Real-time admin dashboard showing:
- **Key metrics** — total requests, error rate, avg latency, logins, bots blocked, rate limited
- **Sparkline charts** — requests/min, error rate %, avg latency over last 60 minutes
- **Anomaly detection** — Z-score stats for request rate, error rate, p95 latency, login failures
- **Performance budget violations** — warn/critical counts per category
- **Alert feed** — recent alerts with severity badges and timestamps
- **Blocked IPs** — IP, reason, expiry, unblock button (POST to `/api/admin/metrics`)
- **All counters** — raw counter values in a grid

Auto-refreshes every 10 seconds. Fetches from `GET /api/admin/metrics?range=60`.

---

## 🔒 Middleware Architecture

Both apps have an Edge middleware (`middleware.ts`) that runs **before** route handlers on every request:

```
Incoming Request
    │
    ▼
middleware.ts (Edge runtime)
    │
    ├─ 1. Generate/forward x-request-id (correlation)
    │
    ├─ 2. Rate limit check (rate-limiter-edge.ts)
    │     └─ IP extracted via extractClientIpEdge()
    │     └─ 429 returned if limit exceeded
    │
    ├─ 3. CSRF check on mutations (POST/PUT/PATCH/DELETE to /api/*)
    │     └─ Origin vs Host header validation
    │     └─ localhost exemption in dev mode
    │
    ├─ 4. Security headers (X-Content-Type-Options, X-Frame-Options, Referrer-Policy)
    │
    └─ 5. X-Response-Time timing header
    │
    ▼
Route Handler (Node.js runtime)
    │
    └─ withRequestLogging() — full observability
```

---

## 🗃️ Storage Architecture

### Current: Prisma + SQLite (Database-backed)

All persistent data is stored in the SQLite database at `packages/database/prisma/dev.db`. The Prisma schema defines 8 models with full tenant isolation.

**Additionally**, some file-based storage remains for media and page editing compatibility:

```
data/
├── pages/              → Page content JSON (legacy file-based store, DB is canonical)
├── tenants/            → Tenant theme configs (legacy, DB is canonical)
├── media/              → Uploaded images
└── resumes/            → Uploaded resume files
```

### Caching Strategy

| Store | Cache | TTL | Invalidation |
|-------|-------|-----|-------------|
| Tenant configs | In-memory Map | 60s | On write/delete |
| Job search | In-memory Map | 30s | LRU (max 100 entries) |
| Metrics history | In-memory ring buffer | 60 min | Oldest evicted automatically |
| Rate limit windows | In-memory Map | 10 min | Entries older than 10 min pruned every 2 min |
| Bot IP blocklist | In-memory Map | Configurable per-entry | Auto-expires per `expiresAt` |
| Alert history | In-memory Array | 500 entries | Oldest evicted when limit reached |

### Migration Path to PostgreSQL

For production, switch from SQLite to PostgreSQL:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")  // e.g., postgres://user:pass@host:5432/career_builder
}
```

Run `npx prisma migrate dev` to create the migration. Add connection pooling (PgBouncer or Prisma Accelerate) for production load.

---

## ⚡ Performance Considerations

1. **SSE (not WebSocket)** — simpler, works through proxies, auto-reconnects
2. **Debounced search** — 300ms debounce on keystroke, prevents API spam
3. **Memoized tokens** — `useMemo` on theme tokens, CSS vars computed once
4. **CDN-friendly headers** — `Cache-Control: public, s-maxage=60` on job API
5. **AbortController** — in-flight requests cancelled when new search starts
6. **Static job search page** — `/jobs` is a static shell, data loaded client-side
7. **Server-rendered detail** — `/jobs/[id]` is SSR for SEO with `revalidate: 60`
8. **Edge middleware rate limiting** — blocks abusive traffic before hitting Node.js runtime
9. **Performance budgets** — automated warnings when API>500ms, DB>200ms, render>1s
10. **Metrics history capture** — snapshots every 60s for time-series dashboards without external infrastructure
11. **Prisma singleton** — cached on `globalThis` to prevent connection exhaustion during HMR

---

## 🌐 Environment Variables

| Variable | Where | Description |
|----------|-------|-------------|
| `DATABASE_URL` | All `.env` files | Absolute `file:` path to SQLite DB |
| `AUTH_SECRET` | `apps/admin/.env` | HMAC session signing secret |
| `NEXT_PUBLIC_SITE_URL` | `apps/web/.env` | Base URL for server-side API calls |
| `OPENAI_API_KEY` | `apps/admin/.env.local` | OpenAI API key for AI features |
| `AI_MODEL` | `apps/admin/.env.local` | AI model name (default: `gpt-5.4-mini`) |
| `OPENAI_BASE_URL` | `apps/admin/.env.local` | Custom OpenAI-compatible API base URL |
| `STRIPE_SECRET_KEY` | `apps/admin/.env.local` | Stripe secret key (`sk_test_...` or `sk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | `apps/admin/.env.local` | Stripe webhook signing secret (`whsec_...`) |
| `STRIPE_PRO_PRICE_ID` | `apps/admin/.env.local` | Stripe Price ID for Pro plan (`price_...`) |
| `STRIPE_ENT_PRICE_ID` | `apps/admin/.env.local` | Stripe Price ID for Enterprise plan (`price_...`) |
| `NEXT_PUBLIC_APP_URL` | `apps/admin/.env.local` | App URL for Stripe redirect callbacks |
| `SENTRY_DSN` | Optional | Sentry error tracking DSN (optional — degrades gracefully) |
| `SLACK_WEBHOOK_URL` | Optional | Slack webhook for critical alerts |

---

## 🛠️ Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 16.1.7 |
| UI | React | 19.2.3 |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | v4 |
| Visual Editor | GrapesJS | 0.22.14 |
| ORM | Prisma | 6.19.2 |
| Database | SQLite (dev) / PostgreSQL (prod) | — |
| Validation | Zod | 4.3.6 |
| Payments | Stripe SDK | 20.4.1 |
| AI | OpenAI (GPT-5.4-mini via Responses API) | — |
| Build System | Turborepo | 2.8.17 |

---

## 🤖 AI Content Generation System

### Overview

AI-powered content generation integrated into the visual editor and job management system. Uses OpenAI's GPT-5.4-mini model via the **Responses API** (not Chat Completions — GPT-5.x uses a different endpoint).

```
User (Editor/Jobs)
    │
    ├─ AiAssistant.tsx (block content generation)
    │   └─ generate / improve / expand / generate-page
    │
    ├─ AiJobAssistant.tsx (job posting generation)
    │   └─ generate-job
    │
    ▼
POST /api/ai
    │
    ├─ Auth check (getAuthenticatedUser)
    ├─ Server-side subscription check (subscriptionRepo.canUseAi)
    ├─ Rate limiting (per IP, per action)
    ├─ Prompt building (prompts.ts)
    ├─ AI provider call (dual API support)
    ├─ JSON parsing (parseAiJson)
    ├─ Schema validation (validator.ts)
    ├─ Credit decrement (subscriptionRepo.decrementCredit)
    └─ Response caching (5 min TTL)
```

### File Structure

```
apps/admin/lib/ai/
├── types.ts          — AiAction, AiRequest, AiResponse, SubscriptionPlan,
│                       PLAN_FEATURES, AI_LIMITS, AiJobFormData
├── prompts.ts        — buildPrompt(), buildJobPrompt() — system/user prompt pairs
├── validator.ts      — validateAiOutput(), validatePageOutput(), validateJobOutput(),
│                       parseAiJson() — schema-validates AI output against blockSchemas
├── useSubscription.ts — Client hook: fetches /api/subscription, caches per page load
└── useGeoPricing.ts  — Client hook: detects user region, returns localized pricing

apps/admin/app/api/ai/route.ts         — POST handler (457 lines)
apps/admin/components/editor/
├── AiAssistant.tsx                     — Block AI panel (~1332 lines)
│                                         Side-by-side diff, per-field checkboxes
└── UpgradeModal.tsx                    — Stripe checkout redirect + geo pricing

apps/admin/components/jobs/
└── AiJobAssistant.tsx                  — Job AI panel (~680 lines)
```

### AI Actions

| Action | Description | Used In |
|--------|-------------|---------|
| `generate` | Generate new block content from schema | AiAssistant |
| `improve` | Improve existing block content | AiAssistant |
| `expand` | Expand/elaborate on existing content | AiAssistant |
| `generate-page` | Generate an entire page (multiple blocks) | AiAssistant |
| `generate-job` | Generate a complete job posting | AiJobAssistant |

### Dual API Support

The AI route auto-detects which OpenAI API to use based on model name:

```typescript
const RESPONSES_API_MODELS = /^(gpt-5|o[1-9])/;

// GPT-5.x, o-series → Responses API (/v1/responses)
// GPT-4.x           → Chat Completions API (/v1/chat/completions)
```

### Rate Limits (per IP, per minute)

| Action | Limit |
|--------|-------|
| `generate` | 15/min |
| `improve` | 30/min |
| `expand` | 30/min |
| `generate-page` | 8/min |
| `generate-job` | 15/min |

### AI Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | Required | OpenAI API key |
| `AI_MODEL` | `gpt-5.4-mini` | Model name (determines which API endpoint to use) |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | Custom API base URL (for Azure, proxies, local models) |

---

## 💳 Stripe Billing & Subscription System

### Overview

Production-grade Stripe subscription system. **The server is the single source of truth** — client state is never trusted. All plan checks, credit limits, and billing operations happen server-side.

### Architecture

```
User clicks "Upgrade to Pro"
    │
    ▼
UpgradeModal → POST /api/stripe/checkout { plan: "pro" }
    │
    ▼
Server creates Stripe Customer + Checkout Session
    │
    ▼
User redirected to Stripe-hosted payment page
    │
    ▼
User pays → Stripe fires webhook events
    │
    ▼
POST /api/stripe/webhook receives event
    │
    ├─ checkout.session.completed → subscriptionRepo.activateSubscription()
    ├─ invoice.paid (renewal)    → subscriptionRepo.resetCredits()
    ├─ subscription.updated      → subscriptionRepo.updateStatus()
    └─ subscription.deleted      → subscriptionRepo.updateStatus("canceled")
    │
    ▼
User redirected back to /editor?checkout=success
    │
    ▼
useSubscription hook → GET /api/subscription → shows Pro status + credits
    │
    ▼
User uses AI → POST /api/ai
    ├─ subscriptionRepo.canUseAi()     → 403 if free/expired/no credits
    ├─ [generate content]
    └─ subscriptionRepo.decrementCredit() → atomic decrement
```

### File Structure

```
apps/admin/lib/stripe/
└── config.ts                    — Stripe client, plan↔price mapping,
                                   runtime env validation, PLAN_CREDITS

apps/admin/app/api/stripe/
├── checkout/route.ts            — POST: Create Stripe Checkout Session
│                                   Idempotency key, duplicate sub prevention
├── portal/route.ts              — POST: Create Stripe Billing Portal Session
│                                   Auth + role-gated, self-service billing
└── webhook/route.ts             — POST: Stripe webhook handler
                                   Signature verification, idempotency,
                                   event deduplication

apps/admin/app/api/subscription/
└── route.ts                     — GET: Server-side subscription status

apps/admin/app/api/dev/
└── set-plan/route.ts            — POST: Dev-only plan switcher API

packages/database/repositories/
└── subscriptionRepo.ts          — Full subscription CRUD
```

### Subscription Plans

| Plan | AI Credits/month | Price (India) | Price (US) |
|------|-----------------|---------------|-----------|
| Free | 0 | ₹0 | $0 |
| Pro | 500 | ₹1,499/mo | $79/mo |
| Enterprise | 2,500 | Contact sales | $249/mo |

### Subscription Database Fields (User model)

```prisma
model User {
  // ... existing fields ...
  plan                  String    @default("free")        // free | pro | enterprise
  stripeCustomerId      String?   @unique                 // cus_...
  stripeSubscriptionId  String?   @unique                 // sub_...
  stripePriceId         String?                           // price_...
  subscriptionStatus    String    @default("none")        // none | active | past_due | canceled | trialing
  aiCredits             Int       @default(0)             // remaining AI credits this cycle
  aiCreditsResetAt      DateTime?                         // when credits reset (next billing cycle)
  billingCycleStart     DateTime?                         // current billing cycle start
}
```

### subscriptionRepo Methods

| Method | Purpose |
|--------|---------|
| `getByUserId(userId)` | Get subscription state for a user |
| `getByStripeCustomerId(customerId)` | Lookup user by Stripe customer |
| `getByStripeSubscriptionId(subId)` | Lookup user by Stripe subscription |
| `setStripeCustomerId(userId, id)` | Link Stripe customer (P2025-safe) |
| `activateSubscription(userId, data)` | Set plan, credits, billing cycle (P2025-safe) |
| `updateStatus(userId, status)` | Update status; on cancel → reset to free (P2025-safe) |
| `decrementCredit(userId)` | **Atomic** conditional decrement (race-condition-safe via `updateMany`) |
| `resetCredits(userId, credits)` | New billing cycle credit reset |
| `canUseAi(userId)` | Server-side check: plan + status + credits |

### Webhook Events Handled

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Activate subscription, link customer, set credits |
| `invoice.paid` | Reset credits on renewal (skips initial invoice) |
| `invoice.payment_failed` | Set status to `past_due` for faster UX feedback |
| `customer.subscription.updated` | Sync status (active, past_due), handle plan changes |
| `customer.subscription.deleted` | Cancel subscription → reset to free plan |

### Safeguards

- **Idempotency**: Checkout uses idempotency key (5-min window per user+plan). Webhook deduplicates by event ID.
- **Duplicate prevention**: Checkout returns 409 if user already has active subscription.
- **Signature verification**: Webhook verifies `stripe-signature` header using `STRIPE_WEBHOOK_SECRET`.
- **P2025 guards**: All `prisma.user.update()` calls catch "record not found" errors gracefully.
- **Race condition protection**: `decrementCredit` uses atomic `updateMany` with conditions instead of read-then-write.
- **Retry safety**: Webhook returns 500 on transient DB errors (Stripe retries), 200 on business-logic issues (no retry).
- **Raw body parsing**: Webhook uses `req.text()` (not `req.json()`) for signature verification.
- **Environment validation**: Config throws in production if `STRIPE_SECRET_KEY` / price IDs are missing.

### Stripe Environment Variables

| Variable | Example | Description |
|----------|---------|-------------|
| `STRIPE_SECRET_KEY` | `sk_test_...` | Stripe secret key (test or live) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Webhook signing secret |
| `STRIPE_PRO_PRICE_ID` | `price_1TDj...` | Stripe Price ID for Pro plan |
| `STRIPE_ENT_PRICE_ID` | `price_1TDj...` | Stripe Price ID for Enterprise plan |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3001` | App URL for Stripe redirect callbacks |

### Local Development

```bash
# Terminal 1: Run the app
npm run dev

# Terminal 2: Forward Stripe webhooks to local server
stripe listen --forward-to localhost:3001/api/stripe/webhook
# Copy the whsec_... key to .env.local
```

### Stripe Customer Portal (Self-Service Billing)

Users with an active subscription can manage their billing entirely through Stripe's hosted Customer Portal:

```
User clicks "Manage Billing"
    │
    ▼
BillingPortalButton → POST /api/stripe/portal
    │
    ├─ Auth check (getSession)
    ├─ Role check (viewers blocked)
    ├─ Fetch stripeCustomerId from DB (never from client)
    │
    ▼
stripe.billingPortal.sessions.create({ customer })
    │
    ▼
User redirected to Stripe-hosted portal
    │
    ├─ Upgrade / downgrade plan
    ├─ Cancel subscription
    ├─ Update payment method
    ├─ View / download invoices
    │
    ▼
User returns to /editor?portal=returned
    │
    ▼
Stripe fires webhook events → DB updated automatically
```

**Portal API (`/api/stripe/portal`):**
- Auth required (admin / hiring_manager / recruiter only)
- `stripeCustomerId` always fetched from DB — never passed from client
- Returns 400 if user has no Stripe customer (never subscribed)
- Returns 403 for viewers
- Handles `StripeInvalidRequestError` gracefully

**Portal UX Integration:**
- `BillingPortalButton` component (compact + full modes) available in AiAssistant and UpgradeModal
- Active subscribers see billing info bar with plan status, renewal date, and "Manage Billing →" link
- UpgradeModal shows "Already subscribed? Manage Billing →" for users with Stripe customer
- Past-due subscribers see payment failure warning with portal link
- Canceled subscribers see re-subscribe prompt

**Required Stripe Dashboard config:** Settings → Billing → Customer Portal:
- ✅ Allow cancel subscription
- ✅ Allow update payment method
- ✅ Allow view invoice history
- ✅ Enable plan switching (add Pro + Enterprise prices)

### Dev Plan Switcher API (`/api/dev/set-plan`)

Dev-only endpoint that bypasses Stripe to directly set subscription plan in DB. Used by `DevPlanSwitcher.tsx` for testing subscription gating.

```
DevPlanSwitcher → POST /api/dev/set-plan { plan: "pro" }
    │
    ├─ Hard-blocked in production (returns 404)
    ├─ Auth required
    ├─ Validates plan: "free" | "pro" | "enterprise"
    │
    ▼
prisma.user.update({ plan, subscriptionStatus, aiCredits, ... })
    │
    ▼
useSubscription.refresh() → UI updates immediately
```

---

## 🌍 Geo-Based Pricing System

### Overview

Detects user region and shows localized pricing in the UpgradeModal. Uses a multi-signal cascade with no hard dependency on any single API.

### Detection Strategy (Priority Order)

```
1. IP Geolocation (client-side fetch, CSP whitelisted)
   ├─ api.country.is     (minimal, fast, generous limits)
   ├─ ipwho.is           (rich data, 10k free req/month)
   └─ ipapi.co/json/     (1k free req/day, can be rate-limited)
   
2. Timezone fallback (Intl.DateTimeFormat)
   └─ Maps timezone → region (e.g., Asia/Kolkata → IN)
   
3. Language fallback (navigator.language)
   └─ Maps language code → region (e.g., hi-IN → IN)
```

### Supported Regions

| Region | Currency | Flag | Pro Price | Enterprise Price |
|--------|----------|------|-----------|-----------------|
| US | USD ($) | 🇺🇸 | $79/mo | $249/mo |
| UK | GBP (£) | 🇬🇧 | £59/mo | £189/mo |
| EU | EUR (€) | 🇪🇺 | €69/mo | €219/mo |
| India | INR (₹) | 🇮🇳 | ₹1,499/mo | ₹4,999/mo |
| Other | USD ($) | 🌍 | $79/mo | $249/mo |

### Margin Analysis

```
Cost per AI request (GPT-5.4-mini): ~₹0.14 ($0.0016)

Pro  (500 credits):   max cost ₹70  → IN ₹1,499 = 95% margin
Ent  (2,500 credits): max cost ₹350 → IN ₹4,999 = 93% margin
Pro  (500 credits):   max cost $0.80 → US $79   = 99% margin
Ent  (2,500 credits): max cost $4.00 → US $249  = 98% margin
```

### CSP Whitelisting

Geo detection APIs are whitelisted in both `packages/security/headers.ts` (connect-src) and `apps/admin/next.config.ts` (regex patch):

```
connect-src: ... https://api.country.is https://ipwho.is https://ipapi.co
```

---

## 🔒 Subscription Gating Architecture

### Client-Side Gating (UI)

The `useSubscription()` hook fetches subscription state from `GET /api/subscription` on page load:

```typescript
const { status, loading, decrementCredit, refresh } = useSubscription();
// status.plan: "free" | "pro" | "enterprise"
// status.aiEnabled: boolean
// status.aiCreditsRemaining: number
// status.aiCreditsTotal: number
// status.subscriptionStatus: "none" | "active" | "past_due" | "canceled" | "trialing"
// status.hasStripeCustomer: boolean
// status.billingCycleStart: string | null  (ISO date)
// status.aiCreditsResetAt: string | null   (ISO date)
```

**Gating behavior:**
- **Free users** → see a locked AI card → clicking opens UpgradeModal → Pro redirects to Stripe Checkout, Enterprise opens prefilled email to `rohitmengji403@gmail.com`
- **Pro/Enterprise users** → see full AI panel with credits counter
- **Credits exhausted** → AI actions disabled with "No credits remaining" message

### Server-Side Enforcement (API)

Every AI request is double-checked server-side in `POST /api/ai`:

```typescript
// 1. Auth check
const user = await getAuthenticatedUser(req);
// 2. Role check (viewers blocked)
if (user.role === "viewer") return 403;
// 3. Subscription + credit check (NEVER trust client)
const aiCheck = await subscriptionRepo.canUseAi(user.id);
if (!aiCheck.allowed) return 403;
// 4. [Process AI request]
// 5. Decrement credit (atomic)
await subscriptionRepo.decrementCredit(user.id);
```

### Credit Lifecycle

```
User subscribes → activateSubscription(credits: 500 for Pro, 2500 for Enterprise)
    │
    ▼
User uses AI → decrementCredit() [atomic: plan≠free AND status=active AND credits>0]
    │
    ▼
Credits reach 0 → canUseAi() returns { allowed: false, reason: "No AI credits remaining" }
    │
    ▼
Billing cycle renews → invoice.paid webhook → resetCredits(500 or 2500)
    │
    ▼
User cancels → subscription.deleted webhook → updateStatus("canceled") → plan=free, credits=0
```

---

## 🧩 Component Architecture

### AI & Billing Components

| Component | Location | Size | Purpose |
|-----------|----------|------|---------|
| `AiAssistant.tsx` | `components/editor/` | ~1332 lines | Block-level AI panel. Actions: generate, improve, expand, generate-page. Side-by-side diff, per-field checkboxes, tone/industry selectors. Billing info bar for active subscribers. |
| `AiJobAssistant.tsx` | `components/jobs/` | ~680 lines | Job posting AI panel. Generates complete job data from prompt. Same subscription gating pattern. |
| `UpgradeModal.tsx` | `components/editor/` | ~270 lines | Premium upgrade modal with geo-based pricing. Pro → Stripe Checkout redirect. Enterprise → prefilled email. Shows portal link for existing subscribers. Canceled/past-due notices. |
| `BillingPortalButton.tsx` | `components/editor/` | ~100 lines | Reusable Stripe Customer Portal button. Compact mode (inline link) and full mode (button with icon). Loading/error states. |
| `DevPlanSwitcher.tsx` | `components/` | ~131 lines | Dev-only floating widget (editor page only). Toggles plan via `/api/dev/set-plan`. |

### Subscription Hooks

| Hook | Location | Purpose |
|------|----------|---------|
| `useSubscription()` | `lib/ai/useSubscription.ts` | Fetches subscription from server, caches per page load. Returns status, decrementCredit, refresh, setPlan. |
| `useGeoPricing()` | `lib/ai/useGeoPricing.ts` | Detects user region, returns localized pricing for UpgradeModal. |

---

## 🚀 Production Readiness Checklist

### Done ✅

- [x] Server-side subscription enforcement (never trust client)
- [x] Atomic credit decrement (race-condition-safe)
- [x] Stripe webhook signature verification
- [x] Webhook idempotency (event ID deduplication)
- [x] Duplicate subscription prevention
- [x] Idempotency keys on checkout
- [x] P2025-safe DB operations (user not found)
- [x] Rate limiting on AI endpoints
- [x] Dual AI API support (GPT-5.x Responses API + GPT-4 Chat Completions)
- [x] Geo-based pricing with multi-signal detection
- [x] CSP whitelisting for geo APIs
- [x] Runtime env var validation (throws in production if missing)
- [x] Response caching on AI route (5 min TTL)
- [x] Structured logging on all Stripe events
- [x] Stripe Customer Portal for self-service subscription management
- [x] `invoice.payment_failed` webhook handling (dunning — sets past_due status)
- [x] Billing Portal button in AI panel + Upgrade modal
- [x] Past-due / canceled subscription notices in UI
- [x] Dev-only plan switcher (`/api/dev/set-plan`) for testing
- [x] Extended subscription status (subscriptionStatus, hasStripeCustomer, billing dates)

### Future / Production

- [ ] Switch SQLite → PostgreSQL for production
- [ ] Add email notifications on subscription events
- [ ] Add Stripe tax integration for EU VAT/GST
- [ ] Add usage-based billing as alternative to credit system
- [ ] Add real-time webhook delivery dashboard
- [ ] Add Stripe Customer Portal branding (logo, colors) via Dashboard config
