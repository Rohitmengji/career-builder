# 🔍 Career Builder Platform — Full Audit Report

**Date:** March 25, 2026 (Updated)  
**Previous Audit:** March 24, 2026  
**Auditor:** Senior Architecture Review (15+ year level)  
**Codebase:** 170+ files · 36,000+ lines · Next.js 16 + GrapesJS + Prisma 6 + Stripe + Turso  
**Verdict:** Production-deployable MVP. All critical security blockers resolved. Zero-cost architecture validated. Prisma 6 driver adapter workaround documented and stable.

---

## 📊 EXECUTIVE SUMMARY

| Area | Score | Status | Change |
|------|-------|--------|--------|
| Visual Editor (GrapesJS) | 9/10 | ✅ Solid | — |
| Block System (Schema) | 9/10 | ✅ Solid | — |
| Renderer (Frontend) | 9/10 | ✅ Solid | — |
| AI System | 9/10 | ✅ Solid | ⬆️ +1 (daily user cap, abuse prevention) |
| Billing (Stripe) | 9/10 | ✅ Solid | ⬆️ +1 (live-key guard, CSRF, idempotency hardened) |
| Job Platform | 7/10 | ⚠️ Partial | — |
| Auth & Session | 9/10 | ✅ Solid | ⬆️ +3 (iron-session AES-256-GCM, bcrypt cost 12, getSessionReadOnly, RBAC with super_admin) |
| Security | 9/10 | ✅ Solid | ⬆️ +1 (feature flags, env fail-fast) |
| Observability | 9/10 | ✅ Solid | ⬆️ +1 (job queue handlers, periodic cleanup) |
| Multi-Tenant | 7/10 | ⚠️ Partial | ⬆️ +1 (env-based URL resolution) |
| Design System | 8/10 | ✅ Solid | — |
| Testing | 3/10 | ❌ Critical Gap | ⬆️ +1 (CI/CD pipeline added) |
| Performance | 7/10 | ⚠️ Partial | ⬆️ +1 (rate limiter tuning, cold start optimization) |
| Database | 9/10 | ✅ Solid | **NEW** — Prisma 6 driver adapter, withDbRetry, Turso migration workflow |
| **Deployment Readiness** | **9/10** | ✅ **Solid** | Readiness probe, feature flags, env validation, CI/CD |

---

## 🔧 ISSUES RESOLVED SINCE LAST AUDIT (March 23 → 24)

| # | Issue (was Critical) | Resolution | File(s) |
|---|---------------------|-----------|---------|
| 1 | **SHA-256 password hashing** | ✅ Replaced with bcrypt (cost 12) + auto-migration from legacy hashes | `lib/auth.ts` |
| 2 | **Base64 session tokens (forgeable)** | ✅ Replaced with iron-session (AES-256-GCM encrypted, tamper-proof cookies) | `lib/auth.ts`, `lib/session.ts` |
| 3 | **Hardcoded localhost:3001 in web app** | ✅ Uses `getAdminApiUrl()` with env fallback chain (ADMIN_API_URL → NEXT_PUBLIC_APP_URL → VERCEL_URL) | `apps/web/app/[slug]/page.tsx` |
| 4 | **No error pages** | ✅ Added `error.tsx`, `global-error.tsx`, `not-found.tsx` for both apps | Both apps |
| 5 | **SESSION_SECRET not required in prod** | ✅ Now throws at runtime if missing in production | `lib/env.ts`, `lib/session.ts` |
| 6 | **NEXT_PUBLIC_APP_URL not required in prod** | ✅ Now throws at runtime if missing in production | `lib/env.ts` |
| 7 | **Live Stripe keys in preview** | ✅ Checkout + portal reject `sk_live_` when `VERCEL_ENV=preview` | `checkout/route.ts`, `portal/route.ts` |
| 8 | **Webhook idempotency TTL too short** | ✅ Raised from 5min to 10min, cap from 1000 to 5000 entries | `webhook/route.ts` |
| 9 | **No per-user AI daily limit** | ✅ Added 200 req/day per-user cap (prevents IP rotation abuse) | `api/ai/route.ts` |
| 10 | **DB writes without retry** | ✅ All critical subscription ops wrapped with `withDbRetry()` for SQLite BUSY | `subscriptionRepo.ts` |
| 11 | **GET handlers write cookies (race condition)** | ✅ All GET routes use `getSessionReadOnly()` — no concurrent cookie writes | 12 route files |
| 12 | **Rate limit too aggressive on /api/auth** | ✅ Raised from 5/min to 30/min (GET session checks + POST logins share bucket) | `rate-limiter-edge.ts` |
| 13 | **Editor auth check forces logout on 429** | ✅ Now retries after 3s on 429/500 instead of redirecting to login | `editor/page.tsx` |
| 14 | **Stripe webhooks rate-limited at 10/min** | ✅ `/api/stripe/webhook` now 100/min (Stripe sends burst retries) | `rate-limiter-edge.ts` |
| 15 | **Dev endpoint accessible in Vercel production** | ✅ Blocked unless `VERCEL_ENV=preview` or `NODE_ENV!==production` | `dev/set-plan/route.ts` |
| 16 | **Missing useRouter import** | ✅ Fixed pre-existing build error in applications page | `applications/page.tsx` |

---

## 🔍 1. SYSTEM INVENTORY

### Module-by-Module Status

```json
[
  { "module": "Visual Editor (GrapesJS)", "status": "complete", "notes": "674-line editor page. Full save/load, autosave, multi-device preview, undo/redo, block palette, sidebar props editing. Well-integrated." },
  { "module": "Block System", "status": "complete", "notes": "31 registered blocks with schema-driven props. Generic registerBlock helper for consistent pattern. blockSchemas.ts (677 lines) defines all fields, types, defaults." },
  { "module": "Renderer (Web)", "status": "complete", "notes": "2,044-line renderer with 28 memo'd block components. Safe defaults for every block. Error boundary. Design token driven. Responsive. Accessible." },
  { "module": "AI Assistant", "status": "complete", "notes": "Full pipeline: types → prompts → validator → API route → UI. Dual API support (Responses + Chat). Schema validation. 5 actions: generate, improve, expand, generate-page, generate-job. Separate weekly job credits (25/week)." },
  { "module": "Stripe Billing", "status": "complete", "notes": "Checkout, webhook (5 events), portal, subscription lifecycle. Atomic credit decrement. Pre-pay model with refund on failure. Geo-pricing (4 regions)." },
  { "module": "Auth System", "status": "complete", "notes": "iron-session (AES-256-GCM encrypted cookies) + bcrypt (cost 12) with transparent SHA-256 auto-migration. RBAC: super_admin/admin/hiring_manager/recruiter/viewer. CSRF double-submit cookie. Rate limiting on login (5 attempts → 60s lockout). getSession() for writes, getSessionReadOnly() for reads. See RBAC_RULES.md." },
  { "module": "Database (Prisma)", "status": "complete", "notes": "9 models (including AppConfig), all tenant-isolated. 10 repository files. Prisma 6 with driver adapter: SQLite (dev) + Turso libsql (prod). withDbRetry() on all critical subscription ops. Comprehensive schema with ATS fields, billing, analytics, webhooks, audit logs." },
  { "module": "Security Package", "status": "complete", "notes": "1,930 lines across 9 modules: sanitize, validate (Zod), rate-limit, headers (CSP/HSTS), file-upload validation, URL (SSRF-safe), tenant isolation, crypto." },
  { "module": "Observability Package", "status": "complete", "notes": "3,878 lines across 16 modules: structured logger, correlation IDs, metrics, alerts, bot detection, anomaly detection, performance timers, API protection, tracing." },
  { "module": "Multi-Tenant Config", "status": "complete", "notes": "957 lines: theme types, design tokens, validation. Theme/branding stored per-tenant as JSON. ThemeProvider + design system on web app." },
  { "module": "Media Handling", "status": "partial", "notes": "Upload API + file serving. BUT: local filesystem only (no S3/CDN). No image optimization pipeline. No media library UI for browsing uploads." },
  { "module": "Job Platform (Admin)", "status": "complete", "notes": "590-line CRUD page. Create, edit, publish/unpublish, delete. AI job generation integrated. Validation + sanitization on API." },
  { "module": "Job Platform (Web)", "status": "complete", "notes": "Full search with facets, pagination, sorting. Job detail page with SEO metadata. Apply modal with resume upload. Related jobs. Swappable data provider pattern." },
  { "module": "Applications Management", "status": "partial", "notes": "297-line page. List + status filter. BUT: no pipeline Kanban view, no email notifications, no bulk actions, no interview scheduling." },
  { "module": "Dashboard", "status": "partial", "notes": "183-line page. KPI cards, pipeline status, recent applications. BUT: no charts, no date range filters, no real-time updates." },
  { "module": "Settings", "status": "complete", "notes": "559-line page. User management with RBAC. Tenant settings." },
  { "module": "Theme Editor", "status": "complete", "notes": "599-line page. Visual theme customization with live preview." },
  { "module": "Observability UI", "status": "complete", "notes": "361-line admin page for monitoring metrics." }
]
```

---

## 🧱 2. BLOCK SYSTEM AUDIT

### Inventory: 31 Blocks Registered

| # | Block | Schema | GrapesJS | Renderer | AI Support |
|---|-------|--------|----------|----------|-----------|
| 1 | Hero | ✅ | ✅ | ✅ | ✅ |
| 2 | Content | ✅ | ✅ | ✅ | ✅ |
| 3 | Features | ✅ | ✅ | ✅ | ✅ |
| 4 | Testimonial | ✅ | ✅ | ✅ | ✅ |
| 5 | Carousel | ✅ | ✅ | ✅ | ✅ |
| 6 | Accordion | ✅ | ✅ | ✅ | ✅ |
| 7 | CTA Button | ✅ | ✅ | ✅ | ✅ |
| 8 | Search Bar | ✅ | ✅ | ✅ | ✅ |
| 9 | Job Details | ✅ | ✅ | ✅ | ✅ |
| 10 | Job Category | ✅ | ✅ | ✅ | ✅ |
| 11 | Join Talent Network | ✅ | ✅ | ✅ | ✅ |
| 12 | Video & Text | ✅ | ✅ | ✅ | ✅ |
| 13 | Personalization | ✅ | ✅ | ✅ | ✅ |
| 14 | Show/Hide Tab | ✅ | ✅ | ✅ | ✅ |
| 15 | Image Text Grid | ✅ | ✅ | ✅ | ✅ |
| 16 | LightBox | ✅ | ✅ | ✅ | ✅ |
| 17 | Job Alert | ✅ | ✅ | ✅ | ✅ |
| 18 | Navigate Back | ✅ | ✅ | ✅ | ✅ |
| 19 | Basic Button | ✅ | ✅ | ✅ | ✅ |
| 20 | Basic Image | ✅ | ✅ | ✅ | ✅ |
| 21 | Spacer | ✅ | ✅ | ✅ | — |
| 22 | Divider | ✅ | ✅ | ✅ | — |
| 23 | Navbar | ✅ | ✅ | ✅ | ✅ |
| 24 | Footer | ✅ | ✅ | ✅ | ✅ |
| 25 | Notification Banner | ✅ | ✅ | ✅ | ✅ |
| 26 | Stats Counter | ✅ | ✅ | ✅ | ✅ |
| 27 | Team Grid | ✅ | ✅ | ✅ | ✅ |
| 28 | Social Proof | ✅ | ✅ | ✅ | ✅ |
| 29 | Application Status | ✅ | ✅ | ✅ | ✅ |
| 30 | Job List | ✅ | ✅ | ✅ | ✅ |
| 31 | Search Results | — | — | ✅ | — |

### Strengths
- **Schema-driven**: Every block has typed fields, defaults, and labels in `blockSchemas.ts`
- **Generic registration**: `registerBlock.ts` (127 lines) provides a reusable pattern — no copy-paste boilerplate
- **Renderer parity**: All 28+ blocks have matching renderer components with safe defaults
- **AI-aware**: Prompts reference block schemas for structured output

### Weaknesses
- **No block versioning** — if you change a schema, existing pages with old props may break silently
- **No block-level preview in sidebar** — the sidebar shows fields, not a visual thumbnail
- **All blocks in one renderer.tsx** (2,044 lines) — should be split into per-block files for maintainability

---

## 💼 3. JOB PLATFORM AUDIT

### Admin Side
| Feature | Status | Notes |
|---------|--------|-------|
| Job CRUD | ✅ | Full create/edit/delete with validation |
| Publish/Unpublish | ✅ | Toggle in UI |
| Job Form | ✅ | Rich fields: salary, requirements, benefits, tags |
| AI Job Generation | ✅ | 25 weekly credits, separate pool |
| Job Slugs | ✅ | Auto-generated, unique per tenant |
| ATS Fields | ✅ Schema | `externalId`, `externalSource`, `externalUrl` — fields exist but no integration built |
| Bulk Actions | ❌ | Cannot bulk publish/archive/delete |
| Job Templates | ❌ | No saved templates for common roles |
| Job Analytics | ❌ | No per-job view/apply/conversion metrics in admin |
| Close Date Enforcement | ❌ | `closesAt` field exists but not enforced (expired jobs still show) |

### Web Side (Public)
| Feature | Status | Notes |
|---------|--------|-------|
| Job Search | ✅ | Text search + filters |
| Faceted Filters | ✅ | Location, department, type, level, remote |
| Pagination | ✅ | URL-synced, proper page/perPage |
| Job Detail Page | ✅ | Server-rendered with SEO metadata |
| Related Jobs | ✅ | Shown on detail page |
| Apply Flow | ✅ | Modal with resume upload + URL, validated, rate-limited |
| Apply to DB | ✅ | Full Application model with status tracking |
| Job Bookmarking | ❌ | No save/bookmark for candidates |
| Social Sharing | ❌ | No share buttons or OG tags per job |
| Job Alerts / Subscriptions | ❌ | Block exists in editor but no backend for email alerts |
| Structured Data (JSON-LD) | ❌ | Renderer is "JSON-LD ready" per comments but not implemented |

### ATS Readiness
| Feature | Status |
|---------|--------|
| Application Pipeline | ⚠️ Status field exists (applied→screening→interview→offer→hired→rejected) but no pipeline UI |
| Email Notifications | ❌ No email on application, status change, etc. |
| Interview Scheduling | ❌ Not built |
| Candidate Scoring | ⚠️ `rating` field exists, no UI for it |
| Webhook on Events | ⚠️ Schema exists, no event dispatch implemented |
| ATS Import/Export | ❌ Fields exist, no Greenhouse/Lever integration |

---

## 💳 4. BILLING SYSTEM AUDIT

### Implemented ✅
| Feature | Implementation |
|---------|---------------|
| Stripe Checkout | `/api/stripe/checkout` — creates customer + session |
| Webhook Handler | `/api/stripe/webhook` — 5 events with signature verification + idempotency |
| Subscription Lifecycle | activate → renew → past_due → cancel — all handled |
| Credit System | `aiCredits` (500/month Pro, 2500/month Enterprise) + `jobAiCredits` (25/week job AI) |
| Atomic Decrement | `updateMany` with `credits > 0` condition — race-safe |
| Pre-pay Model | Credit deducted BEFORE OpenAI call, refunded on failure |
| Billing Portal | Stripe Customer Portal redirect |
| Geo-Pricing | 4 regions (US/UK/EU/IN) with timezone + language detection |
| Dev Plan Switcher | Toggle plans in development without Stripe |

### Gaps / Risks
| Issue | Severity | Details |
|-------|----------|---------|
| **No trial period** | Medium | No `trialing` state flow even though field exists |
| **No invoice email** | Medium | Stripe sends receipts but no custom email from app |
| **No usage-based billing** | Low | Fixed credit pools only, no per-API-call pricing |
| **SQLite in dev** | High | `@default(0)` works differently in SQLite vs Postgres — test with Postgres before production |
| **Plan on both User AND Tenant** | Medium | `plan` exists on both User and Tenant models — which is authoritative? Currently User. Tenant plan field is unused. This will cause confusion at scale. |
| **No subscription downgrade handling** | Medium | Switching Enterprise→Pro doesn't prorate or handle in-flight credits cleanly |
| **Webhook secret was placeholder** | Resolved | Was `whsec_REPLACE_ME`, now has real value |

---

## 🤖 5. AI SYSTEM AUDIT

### Pipeline: Prompt → API → Validate → Apply ✅

| Layer | Status | File | Lines |
|-------|--------|------|-------|
| Types | ✅ | `lib/ai/types.ts` | 209 |
| Prompts | ✅ | `lib/ai/prompts.ts` | — |
| Validator | ✅ | `lib/ai/validator.ts` | — |
| API Route | ✅ | `api/ai/route.ts` | ~500 |
| UI (Page AI) | ✅ | `AiAssistant.tsx` | 1,365 |
| UI (Job AI) | ✅ | `AiJobAssistant.tsx` | ~700 |
| Subscription Hook | ✅ | `useSubscription.ts` | ~160 |
| Geo Pricing | ✅ | `useGeoPricing.ts` | — |
| Upgrade Modal | ✅ | `UpgradeModal.tsx` | ~270 |

### Strengths
- **3-layer credit enforcement**: UI disabled → client check → server atomic decrement
- **Schema-aware validation**: AI output validated against blockSchemas
- **Safe JSON parsing**: `parseAiJson` handles markdown fences, trailing commas
- **Rate limiting per action**: Different limits for generate (15/min) vs improve (30/min)
- **Cache with credit deduction**: Cached responses still deduct credits (no bypass)

### Gaps
| Issue | Severity |
|-------|----------|
| **No streaming** | Low — responses are fast enough with `gpt-5.4-mini` but streaming would improve perceived performance for page generation |
| **No AI content history** | Medium — user can't see/revert previous AI generations |
| **No content moderation** | Medium — AI output isn't checked for inappropriate content before showing to user |
| **No token count tracking** | Low — tracking OpenAI token usage would help with cost forecasting |

---

## 🎨 6. UI/UX + DESIGN SYSTEM AUDIT

### Design System ✅
- **`design-system.ts`** (591 lines): Safe string/array/url helpers, contrast functions, image optimization, responsive utilities
- **`design-system-components.tsx`** (552 lines): `VisuallyHidden`, `LazyImage`, `ResponsiveDrawer`, `IconButton`, `useIsMobile`, `useReducedMotion`
- **`ThemeProvider.tsx`** (190 lines): Context-based theme delivery with `useTheme()` hook
- **`tenant-config/tokens.ts`** (354 lines): Typed design tokens with spacing, typography, shadows

### Accessibility (WCAG)
| Feature | Status |
|---------|--------|
| Semantic HTML | ✅ Landmarks, headings hierarchy in renderer |
| Skip link | ✅ `<SkipLink>` in slug pages |
| ARIA attributes | ✅ `aria-label`, `aria-expanded`, roles throughout renderer |
| Keyboard navigation | ⚠️ Accordion, tabs have keyboard support; modal focus trap needs verification |
| Color contrast | ✅ `getReadableTextColor()`, `ensureContrast()` utilities |
| Reduced motion | ✅ `useReducedMotion()` hook |
| Screen reader text | ✅ `VisuallyHidden` component, `srText()` helper |

### Gaps
| Issue | Severity |
|-------|----------|
| **No loading skeletons** | Medium — pages show spinner, not skeleton UI |
| **No empty state illustrations** | Low — empty lists show text only |
| **Admin UI inconsistency** | Medium — admin pages use raw Tailwind; web renderer uses design system tokens. Two different styling philosophies. |
| **No dark mode** | Low — no theme toggle for admin or web |

---

## 🔐 7. SECURITY AUDIT

### Strengths ✅
| Feature | Implementation |
|---------|---------------|
| Auth protection | Cookie-based sessions, httpOnly, secure in prod |
| CSRF protection | Double-submit cookie pattern in middleware |
| Input validation | Zod schemas (`@career-builder/security/validate`) for all API routes |
| Sanitization | `sanitizeString`, `sanitizeEmail`, `stripHtml`, `sanitizeSlug` |
| Rate limiting | 3 layers: edge middleware, per-route, per-login |
| Security headers | CSP, HSTS, X-Frame-Options, X-Content-Type-Options via `next.config.ts` + middleware |
| File upload | Type, size, extension validation; path traversal prevention |
| URL validation | SSRF-safe with blocklist (localhost, private IPs) |
| Webhook security | Stripe signature verification + idempotency dedup |
| Audit logging | All mutations logged to DB with userId, entity, IP |

### 🚨 CRITICAL ISSUES

| Issue | Severity | Details |
|-------|----------|---------|
| ~~**SHA-256 password hashing**~~ | ✅ RESOLVED | Now uses bcrypt (cost 12) with transparent auto-migration from legacy SHA-256 on login |
| ~~**Base64 session tokens (not signed)**~~ | ✅ RESOLVED | Now uses iron-session (AES-256-GCM encrypted, tamper-proof cookies). `getSession()` for writes, `getSessionReadOnly()` for reads. |
| ~~**`AUTH_SECRET` has weak default**~~ | ✅ RESOLVED | `SESSION_SECRET` is required in production (throws if missing). Dev fallback is deterministic for HMR. |
| **No password complexity enforcement** | 🟡 MEDIUM | Zod schema enforces `min(6).max(128)` but no uppercase/number/symbol requirement |
| **No email verification** | 🟡 MEDIUM | Users created without email confirmation |
| **No account lockout persistence** | 🟡 LOW | Rate limit map is in-memory — resets on server restart |

---

## 🔭 8. OBSERVABILITY AUDIT

### Implemented ✅
| Module | Lines | Purpose |
|--------|-------|---------|
| Logger | 262 | Structured JSON, PII redaction, log levels |
| Correlation | 90 | Request ID via AsyncLocalStorage |
| Metrics | 367 | Counters, histograms, gauges (Prometheus-style) |
| Alerts | 354 | Slack/email/console with cooldowns |
| Bot Detection | 349 | Multi-signal scoring + IP blocklist |
| Anomaly Detection | 215 | Z-score on traffic patterns |
| Request Logger | 260 | Route handler wrapper with metrics + bot check |
| Performance | 260 | Timer utilities for DB/render profiling |
| API Protection | 227 | Payload limits, timeout, JSON depth |
| Rate Limiter | 307 + 152 | Sliding window (Node + Edge) |
| Persistence | 292 | Periodic metric snapshots |
| Tracing | 274 | Span-based tracing |
| Sentry | 147 | Error reporting integration stub |

### Gaps
| Issue | Notes |
|-------|-------|
| **All in-memory** | Metrics, alerts, rate limits reset on server restart. No Redis/external persistence. |
| **No Prometheus endpoint** | Metrics are collected but no `/metrics` scraping endpoint for Grafana/Prometheus |
| **No distributed tracing** | Tracing module exists but no OpenTelemetry export to Jaeger/Zipkin |
| **Sentry stub** | `sentry.ts` exists but is a placeholder — not connected to real Sentry DSN |
| **Admin observability page** | 361-line page shows metrics but is basic — no charting library |

---

## 🏗️ 9. MULTI-TENANT ARCHITECTURE AUDIT

### Implemented ✅
| Feature | Status |
|---------|--------|
| Tenant model | ✅ With theme, branding, settings, plan |
| All entities have `tenantId` | ✅ User, Job, Application, Page, AuditLog, Analytics, Webhook |
| Tenant-scoped queries | ✅ All repos use `findByTenant(tenantId)` |
| Unique constraints | ✅ `@@unique([email, tenantId])`, `@@unique([slug, tenantId])` |
| Tenant-aware theme | ✅ ThemeProvider on web, theme editor on admin |
| Tenant config package | ✅ 957 lines with validation + defaults |

### 🚨 CRITICAL ISSUES

| Issue | Severity | Details |
|-------|----------|---------|
| **Hardcoded `localhost:3001`** | 🔴 HIGH | Web app `[slug]/page.tsx` fetches `http://localhost:3001/api/pages` and `http://localhost:3001/api/tenants` — hardcoded URLs. Won't work in production. Must use env var or internal service URL. |
| **Single `TENANT_ID` env var** | 🟡 MEDIUM | Admin app uses `process.env.TENANT_ID || "default"` globally. True multi-tenancy requires tenant resolution from domain/subdomain/header, not a static env var. Currently one admin instance = one tenant. |
| **Plan on User AND Tenant** | 🟡 MEDIUM | Both models have a `plan` field. Billing uses `User.plan`. `Tenant.plan` is orphaned. This will cause bugs. |
| **No tenant-level billing** | 🟡 MEDIUM | Credits are per-user, not per-organization. If a company has 5 admins, each gets separate credit pools. |
| **Web app has no auth** | By Design | Public career site — correct. But tenant admin API calls from web app have no authentication. The web app trusts the admin API blindly. |

---

## ⚡ 10. PERFORMANCE AUDIT

### Strengths
| Feature | Status |
|---------|--------|
| `memo()` on all renderer blocks | ✅ Prevents unnecessary re-renders |
| `LazyImage` component | ✅ Intersection Observer lazy loading with srcset |
| Server-rendered job detail page | ✅ SSR with `revalidate: 60` |
| `reactCompiler: true` | ✅ Next.js React Compiler enabled |
| Response caching on AI | ✅ 5-min cache on AI responses |

### Gaps
| Issue | Severity |
|-------|----------|
| **No ISR for career pages** | Medium — `[slug]/page.tsx` uses `cache: "no-store"` (SSR on every request). Should use ISR with revalidation. |
| **No CDN for media** | Medium — images served from local filesystem via API route. No CloudFront/Vercel Image Optimization. |
| **2,044-line renderer** | Low — single large file. Tree-shaking works but code-splitting per block would be better. |
| **No database connection pooling config** | Medium — SQLite doesn't need it, but PostgreSQL will. No Prisma `connection_limit` or PgBouncer config. |
| **No Edge caching headers** | Medium — API responses don't set `Cache-Control` headers. Browser re-fetches everything. |
| **Job search is server-side only** | Low — no client-side caching of search results. Every filter change = full API round-trip. |

---

## 🧪 11. TESTING COVERAGE

### Current State: 🟡 Improved (CI/CD added, unit tests still needed)

| Type | Files Found | Coverage |
|------|-------------|----------|
| Unit Tests | 0 | 0% |
| Integration Tests | 0 | 0% |
| E2E (Playwright) | 1 (`ui-audit.spec.ts`) | UI visual audit only — not functional tests |
| CI/CD Pipeline | 1 (`.github/workflows/ci.yml`) | ✅ Install → Type Check → Lint → Build on every PR |

**What exists:**
- ✅ **GitHub Actions CI/CD** — runs on every PR: install, type-check, lint, build
- Playwright config and a UI audit spec for visual regression / accessibility
- Scripts: `ui:audit`, `ui:fix`, `ui:heal` — automated UI quality checking
- No Jest, Vitest, or any unit test framework configured

**What's missing:**
- Zero unit tests for repositories, auth, validation, AI validator
- Zero integration tests for API routes
- Zero E2E tests for user flows (login → create job → publish → apply)
- ✅ CI/CD pipeline exists (`.github/workflows/ci.yml`) — catches build + lint + type errors

---

## 📋 FINAL REPORT

### ✅ IMPLEMENTED (Solid)

1. **Visual Editor** — GrapesJS with 31 schema-driven blocks, save/load, autosave, device preview
2. **Schema-Driven Blocks** — blockSchemas.ts defines all fields; registerBlock.ts provides generic pattern
3. **Renderer** — 2,044-line renderer with 28 memo'd components, safe defaults, error boundaries
4. **AI Content Generation** — 5 actions, schema validation, dual API support, 3-layer credit enforcement
5. **Stripe Billing** — Full checkout → webhook → portal lifecycle with atomic credits
6. **Job Credits** — Separate weekly pool (25/week) with auto-reset
7. **Job CRUD (Admin)** — Full create/edit/delete/publish with AI generation
8. **Job Search (Web)** — Faceted search, pagination, sorting, URL-synced filters
9. **Apply Workflow** — Resume upload + URL, validated, rate-limited, stored to DB
10. **Security Package** — Input validation, sanitization, rate limiting, CSRF, file upload safety, SSRF protection
11. **Observability Package** — Structured logging, metrics, bot detection, anomaly detection, correlation IDs
12. **Design System** — Token-based styling, accessible components, responsive utilities, contrast helpers
13. **Multi-Tenant Schema** — All entities tenant-isolated with proper indexes and unique constraints
14. **Theme Editor** — Visual customization with live preview
15. **Audit Logging** — All mutations logged to DB

### ⚠️ PARTIALLY IMPLEMENTED

1. **Auth System** → Missing: secure password hashing (bcrypt), signed session tokens, email verification, password complexity
2. **Application Management** → Missing: Kanban pipeline view, email notifications, bulk actions, interview scheduling
3. **Dashboard** → Missing: charts, date range filters, trend analysis
4. **Media System** → Missing: S3/CDN storage, image optimization pipeline, media library browser
5. **Multi-Tenant Routing** → Missing: domain-based tenant resolution (currently env-var static), hardcoded localhost URLs
6. **ATS Integration** → Missing: Greenhouse/Lever/Workday API connectors (schema fields exist)
7. **Webhook Dispatch** → Missing: event publishing to registered webhooks (schema + admin exists, no dispatch logic)
8. **Observability Persistence** → Missing: external storage (Redis/Prometheus/Sentry connected)

### ❌ MISSING (Critical)

1. **Testing** → Zero unit/integration/E2E tests. Most critical gap. Any refactor or feature addition is risky without regression safety.
2. ~~**CI/CD Pipeline**~~ → ✅ RESOLVED: GitHub Actions CI/CD — Install → Type Check → Lint → Build on every PR.
3. **Email System** → No transactional emails: no application confirmation, no password reset, no job alerts, no status change notifications.
4. ~~**Signed Session Tokens**~~ → ✅ RESOLVED: iron-session AES-256-GCM encrypted cookies
5. ~~**bcrypt/argon2 Passwords**~~ → ✅ RESOLVED: bcrypt cost 12 with auto-migration
6. **Production Database** → ✅ RESOLVED: Turso libsql via Prisma 6 driver adapter. `push-turso.ts` for migrations. `withDbRetry()` on critical paths. See `DATABASE.md`.
7. **CDN / Asset Pipeline** → No image optimization, no CDN, no static asset caching strategy.
8. ~~**Error Pages**~~ → ✅ RESOLVED: Both apps have `error.tsx`, `global-error.tsx`, `not-found.tsx`

### 🚨 RISKS / TECH DEBT

| Risk | Impact | Effort to Fix | Status |
|------|--------|---------------|--------|
| ~~**Forgeable session tokens**~~ | ~~Anyone can become admin~~ | ~~2 hours~~ | ✅ Fixed (iron-session) |
| ~~**Weak password hashing**~~ | ~~Leaked DB = compromised~~ | ~~1 hour~~ | ✅ Fixed (bcrypt cost 12) |
| ~~**Hardcoded localhost:3001**~~ | ~~Web app broken in prod~~ | ~~30 min~~ | ✅ Fixed (env var chain) |
| **Zero tests** | Every change is a gamble | Weeks (ongoing) | ⚠️ CI/CD added, tests next |
| **2,044-line renderer.tsx** | Hard to maintain | 2-3 hours | ❌ Not started |
| **Plan field on both User and Tenant** | Billing confusion at scale | 1 hour | ❌ Not started |
| **In-memory rate limits / metrics** | Reset on every deploy | Medium (add Redis) | ⚠️ Acceptable for MVP |
| **No email system** | Candidates get zero feedback | Days (integrate Resend) | ❌ Not started |
| ~~**SQLite in production**~~ | ~~Ephemeral on Vercel~~ | ~~1 day (Turso/Neon)~~ | ✅ Fixed (Turso libsql) |

---

## 📏 ENGINEERING VERDICT (Updated March 24)

> **"Would this pass a senior backend + frontend architecture review at a SaaS company?"**

**Architecture: YES** — Monorepo structure, package separation, repository pattern, schema-driven blocks, and provider interfaces are professional-grade.

**Feature completeness: YES for MVP** — Visual editor, AI, billing, job search, apply flow — the core product loop works end-to-end.

**Security: YES** — All critical blockers resolved:
- ✅ iron-session AES-256-GCM encrypted cookies (tamper-proof)
- ✅ bcrypt cost 12 password hashing with auto-migration
- ✅ CSRF double-submit cookie on all mutations
- ✅ Zod validation on every API endpoint
- ✅ CSP + HSTS + security headers
- ✅ Rate limiting (edge + route + per-user daily)
- ✅ File upload validation (magic bytes, MIME, path traversal)
- ✅ Feature flags with production safety guards

**Deployment readiness: YES** — Readiness probe, health checks, env fail-fast, Stripe preview safety, and graceful error handling all in place.

**Remaining priority: Test coverage.** The biggest long-term risk is zero tests. Every feature added without tests increases the fragility cliff.
