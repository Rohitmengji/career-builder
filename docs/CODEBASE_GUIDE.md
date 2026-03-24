# Codebase Guide — File-by-File Reference

> For new developers joining the project. Every file explained — what it does, why it exists, and how it connects to the rest.

---

## 📁 Root Level

| File | Purpose |
|------|---------|
| `package.json` | Workspace root — defines `apps/*` and `packages/*` workspaces |
| `turbo.json` | Turborepo config — defines `dev`, `build`, `lint` pipeline tasks |

---

## 📁 `packages/database/` — Prisma ORM & Repository Layer

The database package provides the entire data access layer. All apps import from `@career-builder/database`.

| File | What It Does |
|------|-------------|
| `prisma/schema.prisma` | **Prisma schema — 8 models.** Tenant, User, Job, Application, Page, AuditLog, AnalyticsEvent, Webhook. SQLite for dev, PostgreSQL-ready for prod. All entities have `tenantId` for multi-tenant isolation. Generator output: `../../../node_modules/.prisma/client`. |
| `client.ts` | **Prisma client singleton.** Cached on `globalThis` to prevent connection exhaustion during Next.js HMR. |
| `types.ts` | **Domain types (~310 lines).** Canonical contract between DB, API routes, and frontend. Enum unions (`UserRole`, `EmploymentType`, `ExperienceLevel`, `ApplicationStatus`, `AuditAction`, `TenantPlan`), domain interfaces (`TenantRecord`, `UserRecord`, `SafeUser`, `JobRecord`, `ApplicationRecord`, `PageRecord`, etc.), and input/filter types. |
| `index.ts` | **Barrel export.** Re-exports `prisma`, all 8 repositories, and all types. |
| `seed.ts` | **Database seeder.** Creates 1 tenant, 3 users, 8 jobs, 5 applications, 1 page. Run with `npx tsx seed.ts`. |
| `resilience.ts` | **DB retry & health.** `withDbRetry(fn, options?)` retries transient Prisma errors (P1001, P1002, P1008, P1017, P2024) with exponential backoff. `checkDbHealth()` runs a lightweight query to verify DB connectivity. Used by `subscriptionRepo` and `/api/ready`. |
| `.env` | `DATABASE_URL` — must be **absolute** `file:` path to `prisma/dev.db`. |
| `package.json` | v0.1.0. Scripts: `db:generate`, `db:push`, `db:migrate`, `db:seed`, `db:studio`, `db:reset`. |

### `packages/database/repositories/` — Data Access

| File | Model | Key Exports |
|------|-------|-------------|
| `tenantRepo.ts` | Tenant | `findById`, `findByDomain`, `upsert`, `delete`. Parses JSON fields (theme, branding, settings). |
| `userRepo.ts` | User | `findByEmail`, `create`, `update`, `delete`, `listByTenant`. Types: `CreateUserInput`, `UpdateUserInput`. |
| `jobRepo.ts` | Job | `search` (filters + pagination), `findBySlug`, `findById`, `create`, `update`, `publish`, `delete`. Parses JSON arrays (requirements, tags, benefits). Types: `JobSearchFilters`, `CreateJobInput`. |
| `applicationRepo.ts` | Application | `create`, `findByJob`, `updateStatus`, `listByTenant`. Types: `CreateApplicationInput`, `ApplicationFilters`. |
| `pageRepo.ts` | Page | `findBySlug`, `upsert`, `listByTenant`, `delete`. Parses JSON `blocks` field. |
| `analyticsRepo.ts` | AnalyticsEvent | `track`, `queryByType`, `countByJob`. Type: `TrackEventInput`. |
| `auditRepo.ts` | AuditLog | `create`, `listByTenant`, `listByUser`. Type: `CreateAuditInput`. |
| `webhookRepo.ts` | Webhook | `create`, `listActive`, `update`, `delete`. Type: `CreateWebhookInput`. |
| `subscriptionRepo.ts` | User (billing) | `getByUserId`, `getByStripeCustomerId`, `getByStripeSubscriptionId`, `setStripeCustomerId`, `activateSubscription`, `updateStatus`, `decrementCredit` (atomic via `updateMany`), `resetCredits`, `canUseAi`. All write operations wrapped with `withDbRetry()` for transient failure resilience. Handles P2025 errors gracefully on all updates. |
| `index.ts` | — | Barrel export of all 9 repositories and their types. |

---

## 📁 `packages/security/` — Security Utilities

Defense-in-depth security package used by both apps. 9 modules covering input validation, sanitization, rate limiting, headers, cryptography, and file upload safety.

| File | What It Does |
|------|-------------|
| `sanitize.ts` | **XSS prevention.** `escapeHtml()`, `stripHtml()`, `sanitizeRichText()` (allowlists safe HTML tags), `sanitizeBlockProps()`, `sanitizeEmail()`, `sanitizeSlug()`, `sanitizeTenantId()`, `validateHexColor()`, `sanitizeCssValue()`, `sanitizeThemeColors()`. |
| `validate.ts` | **Zod v4 request schemas.** `loginSchema`, `createUserSchema`, `updateUserSchema`, `createJobSchema`, `updateJobSchema`, `jobActionSchema`, `createApplicationSchema`, `updateApplicationSchema`, `savePageSchema`, `saveTenantSchema`, `paginationSchema`, `jobSearchSchema`. Also: `safeParse<T>()` wrapper and `formatZodError()`. **Note:** Uses Zod v4 API — `z.record(z.string(), z.unknown())` not `z.record(z.unknown())`. |
| `rate-limit.ts` | **IP-based sliding window rate limiter.** `RateLimiter` class with configurable window/max. `RATE_LIMITS` presets (auth: 5/min, apply: 3/min, upload: 10/5min). `getRateLimiter(name)` returns per-route singleton. `getClientIp(request)` extracts IP from headers. |
| `headers.ts` | **CSP & security headers.** `buildCsp(config)` generates Content-Security-Policy string. `getSecurityHeaders()` returns all security headers. `toNextHeaders()` converts to Next.js format. CSP configured for GrapesJS compatibility (unsafe-inline/eval, font CDNs, YouTube/Vimeo). |
| `middleware.ts` | **Request checking.** `checkRequest()` combines rate limit + payload size + content-type checks. `validateCsrf()` double-submit cookie validation. `secureCookie()` sets HttpOnly/Secure/SameSite cookie options. |
| `file-upload.ts` | **Upload validation.** `validateUpload()` checks file size, MIME type, extension, magic bytes. `generateSafeFilename()` creates UUID-based filenames. `sanitizeFilename()` strips path traversal. `isPathSafe()` prevents directory traversal. `UPLOAD_PRESETS` for resume/image/media. |
| `url.ts` | **URL validation.** `validateUrl()` with protocol/host allowlists. `safeUrl()` returns null on failure. Domain-specific: `validateResumeUrl()`, `validateLinkedInUrl()`, `validateWebhookUrl()`. |
| `tenant.ts` | **Tenant isolation.** `extractTenantId(request)` from headers/query. `scopeToTenant()` adds tenantId to query objects. `assertTenantOwnership()` verifies entity belongs to tenant. `requireTenantContext()` extracts + validates + returns context. `TenantAccessError` class. `tenantScope()` helper for Prisma where clauses. |
| `crypto.ts` | **Cryptographic primitives.** `generateToken()`, `generateUrlSafeToken()`, `generateShortId()`, `generateCsrfToken()`. HMAC: `hmacSign()`, `hmacVerify()`. `timingSafeEqual()` for constant-time comparison. Hashing: `sha256()`, `sha256Buffer()`. AES: `encrypt()`, `decrypt()`. |
| `index.ts` | Barrel export of all 9 modules. |
| `package.json` | v0.1.0. Depends on `zod@^3.24.0` (actually uses v4 at runtime — `^3.24.0` resolves to Zod v4). |

---

## 📁 `packages/observability/` — Enterprise Observability (v0.2.0)

Production SaaS observability stack — logging, metrics, alerting, bot detection, rate limiting, tracing, and more. 16 modules.

| File | Runtime | What It Does |
|------|---------|-------------|
| `logger.ts` | Node.js | **Structured JSON logging.** 5 levels (debug→fatal). PII redaction for emails/tokens/passwords. Child loggers. Listener hooks (`onLog`). Named singletons: `logger.admin`, `logger.web`, `logger.api`, `logger.db`, `logger.security`. |
| `correlation.ts` | Node.js | **Request context propagation.** `AsyncLocalStorage`-based. `generateRequestId()` (k-sortable). `withRequestContext(ctx, fn)` wraps a request handler. `getRequestId()` reads from async context. |
| `metrics.ts` | Node.js | **Prometheus-style metrics.** `MetricsCollector` with counters (`increment`), histograms (`observe` — auto-computes avg/p95/p99/min/max), gauges (`set`). Pre-defined `METRIC` constants. `MetricsHistory` class auto-captures snapshots every 60s. `metricsHistory.query(from, to)`, `.recent(n)`. |
| `alerts.ts` | Node.js | **Alert management.** `AlertManager` with rule evaluation + cooldowns. Channels: `ConsoleAlertChannel`, `SlackAlertChannel`, `EmailAlertChannel`, `DatabaseAlertChannel`. `addChannelForSeverity()` for routing (e.g., critical→Slack). In-memory history (500 max). |
| `bot-detection.ts` | Node.js | **Multi-signal bot scoring (0–100).** Known bad/good bots, headless browser detection (PhantomJS, Puppeteer, Playwright UA patterns), request pattern analysis, suspicious path probes (`/wp-admin`, `/.env`, `/phpMyAdmin`). IP blocklist with auto-expiry. |
| `anomaly.ts` | Node.js | **Z-score anomaly detection.** Sliding window stats. `anomalyDetector.feed(metric, value)`, `anomalyDetector.isAnomaly(metric)`. Tracked metrics: request rate, error rate, p95 latency, login failures. |
| `request-logger.ts` | Node.js | **Route handler wrapper.** `withRequestLogging(handler)` adds: correlation ID, structured logging, metrics increment, bot detection, IP blocklist check, anomaly feed. Also: `recordLoginFailure(ip)`. |
| `performance.ts` | Node.js | **Timing utilities.** `timer(label)`, `stopwatch()`, `timedDbQuery(name, fn)`, `timedRender(name, fn)`. **Performance budgets:** `checkBudget(category, durationMs)` checks against thresholds (API>500ms, DB>200ms, render>1s). `getBudgetViolations()` returns warn/critical counts. |
| `api-protection.ts` | Node.js | **Request payload protection.** Max body size limits. JSON depth/key analysis (rejects deeply nested or too many keys). Content-type validation. `withTimeout(fn, ms)` wraps a function with a timeout. |
| `rate-limiter.ts` | Node.js | **Full-featured route-based rate limiter.** Per-IP + per-user sliding windows. Route rules: `/api/auth`→5/min, `/api/jobs/apply`→3/min, `/api/media`→10/5min, `/api/jobs`→60/min, default→100/min. `checkRouteRateLimit(req, ip, userId?)`. |
| `rate-limiter-edge.ts` | **Edge** | **Edge-safe rate limiter.** Zero Node.js imports. Self-contained sliding window with same route rules. `checkMiddlewareRateLimit(pathname, ip)`. `extractClientIpEdge(headers)` — Cloudflare/Vercel/XFF support. Used by both `middleware.ts` files. |
| `persistence.ts` | Node.js | **Log sinks.** `FileLogSink` writes JSONL with rotation (10MB) and retention cleanup. `ExternalLogSink` batches POST to Datadog/Logflare endpoints. `shouldSample(level, config)` for configurable sampling. `attachFileSink(logger)`, `attachExternalSink(logger)`. |
| `tracing.ts` | Node.js | **Distributed tracing.** `startSpan(name, meta?)` returns `SpanHandle`. `withSpan(name, fn)` wraps async functions. Nested span support via global `activeSpans` map. Auto-logs slow spans (>1s) and errors. `getTrace(traceId)`, `getCurrentTrace()`. |
| `edge.ts` | **Edge** | **Edge integration helpers.** `extractClientIp(headers)` with configurable proxy trust (Cloudflare CF-Connecting-IP, Vercel x-vercel-ip, XFF hop count). `extractEdgeMeta(headers)` returns IP + country + city + CDN provider + protocol. `isEdgeRuntime()` detection. `configureTrustedProxy(config)`. |
| `sentry.ts` | Node.js | **Optional Sentry integration.** Dynamic import — no-op if `@sentry/nextjs` not installed. `captureError(error, context)`, `captureMessage(msg, level)`, `initSentry(options)`. Uses `webpackIgnore` to prevent Next.js build-time resolution. |
| `index.ts` | — | Barrel export of all 16 modules. |
| `package.json` | — | v0.2.0. Subpath exports for all 16 modules. |

---

## 📁 `packages/tenant-config/` — Shared Theme Package

This package is imported by **both** apps. It defines the theme system types, defaults, validation, and design tokens.

| File | Lines | What It Does |
|------|-------|-------------|
| `index.ts` | ~360 | **Types + defaults + utilities.** Exports `TenantTheme`, `TenantBranding`, `TenantConfig`, `DEFAULT_THEME`, `DEFAULT_BRANDING`, `DEFAULT_CONFIG`. Also has `mergeTenantConfig()`, `themeToCssVars()`, `getGoogleFontsUrl()`, color helpers (`lightenHex`, `darkenHex`, `isLightColor`), and `normalizeTheme()`. This is the main entry point. |
| `validation.ts` | ~100 | **Runtime validation.** `validateTheme()` and `validateBranding()` check hex colors, enum values, strings, booleans — never throws, always returns a safe value with fallback. Logs warnings in dev mode via `getValidationWarnings()`. |
| `tokens.ts` | ~120 | **Design token system.** `getDesignTokens(theme)` converts a raw theme into pre-computed `DesignTokens` — CSS classes for button radius, card shadow, section padding, plus computed color values. `getAccentTokens(color)` generates per-block color overrides. Lookup maps: `BUTTON_RADIUS_CLASS`, `CARD_RADIUS_CLASS`, `CARD_SHADOW_CLASS`, `SECTION_PADDING_CLASS`, `BUTTON_SIZE_CLASS`. |
| `package.json` | — | v0.2.0, exports `./validation` and `./tokens` subpaths |

### How these connect

```
Component calls useTheme()
    → ThemeProvider uses normalizeTheme() (from index.ts)
    → ThemeProvider uses validateBranding() (from validation.ts)
    → ThemeProvider uses getDesignTokens() (from tokens.ts)
    → Component reads tokens.colors.primary, tokens.button.radiusClass, etc.
```

---

## 📁 `apps/admin/` — Admin Dashboard & Editor

### `apps/admin/middleware.ts` — Edge Middleware

Runs on every request before route handlers (Edge runtime). Provides:
1. **Request ID** — generates/forwards `x-request-id` header for correlation
2. **Global rate limiting** — `checkMiddlewareRateLimit()` from `rate-limiter-edge.ts`; returns 429 early
3. **CSRF validation** — origin vs host check on mutations (POST/PUT/PATCH/DELETE to `/api/*`)
4. **Security headers** — `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`
5. **Response timing** — `X-Response-Time` header

### `apps/admin/lib/` — Core Logic

| File | Lines | What It Does |
|------|-------|-------------|
| `auth.ts` | ~370 | **Full auth system.** DB-backed multi-user with 4 roles (admin/hiring_manager/recruiter/viewer). Password hashing with bcrypt (cost 12). Rate limiting (5 attempts → 60s lockout per IP). CSRF double-submit cookie. Iron-session (AES-256-GCM encrypted cookies) with sliding session (7-day expiry). Audit logging — `writeAuditLog` validates userId exists in DB before writing (FK safety). Key exports: `login()`, `logout()`, `getSession()`, `getSessionReadOnly()`, `requireRole()`, `createUser()`, `updateUser()`, `deleteUser()`. **Important:** `getSessionReadOnly()` exists because `getSession()` writes a cookie for sliding renewal, which crashes in Server Components. |
| `env.ts` | ~90 | **Environment validation.** Validates all required env vars at startup. Three required levels: `true` (always), `false` (optional), `"production"` (only in production runtime). SESSION_SECRET and NEXT_PUBLIC_APP_URL are production-required. `isProductionRuntime()` helper excludes `next build` phase. |
| `session.ts` | ~81 | **Session config.** `SessionData` interface, `sessionOptions` for iron-session. Cookie name, ttl, secure flag based on NODE_ENV. |
| `store.ts` | ~52 | **Page storage.** File-based JSON store. `savePage(slug, blocks)`, `loadPage(slug)`, `listPages()`. Each page stored as `data/pages/<slug>.json`. Simple and swappable. |
| `tenantStore.ts` | ~165 | **Tenant config storage.** File-based with **in-memory caching** (60s TTL). `saveTenant()` normalizes theme + validates branding before writing. `getTenant()` reads from cache or disk. `clearTenantCache()` for manual invalidation. Always ensures a "default" tenant exists. |
| `blockSchemas.ts` | ~553 | **Block schema registry — THE source of truth.** Defines all 25+ block types with their fields, default values, categories, and options. Each block has a `BlockSchema` with label, category, and array of `BlockField`. Also exports shared option helpers like `colorOptions`, `alignmentOptions`. **To add a new block, start here.** |
| `observability-init.ts` | ~35 | **Observability bootstrap.** Side-effect module that wires `DatabaseAlertChannel` to `alertManager`, registers background job handlers (`registerJobHandlers`), and schedules daily cleanup (`scheduleDailyCleanup`). Imported by `/api/admin/metrics` route. |
| `feature-flags.ts` | ~115 | **Lightweight feature flags.** 7 flags: `ai_content_generation`, `stripe_billing`, `geo_pricing`, `dev_plan_switcher` (off in prod), `site_generator`, `job_ai`, `background_jobs`. Supports env override (`FEATURE_FLAG_xxx`) and deploy-environment scoping. Exports: `isEnabled(flag)`, `getAllFlags()`, `FeatureFlag` type. |

### `apps/admin/lib/jobs/` — Background Job System

| File | Lines | What It Does |
|------|-------|-------------|
| `queue.ts` | ~227 | **In-memory job queue.** `enqueue(type, payload, options?)`, `dequeue()`, `process()`. Supports priority, delay, retries with exponential backoff. `registerHandler(type, fn)` pattern. Singleton `jobQueue` instance. |
| `handlers.ts` | ~120 | **Job handler implementations.** `audit-log-flush` batches audit writes. `webhook-retry` retries failed webhook deliveries. `periodic-cleanup` removes audit logs >90 days and analytics >180 days. `registerJobHandlers()` registers all 3. `scheduleDailyCleanup()` enqueues cleanup every 24 hours. |

### `apps/admin/lib/ai/` — AI Content Generation

| File | Lines | What It Does |
|------|-------|-------------|
| `types.ts` | ~201 | **AI type definitions.** `AiAction` (5 actions), `SubscriptionPlan`, `SubscriptionStatus` (extended: plan, aiEnabled, credits, subscriptionStatus, hasStripeCustomer, billing dates), `PLAN_FEATURES`, `AI_LIMITS` (rate limits, timeout, max tokens), `AiRequest`, `AiResponse`, `AiJobFormData`, tone/industry/audience unions. |
| `prompts.ts` | ~200 | **Prompt engineering.** `buildPrompt(action, blockType, data, context)` generates system+user prompt pairs for block content. `buildJobPrompt(data)` generates prompts for job postings. Industry/tone/audience-aware. |
| `validator.ts` | ~150 | **AI output validation.** `validateAiOutput(data, blockType)` validates against `blockSchemas`. `validatePageOutput(blocks)` validates multi-block page output. `validateJobOutput(data)` validates job form data. `parseAiJson(raw)` extracts JSON from AI markdown responses. |
| `useSubscription.ts` | ~92 | **Client subscription hook.** Fetches from `GET /api/subscription`, caches per page load. Returns `status`, `decrementCredit` (optimistic), `refresh` (re-fetch), `setPlan` (dev-only — calls `/api/dev/set-plan`). Server is source of truth. |
| `useGeoPricing.ts` | ~270 | **Geo-based pricing hook.** 3 API cascade (country.is → ipwho.is → ipapi.co) + timezone + language fallback. Returns `pricing` (region-specific amounts), `region`, `loading`. Pricing: US $79/$249, UK £59/£189, EU €69/€219, IN ₹1,499/₹4,999. |

### `apps/admin/lib/stripe/` — Stripe Billing

| File | Lines | What It Does |
|------|-------|-------------|
| `config.ts` | ~69 | **Stripe server-side config.** `requireEnv()` runtime validation (throws in prod, warns in dev). Stripe client with `apiVersion: "2026-02-25.clover"`. Exports: `stripe`, `PLAN_PRICE_MAP`, `PLAN_TO_PRICE`, `PLAN_CREDITS`, `APP_URL`, `WEBHOOK_SECRET`. Never import client-side. |

### `apps/admin/components/editor/` — Editor Components

| File | Lines | What It Does |
|------|-------|-------------|
| `Sidebar.tsx` | ~666 | **Auto-generated property editor.** Reads selected block's schema from `blockSchemas.ts` and renders form fields. Changes write back to GrapesJS component attributes. Integrates AiAssistant. |
| `AiAssistant.tsx` | ~1357 | **AI content panel.** Collapsed state: action cards for Pro/Enterprise, locked card for Free users. Expanded state: tone/industry/audience selectors, prompt input, side-by-side diff preview with per-field checkboxes. Billing info bar shows plan status, renewal date, "Manage Billing →" link. Integrates UpgradeModal + BillingPortalButton. |
| `UpgradeModal.tsx` | ~270 | **Premium upgrade modal.** Geo-based pricing via `useGeoPricing()`. Pro → Stripe Checkout redirect, Enterprise → prefilled email. Portal link for existing subscribers. Canceled/past-due status notices. |
| `BillingPortalButton.tsx` | ~100 | **Stripe Customer Portal button.** Compact mode (inline text link) and full mode (button with icon). Calls `POST /api/stripe/portal` → redirects to Stripe-hosted portal. Loading/error states. |

### `apps/admin/components/jobs/` — Job Components

| File | Lines | What It Does |
|------|-------|-------------|
| `AiJobAssistant.tsx` | ~680 | **AI job generation panel.** Same subscription gating pattern as AiAssistant. Generates complete job data from natural language prompt. Integrates UpgradeModal. |

### `apps/admin/components/` — Shared Components

| File | Lines | What It Does |
|------|-------|-------------|
| `DevPlanSwitcher.tsx` | ~131 | **Dev-only plan toggle.** Floating pill on `/editor` page only. Calls `POST /api/dev/set-plan` to switch plan in DB. Shows current plan, credits, AI enabled status. Hidden in production. |

### `apps/admin/app/editor/` — Visual Editor

| File | What It Does |
|------|-------------|
| `page.tsx` | **Main editor page (~674 lines).** Initializes GrapesJS, registers all 30+ blocks, wires up save/load, auto-save (30s), SSE preview push, tenant theme injection into canvas. Handles `?checkout=success` redirect from Stripe. Key patterns: `mountedRef` guard on all callbacks (prevents crash on navigation), `useRef` for stable effect dependencies, aggressive cleanup on unmount (`editor.off()`, `stopListening()`). |
| `blocks/registerBlock.ts` | **Generic block registrar.** Takes a schema + editor → registers the GrapesJS component + block. Used by all `registerXBlock` files. |
| `blocks/registerHeroBlock.tsx` | Hero section block with heading, subheading, CTA, background image. |
| `blocks/registerJobListBlock.tsx` | Job listing block that shows filterable job cards. |
| `blocks/register*.ts` | 30+ individual block registrations — each calls `registerBlock()` with their schema. |

### `apps/admin/app/` — Admin Pages

| Route | What It Does |
|-------|-------------|
| `page.tsx` (`/`) | Main landing — redirects to editor or login |
| `login/page.tsx` | Login form with email/password |
| `editor/page.tsx` | GrapesJS visual page editor |
| `dashboard/page.tsx` | Admin overview dashboard with stats |
| `jobs/page.tsx` | Job management — list, create, edit, publish/unpublish |
| `applications/page.tsx` | Application tracking — view, filter by status, update pipeline stage |
| `settings/page.tsx` | Tenant settings and configuration |
| `theme/page.tsx` | Theme customization UI (colors, fonts, radius, etc.) |
| `observability/page.tsx` | **Observability dashboard.** Real-time metrics (sparklines), anomaly stats, alert feed, blocked IPs with unblock action, performance budget violations. Auto-refreshes every 10s. Fetches from `/api/admin/metrics`. |

### `apps/admin/app/api/` — Admin API Routes

| Route | Method | What It Does |
|-------|--------|-------------|
| `api/auth/route.ts` | POST | Login/logout/session check. Uses `withRequestLogging`, `recordLoginFailure()`, metrics for login tracking. Rate-limited, CSRF-protected. |
| `api/pages/route.ts` | GET, POST | List/save page blocks. Uses `withRequestLogging`. Save + audit log in independent try/catches (audit failure doesn't block save). |
| `api/tenants/route.ts` | GET, POST, DELETE | CRUD for tenant configs. GET accepts `?id=tenantId`. |
| `api/preview/route.ts` | GET, POST | GET = SSE stream (clients subscribe). POST = push update to all subscribers. |
| `api/users/route.ts` | GET, POST, PUT, DELETE | User management. Admin-only. |
| `api/media/route.ts` | POST | File upload for images. Saves to `data/media/`. |
| `api/media/file/[filename]/route.ts` | GET | Serve uploaded media files with proper content-type. |
| `api/audit/route.ts` | GET | Read audit log. Admin-only. |
| `api/admin/metrics/route.ts` | GET, POST | **Observability API.** GET returns: metrics snapshot, history (with `?range=60` or `?from=&to=` query params), anomaly stats, alert history (50), blocked IPs, budget violations. POST accepts `{ action: "unblock_ip", ip }`. Triggers observability-init on first import. |
| `api/admin/jobs/route.ts` | GET, POST, PUT, DELETE | Admin job CRUD. Create, update, publish/unpublish, delete jobs via `jobRepo`. |
| `api/admin/applications/route.ts` | GET, PUT | View and update applications. Filter by status/job. Update pipeline stage. |
| `api/admin/analytics/route.ts` | GET | Analytics data — job views, application stats, conversion rates via `analyticsRepo`. |
| `api/health/route.ts` | GET | Health check. Returns `{ status: "ok" }`. |
| `api/ready/route.ts` | GET | **Readiness probe.** Checks DB connectivity (`checkDbHealth`) + required env vars. Returns 200 `{ status: "ready" }` or 503 `{ status: "not_ready", reason }`. Rate-limited (60/min). Used by deployment orchestration (K8s, Vercel, etc.). |
| `api/ai/route.ts` | POST | **AI content generation (~554 lines).** Auth + role check + per-user daily limit (200/day) + server-side subscription guard (`canUseAi`). 5 actions: generate, improve, expand, generate-page, generate-job. Dual API: Responses API (GPT-5.x) or Chat Completions (GPT-4). Rate limiting per IP per action. Response caching (5min TTL). Atomic credit decrement after success. |
| `api/stripe/checkout/route.ts` | POST | **Stripe Checkout.** Creates Checkout Session for plan upgrade. Live key guard (rejects `sk_live_` in non-production envs). CSRF validation. Idempotency key (5-min window per user+plan). Duplicate active subscription prevention (409). Creates/retrieves Stripe customer. Returns `{ url }`. |
| `api/stripe/portal/route.ts` | POST | **Stripe Billing Portal.** Creates Customer Portal session. Live key guard (rejects `sk_live_` in non-production envs). Auth + role-gated (viewers blocked). Fetches `stripeCustomerId` from DB. Returns `{ url }`. |
| `api/stripe/webhook/route.ts` | POST | **Stripe Webhook (~250 lines).** Signature verification. Idempotency via event ID Map (10-min TTL, max 5000, forced cleanup on overflow). Handles 5 events: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`. Returns 500 on transient errors (Stripe retries). |
| `api/subscription/route.ts` | GET | **Subscription status.** Returns server-side truth: plan, aiEnabled, credits, subscriptionStatus, hasStripeCustomer, billing dates. |
| `api/geo/route.ts` | GET | Server-side IP geolocation fallback for CSP-blocked clients. |
| `api/dev/set-plan/route.ts` | POST | **Dev-only.** Directly sets user plan in DB for testing. Hard-blocked in production. Accepts `{ plan }`. |

---

## 📁 `apps/web/` — Public Career Site

### `apps/web/middleware.ts` — Edge Middleware

Same structure as admin middleware: request ID generation, global rate limiting (edge-safe), CSRF on mutations, security headers, timing header.

### `apps/web/lib/` — Core Logic

| File | Lines | What It Does |
|------|-------|-------------|
| `renderer.tsx` | ~1179 | **THE renderer.** Maps block types to React components. Contains 25+ block components (HeroBlock, JobListBlock, FeaturesBlock, TestimonialBlock, NavbarBlock, FooterBlock, etc.) plus shared primitives (Section, Container, SectionHeader, Card, Btn, EmptyState). Every block reads `useTheme()` for colors and styling. `RenderPage` is the entry point — iterates blocks array and renders each. |
| `ThemeProvider.tsx` | ~191 | **Theme context provider.** Normalizes + validates theme on entry. Generates design tokens via `useMemo`. Injects CSS custom properties via `<style>`. Loads Google Fonts. Exposes `useTheme()` hook. Safe to call outside provider (returns defaults). Legacy compat fields delegate to tokens. |
| `jobs.ts` | ~50 | **Legacy job data** (6 sample jobs). Superseded by `lib/jobs/` but still exists. |
| `theme/ThemeProvider.tsx` | ~5 | Re-export from canonical `lib/ThemeProvider.tsx` for backward compat. |

### `apps/web/lib/jobs/` — Job Data System

| File | Lines | What It Does |
|------|-------|-------------|
| `types.ts` | ~142 | **Type definitions.** `Job`, `EmploymentType`, `ExperienceLevel`, `JobSalary`, `JobSearchParams`, `JobSearchResponse`, `JobFacets`, `FacetBucket`, `JobDetailResponse`, `JobApplication`, `ApplyResponse`, `JobDataProvider` interface. This is the contract — everything else implements or consumes these types. |
| `mockData.ts` | ~822 | **24 realistic mock jobs** across 7 departments (Engineering, Design, Marketing, Sales, Product, People, Finance). 2 tenants: "default" (22 jobs) and "techcorp" (2 jobs). Each job has full salary ranges, requirements, nice-to-have, benefits, tags. Uses `daysAgo()` helper for realistic `postedAt` dates. |
| `engine.ts` | ~261 | **Query engine — the brain.** `queryJobs(allJobs, params)` runs the full pipeline: filter → text search → build facets → sort → paginate. `searchScore(job, query)` does weighted field matching (title×5, department×3, location×3, tags×2, type×2, description×1) with exact/prefix/substring/multi-word support. `findRelatedJobs()` finds same-department + location-boost matches. |
| `provider.ts` | ~136 | **Provider abstraction.** `MockJobProvider` and `DatabaseJobProvider` implement `JobDataProvider` interface. Search cache (30s TTL, max 100 entries). `getJobProvider()` returns singleton. `setJobProvider()` allows swapping at runtime. |
| `useJobSearch.ts` | ~160 | **Client-side React hook.** Debounced search (300ms). Syncs all filters to URL search params (shareable links, back/forward works). Manages loading/error/data state. AbortController cancels in-flight requests. Returns: `data`, `isLoading`, `error`, `params`, `setParam`, `setQuery`, `setPage`, `resetFilters`, `queryInput`. |
| `index.ts` | ~25 | **Barrel export.** Single import for all job types and hooks. |

### `apps/web/app/` — Pages & Routes

| Route | File | Type | What It Does |
|-------|------|------|-------------|
| `/` | `page.tsx` | Static | Landing page |
| `/[slug]` | `[slug]/page.tsx` | Dynamic (SSR) | Renders saved page blocks via ThemeProvider + RenderPage |
| `/[slug]/LiveReloader.tsx` | — | Client | SSE listener — auto-reloads page when editor pushes changes |
| `/[slug]/jobs/[jobId]` | `[slug]/jobs/[jobId]/page.tsx` | Dynamic (SSR) | Tenant-scoped job detail page |
| `/[slug]/jobs/[jobId]/apply` | `[slug]/jobs/[jobId]/apply/` | Dynamic | Tenant-scoped application form |
| `/jobs` | `jobs/page.tsx` | Static (CSR) | Job search page. Search bar, facet filter sidebar, job cards, sort, pagination. Uses `useJobSearch` hook. Wrapped in `<Suspense>` for `useSearchParams()`. |
| `/jobs/[id]` | `jobs/[id]/page.tsx` | Dynamic (SSR) | Job detail page. Server component for SEO. `generateMetadata()` for title/description. Shows requirements, nice-to-have, benefits, tags, related jobs. |
| `/jobs/[id]/ApplyModal.tsx` | — | Client component | Apply modal with `<dialog>`. Form: name, email, phone, LinkedIn, resume (file upload OR URL), cover letter. Validates file type/size. Success/error feedback. |

### `apps/web/components/`

| File | What It Does |
|------|-------------|
| `LiveReloader.tsx` | SSE-based live reload component. Subscribes to admin preview push and reloads the page. |

### `apps/web/app/api/` — Web API Routes

| Route | Method | What It Does |
|-------|--------|-------------|
| `/api/jobs/route.ts` | GET | Search endpoint. Parses: `q`, `location`, `department`, `employmentType`, `experienceLevel`, `isRemote`, `tenantId`, `page`, `perPage`, `sortBy`, `sortOrder`. Validates enums. Returns `{ jobs, facets, pagination }`. Cache-Control headers. |
| `/api/jobs/[id]/route.ts` | GET | Detail endpoint. Accepts `?tenantId=`. Returns `{ job, relatedJobs }` or 404. |
| `/api/jobs/apply/route.ts` | POST | Apply endpoint. Accepts **multipart/form-data** (with file) or **JSON**. Validates required fields, email format, file size (10MB max), file extension (PDF/DOC/DOCX/RTF/TXT). Saves resume to `data/resumes/`. Returns `{ success, applicationId }`. |
| `/api/health/route.ts` | GET | Health check. Returns `{ status: "ok" }`. |

---

## 🔌 Key Integration Points

### Adding a New Block (end-to-end)

1. **`blockSchemas.ts`** — Add a `BlockSchema` entry with fields and defaults
2. **`registerXBlock.ts`** — Create in `apps/admin/app/editor/blocks/`, call `registerBlock(editor, schema)`
3. **`page.tsx` (editor)** — Import and call `registerXBlock(editor)` in the init function
4. **`renderer.tsx`** — Add a new case in the block type switch + create the React component
5. **Sidebar auto-renders** — No changes needed (reads schema dynamically)

### Swapping from Mock Data to Real ATS

1. Create `GreenhouseProvider` implementing `JobDataProvider` interface
2. Call `setJobProvider(new GreenhouseProvider(apiKey))` at app startup
3. Zero changes to API routes, hooks, or UI components

### Adding a New Tenant

1. POST to `/api/tenants` with `{ id: "mycompany", theme: {...}, branding: {...} }`
2. Or via DB: `prisma.tenant.create({ data: { id: "mycompany", name: "My Company" } })`
3. Access via `?tenantId=mycompany` on API routes or URL params

### Wiring Observability into a New Route

```typescript
// 1. Wrap with withRequestLogging (adds logging, metrics, bot detection)
import { withRequestLogging } from "@career-builder/observability/request-logger";
export const GET = withRequestLogging(async (req) => { ... });

// 2. Add tracing for expensive operations
import { withSpan } from "@career-builder/observability/tracing";
const result = await withSpan("db.fetchJobs", () => jobRepo.search(filters));

// 3. Check performance budget
import { checkBudget } from "@career-builder/observability/performance";
checkBudget("api", elapsed); // Logs warning if >500ms
```

### Adding a New Alert Channel

```typescript
import { alertManager, DatabaseAlertChannel } from "@career-builder/observability/alerts";

// Severity-based routing
alertManager.addChannelForSeverity("critical", new SlackAlertChannel(webhookUrl));

// Database persistence (already wired in admin via observability-init.ts)
alertManager.addChannel(new DatabaseAlertChannel(async (alert) => {
  await prisma.auditLog.create({ data: { action: `alert:${alert.severity}`, ... } });
}));
```

---

## ⚠️ Important Gotchas

### 1. `getSession()` vs `getSessionReadOnly()`
- `getSession()` writes a cookie (sliding renewal) → **crashes in Server Components**
- Use `getSessionReadOnly()` in any `page.tsx` or `layout.tsx` that's a server component
- Use `getSession()` only in API routes or client-side actions

### 2. GrapesJS Cleanup
- The editor must be fully cleaned up on unmount or navigation crashes occur
- Pattern: `mountedRef` guard on all callbacks + `editor.off()` + `stopListening()` before `destroy()`
- Never put mutable values in `useEffect` dependency arrays — use refs

### 3. Multi-line className Hydration
- Never use template literals with `\n` in JSX `className` props
- Server renders literal newlines, client collapses them → hydration mismatch
- Always use single-line strings or `cn()` utility

### 4. `[id]` Directory Imports
- TypeScript language server sometimes can't resolve relative imports inside `[id]` directories
- Use `@/app/jobs/[id]/ApplyModal` (absolute alias) instead of `./ApplyModal`
- The production build works either way; this is an IDE-only issue

### 5. Design Tokens Over Raw Theme
- Never read `theme.colors.primary` directly in components
- Always use `tokens.colors.primary` from `useTheme()` — these are pre-validated and computed
- `getAccent(color)` for per-block color overrides

### 6. Edge Runtime vs Node.js Runtime
- `middleware.ts` runs in Edge runtime — **cannot import** `node:crypto`, `node:async_hooks`, or any module that transitively imports them
- Use `rate-limiter-edge.ts` and `edge.ts` in middleware — these have zero Node.js imports
- Use the full `rate-limiter.ts`, `correlation.ts`, `logger.ts` etc. in route handlers (Node.js runtime)

### 7. DATABASE_URL Must Be Absolute
- All three `.env` files (root, admin, web) must use absolute `file:` paths to the SQLite DB
- Relative `file:./dev.db` breaks because Next.js runs from the app directory, not the prisma directory
- Correct: `file:/Users/.../packages/database/prisma/dev.db`

### 8. Zod v4 API Differences
- Project uses Zod v4 (installed as `^3.24.0` which resolves to v4)
- Use `z.record(z.string(), z.unknown())` NOT `z.record(z.unknown())`
- Errors are accessed via `error.issues` not `error.errors`

### 9. Audit Log FK Safety
- `writeAuditLog` in `auth.ts` validates the `userId` exists in the DB before writing
- This prevents FK constraint violations when stale session cookies reference deleted users
- Save operations and audit log writes are in independent try/catches — audit failure never blocks the main operation

### 10. Stripe Live Key Guard
- Checkout and Portal routes **reject `sk_live_` keys** when `getDeployEnvironment()` returns `"preview"` or `"development"`
- This prevents real charges during preview/staging deployments
- Uses `isProductionRuntime()` from `lib/env.ts` which excludes `next build` phase

### 11. Feature Flags
- Use `isEnabled("flag_name")` from `lib/feature-flags.ts` to gate features
- Flags can be overridden via env vars: `FEATURE_FLAG_AI_CONTENT_GENERATION=false`
- `dev_plan_switcher` is auto-disabled in production deploy environments
