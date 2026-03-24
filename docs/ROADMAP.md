# Roadmap & Future Features

> What's next, what's missing, and improvement opportunities for the Career Builder platform.

---

## ✅ Completed (Previously on Roadmap)

These items from the original roadmap have been implemented:

| # | Feature | Status | Where |
|---|---------|--------|-------|
| 1 | **Database migration** | ✅ Done | `packages/database/` — Prisma + SQLite, 8 models, 9 repositories, seed data |
| 2 | **Input sanitization** | ✅ Done | `packages/security/sanitize.ts` — XSS prevention, HTML stripping, block prop sanitization |
| 3 | **Zod validation** | ✅ Done | `packages/security/validate.ts` — 12 schemas for all API inputs |
| 4 | **Job Management Admin** | ✅ Done | `/admin/jobs` page + `/api/admin/jobs` route — CRUD, publish/unpublish |
| 5 | **Application Tracking** | ✅ Done | `/admin/applications` page + `/api/admin/applications` — filter, update status |
| 6 | **Admin activity dashboard** | ✅ Done | `/admin/dashboard` + `/api/admin/analytics` — stats and overview |
| 7 | **Security package** | ✅ Done | `packages/security/` — 9 modules (sanitize, validate, rate-limit, headers, middleware, file-upload, url, tenant, crypto) |
| 8 | **Observability** | ✅ Done | `packages/observability/` — 16 modules including enterprise features (tracing, budgets, persistence, edge) |
| 9 | **Rate limiting** | ✅ Done | Edge middleware (rate-limiter-edge) + route handlers (rate-limiter) + security package (rate-limit) |
| 10 | **CSP headers** | ✅ Done | `packages/security/headers.ts` — configured for GrapesJS compatibility |
| 11 | **Environment config** | ✅ Done | `.env` files for DATABASE_URL, AUTH_SECRET, NEXT_PUBLIC_SITE_URL |
| 12 | **AI Content Generation** | ✅ Done | `lib/ai/` — 5 AI actions, GPT-5.4-mini via Responses API, schema-validated output, side-by-side diff, per-field checkboxes |
| 13 | **AI Job Generation** | ✅ Done | `AiJobAssistant.tsx` — generates complete job postings from natural language |
| 14 | **Subscription Gating** | ✅ Done | `useSubscription.ts` (server-side fetch), `UpgradeModal.tsx`, `DevPlanSwitcher.tsx` — Free/Pro/Enterprise plans with credit system |
| 15 | **Stripe Billing** | ✅ Done | Checkout, webhooks, customer portal, subscription repo, server-side AI guard, atomic credit decrement |
| 16 | **Geo-Based Pricing** | ✅ Done | `useGeoPricing.ts` — 3 API cascade, timezone/language fallback, US/UK/EU/India pricing |
| 17 | **Design System** | ✅ Done | `design-system.ts` (592 lines) + `design-system-components.tsx` (553 lines) — spacing, typography, a11y components, scroll reveal |
| 18 | **Scroll Reveal Animations** | ✅ Done | `useScrollReveal.ts` — IntersectionObserver-based, respects prefers-reduced-motion |
| 19 | **Billing Portal** | ✅ Done | `BillingPortalButton.tsx` + `/api/stripe/portal` — self-service subscription management via Stripe-hosted portal |
| 20 | **30+ Visual Blocks** | ✅ Done | Hero, JobList, Content, Features, Testimonial, Carousel, Accordion, CTA, Search, JobDetails, JobCategory, JoinTalentNetwork, VideoAndText, Personalization, ShowHideTab, ImageTextGrid, LightBox, JobAlert, NavigateBack, BasicButton, BasicImage, Spacer, Divider, Navbar, Footer, NotificationBanner, StatsCounter, TeamGrid, SocialProof, ApplicationStatus |
| 21 | **Production Env Validation** | ✅ Done | `lib/env.ts` — SESSION_SECRET and NEXT_PUBLIC_APP_URL required in production, `isProductionRuntime()` helper |
| 22 | **Stripe Live Key Guard** | ✅ Done | Checkout + Portal routes reject `sk_live_` keys in non-production deploy environments |
| 23 | **Webhook Idempotency Hardened** | ✅ Done | TTL raised 5→10 min, cap raised 1000→5000 entries, forced cleanup on overflow |
| 24 | **AI Per-User Daily Limit** | ✅ Done | 200 calls/day per user, auto-cleanup of stale entries |
| 25 | **DB Retry on All Critical Paths** | ✅ Done | `subscriptionRepo.ts` — `updateStatus`, `resetCredits`, `resetJobCredits`, `decrementCredit`, `decrementJobCredit` wrapped with `withDbRetry()` |
| 26 | **Feature Flags** | ✅ Done | `lib/feature-flags.ts` — 7 flags, env override, deploy-environment scoping |
| 27 | **Background Job Handlers** | ✅ Done | `lib/jobs/handlers.ts` — audit-log-flush, webhook-retry, periodic-cleanup (90d audit, 180d analytics) |
| 28 | **Readiness Probe** | ✅ Done | `/api/ready` — checks DB health + required env vars, returns 200/503 for deployment orchestration |
| 29 | **Auth Session Safety** | ✅ Done | All GET handlers use `getSessionReadOnly()` (no cookie write), rate limits 30/min for auth, 429 retry in editor |

---

## 🚨 Known Gaps & Technical Debt

### Critical — Fix Before Production

| # | Issue | Where | Impact | Status |
|---|-------|-------|--------|--------|
| ~~1~~ | ~~**No real password hashing library**~~ | ~~`auth.ts`~~ | ~~Insecure~~ | ✅ Fixed (bcrypt cost 12) |
| ~~2~~ | ~~**AUTH_SECRET is hardcoded default**~~ | ~~`auth.ts`~~ | ~~Forgeable sessions~~ | ✅ Fixed (iron-session, SESSION_SECRET required in prod) |
| ~~3~~ | ~~**No HTTPS enforcement**~~ | ~~Both apps~~ | ~~Cookies over HTTP~~ | ✅ Fixed (HSTS headers, secure cookies in prod) |
| 4 | **Resume files stored on local disk** | `api/jobs/apply/route.ts` | Lost on deploy; no CDN | ❌ Migrate to S3/R2 |
| 5 | **Old `lib/jobs.ts` still exists** | `apps/web/lib/jobs.ts` | Confusion — legacy file | ❌ Delete |
| 6 | **`renderer.tsx.bak` still exists** | `apps/web/lib/renderer.tsx.bak` | 1179-line backup | ❌ Delete |
| 7 | **SQLite in production** | `packages/database/` | No concurrent writes, ephemeral | ❌ Migrate to Turso/Neon |
| 8 | **Observability data is in-memory** | `packages/observability/` | Resets on process restart | ⚠️ Acceptable for MVP |

### Important — Improve Quality

| # | Issue | Where | Impact | Status |
|---|-------|-------|--------|--------|
| 8 | **Zero test coverage** | Entire codebase | No regression safety | ❌ Not started |
| ~~9~~ | ~~**No error boundary**~~ | ~~`renderer.tsx`~~ | ~~Broken block crashes page~~ | ✅ Fixed (error.tsx, global-error.tsx) |
| ~~10~~ | ~~**No loading states on page transitions**~~ | ~~`[slug]/page.tsx`~~ | ~~Blank screen~~ | ✅ Fixed (loading.tsx) |
| 11 | **SSE has no reconnection backoff** | Preview system | Aggressive reconnect could DoS | ⚠️ Connection cap (50) added |
| 12 | **No pagination on admin pages list** | `api/pages` | Slows with 100+ pages | ❌ Not started |
| 13 | **Job search not indexed** | `engine.ts` | Full scan; fine for 100 jobs | ❌ Not started |
| 14 | **No image optimization** | Media uploads | Raw files served | ❌ Not started |
| 15 | **File-based store still used alongside DB** | `store.ts`, `tenantStore.ts` | Dual storage | ❌ Not started |

---

## 🗺️ Feature Roadmap

### Phase 1: Production Hardening (1 week)

| # | Feature | Description | Priority |
|---|---------|-------------|----------|
| 1 | **PostgreSQL migration** | Switch Prisma datasource from SQLite to PostgreSQL. Add connection pooling. Production-ready. | 🔴 Critical |
| 2 | **Cloud file storage** | Upload resumes and media to S3/Cloudflare R2 instead of local disk. Signed URLs for private resumes. | 🔴 Critical |
| 3 | **Test suite** | Unit tests for engine.ts, validation.ts, tokens.ts, repositories. Integration tests for API routes. E2E tests for editor flow. Use Vitest + Playwright. | 🔴 Critical |
| 4 | **Error boundaries** | Wrap each block in `<ErrorBoundary>`. Show fallback UI instead of white screen. Log errors to observability. | 🟡 High |
| 5 | **Remove legacy files** | Delete `apps/web/lib/jobs.ts`. Remove file-based stores (use DB exclusively). | 🟢 Easy |
| 6 | **External metrics storage** | Move metrics history, alert history, rate limit state to Redis or TimescaleDB so they survive process restarts. | 🟡 High |

### Phase 2: ATS Integration (2-4 weeks)

| # | Feature | Description | Priority |
|---|---------|-------------|----------|
| 7 | **Greenhouse integration** | `GreenhouseProvider` implementing `JobDataProvider`. Pull jobs via Harvest API. Push applications back. Sync job status. Webhook listener for real-time updates. | 🔴 Critical |
| 8 | **Lever integration** | Same pattern as Greenhouse but for Lever's API. | 🟡 High |
| 9 | **Workday integration** | Enterprise ATS connector. More complex auth (OAuth 2.0, SOAP fallback). | 🟡 High |
| 10 | **ATS admin config** | UI in admin app to configure ATS connection: API key, sync frequency, field mapping, error dashboard. | 🟡 High |
| 11 | **Webhook system** | Inbound webhooks from ATS (job updated, application status changed). Outbound webhooks for custom integrations. `Webhook` model already exists in DB. | 🟢 Medium |

### Phase 3: Advanced Features (ongoing)

| # | Feature | Description | Priority |
|---|---------|-------------|----------|
| 12 | **Themed job pages** | Apply tenant theme to `/jobs` and `/jobs/[id]` so they match the visual builder output. Currently these pages use plain Tailwind colors. | 🟡 High |
| 13 | **SEO & structured data** | JSON-LD `JobPosting` schema on detail pages. Dynamic `sitemap.xml`. OpenGraph + Twitter Card meta. | 🟡 High |
| 14 | **Email notifications** | Confirmation email to applicants (React Email templates). Alert emails to hiring managers. Digest emails. | 🟡 High |
| 15 | **Draft/Publish workflow** | Pages and jobs have draft/published states. Preview drafts before going live. | 🟡 High |
| 16 | **Bulk operations** | Select multiple jobs/applications. Bulk publish, archive, delete, export to CSV. | 🟡 High |
| 17 | **Advanced search** | Autocomplete, salary range slider, map-based location filter, saved searches. | 🟢 Medium |
| 18 | **i18n / Multi-language** | Translate job listings and UI. Language switcher. RTL support. Per-tenant translations. | 🟢 Medium |
| 19 | **A/B testing** | Test different page layouts, CTA copy, apply form designs. Traffic splitting + conversion measurement. | 🟢 Medium |
| 20 | **Mobile optimization** | Bottom sheet filters, swipeable job cards, sticky apply bar, touch-optimized inputs. | 🟢 Medium |
| 21 | **Job alerts** | Visitors subscribe to email alerts for new jobs matching their criteria. | 🟢 Medium |

---

## 🏗️ Implementation Notes for Key Features

### PostgreSQL Migration (Feature #1)

The Prisma schema is already PostgreSQL-compatible. Steps:

1. `datasource db { provider = "postgresql" }` in schema.prisma
2. Set `DATABASE_URL` to PostgreSQL connection string
3. `npx prisma migrate dev` to create migration
4. Add `@db.Text` annotations for large text fields
5. Add connection pooling (PgBouncer or Prisma Accelerate)

### ATS Integration (Feature #7)

The provider pattern is already in place. Implementation for Greenhouse:

```typescript
class GreenhouseProvider implements JobDataProvider {
  constructor(private apiKey: string, private boardToken: string) {}

  async search(params: JobSearchParams): Promise<JobSearchResponse> {
    // GET https://harvest.greenhouse.io/v1/jobs?status=open
    // Transform Greenhouse Job → our Job type
    // Apply local filtering/facets (Greenhouse API has limited filtering)
  }

  async getById(id: string): Promise<JobDetailResponse> {
    // GET https://harvest.greenhouse.io/v1/jobs/{id}
  }

  async apply(app: JobApplication): Promise<ApplyResponse> {
    // POST https://harvest.greenhouse.io/v1/applications
  }
}
```

### External Metrics Storage (Feature #6)

Replace in-memory stores with Redis:

```typescript
// Replace MetricsHistory in-memory array with Redis time-series
// Replace rate limiter Map with Redis sorted sets
// Replace alert history with AuditLog DB queries (already wired via DatabaseAlertChannel)
// Replace bot blocklist with Redis sets (shared across instances)
```

### Test Suite (Feature #3)

```bash
npm install -D vitest @testing-library/react @playwright/test
```

**Priority test targets:**
1. `engine.ts` — `queryJobs()`, `searchScore()`, `buildFacets()` (pure functions, easy to test)
2. `packages/security/validate.ts` — all 12 Zod schemas with edge cases
3. `packages/security/sanitize.ts` — XSS vectors, null inputs, unicode
4. `packages/database/repositories/` — CRUD operations with test database
5. `packages/observability/metrics.ts` — counter/histogram/gauge behavior
6. API routes — integration tests with mock request/response
7. Editor flow — Playwright E2E: login → add block → save → verify on public site

---

## 📋 Quick Wins (< 1 hour each)

- [ ] Delete `apps/web/lib/jobs.ts` (legacy file)
- [x] ~~Add `<ErrorBoundary>` wrapper in `renderer.tsx`~~ — Done (error.tsx + global-error.tsx)
- [ ] Add `robots.txt` and basic `sitemap.xml`
- [x] ~~Add `loading.tsx` for `/[slug]` route~~ — Done
- [ ] Add `not-found.tsx` for custom 404 page on `/jobs/[id]`
- [ ] Add `aria-label` to all icon-only buttons
- [ ] Add `rel="noopener noreferrer"` to external links
- [ ] Set `Cache-Control` headers on media file serving route

---

## 🎯 Recommended Priority Order

1. **Delete legacy `jobs.ts`** (5 min)
2. **Error boundaries** (2 hours)
3. **Test suite for engine.ts + validation.ts + sanitize.ts** (1 day)
4. **PostgreSQL migration** (1 day)
5. **Cloud file storage** (1 day)
6. **External metrics storage (Redis)** (1-2 days)
7. **Themed job pages** (2 days)
8. **SEO & structured data** (1 day)
9. **ATS integration** (2-4 weeks)
