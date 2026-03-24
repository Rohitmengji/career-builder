# Career Builder — Project Documentation

> Visual career site builder with drag-and-drop editing, AI-powered content generation, Stripe subscription billing, multi-tenant theming, database-backed storage, enterprise security, and production-grade observability.

---

## 📚 Documentation Index

| Document | Description | Audience |
|----------|-------------|----------|
| [README.md](./README.md) | This file — project overview, setup, and quick start | Everyone |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System architecture, data flow, and design decisions | Engineers |
| [CODEBASE_GUIDE.md](./CODEBASE_GUIDE.md) | File-by-file walkthrough — what every module does and why | New developers |
| [ROADMAP.md](./ROADMAP.md) | Future features, known gaps, and improvement opportunities | Product & Engineering |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Production deployment guide, health checks, feature flags | DevOps & Engineering |
| [PLATFORM_AUDIT.md](./PLATFORM_AUDIT.md) | Full production audit report — security, billing, resilience | Engineering Leadership |

---

## 🏗️ What Is This?

Career Builder is a **monorepo-based career site platform** that lets non-technical hiring teams build beautiful job listing pages using a visual drag-and-drop editor, while engineers maintain a clean, extensible codebase.

### Core Capabilities

- **Visual Editor** — GrapesJS-powered drag-and-drop page builder with 30+ block types
- **AI Content Generation** — GPT-5.4-mini powered content creation, improvement, expansion, full page generation, and job posting generation with subscription gating
- **Stripe Billing** — Production subscription system with checkout, webhooks, customer portal, credit-based AI usage, and geo-based pricing
- **Live Preview** — Real-time SSE sync between editor and public site
- **Multi-Tenant Theming** — Each company gets its own colors, fonts, and branding
- **Job Data System** — Search, filter, facets, pagination, job details, and apply workflow
- **Database Layer** — Prisma ORM + SQLite with 8 models, 9 repositories, and full seed data
- **Authentication** — iron-session (AES-256-GCM) + bcrypt password hashing, DB-backed multi-user RBAC with admin/hiring_manager/recruiter/viewer roles
- **Security** — Input sanitization, Zod validation, CSP headers, rate limiting, CSRF protection, Stripe live key guard, feature flags
- **Observability** — Structured logging, Prometheus-style metrics, alerting (Slack/Email/DB), bot detection, anomaly detection, distributed tracing, performance budgets, readiness probe, admin dashboard
- **Design System** — Production-grade spacing, typography, a11y components, scroll reveal animations
- **File Upload** — Resume upload (PDF/DOC/DOCX) with validation

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 10

### Setup

```bash
# Clone and install
git clone <repo-url> career-builder
cd career-builder
npm install

# Initialize the database
cd packages/database
npx prisma generate
npx prisma db push
npx tsx seed.ts
cd ../..

# Start both apps in development
npm run dev
```

### URLs

| App | URL | Purpose |
|-----|-----|---------|
| **Web** (public site) | http://localhost:3000 | Career site that visitors see |
| **Admin** (editor) | http://localhost:3001 | Visual editor + admin dashboard |
| **Job Search** | http://localhost:3000/jobs | Job listing with search & filters |
| **Job Detail** | http://localhost:3000/jobs/eng-001 | Individual job page with apply |
| **Observability** | http://localhost:3001/observability | Metrics, alerts, blocked IPs dashboard |
| **Prisma Studio** | `cd packages/database && npx prisma studio` | Visual database browser |

### Default Credentials

```
Email:    admin@company.com
Password: admin123
```

---

## 📁 Project Structure (High Level)

```
career-builder/
├── apps/
│   ├── admin/          → Admin dashboard + GrapesJS visual editor (port 3001)
│   │   ├── middleware.ts   → Edge rate limiting, CSRF, security headers
│   │   ├── lib/            → Auth, stores, block schemas, observability init
│   │   │   ├── ai/         → AI types, prompts, validator, useSubscription, useGeoPricing
│   │   │   ├── stripe/     → Stripe server-side config (keys, price maps, client)
│   │   │   ├── jobs/       → Background job queue + handlers (cleanup, webhook retry, audit flush)
│   │   │   ├── feature-flags.ts → Lightweight feature flag system (7 flags, env override)
│   │   │   └── env.ts      → Environment validation (production-required vars)
│   │   ├── components/     → Sidebar, AiAssistant, UpgradeModal, BillingPortalButton, DevPlanSwitcher
│   │   └── app/            → Pages: editor, jobs, applications, observability, etc.
│   │       └── api/        → Auth, pages, AI, Stripe, subscription, media, health, ready
│   └── web/            → Public career site + job pages (port 3000)
│       ├── middleware.ts   → Edge rate limiting, CSRF, security headers
│       ├── lib/            → Renderer, ThemeProvider, job system, design system, scroll reveal
│       └── app/            → Pages: landing, [slug], jobs, job detail, apply
├── packages/
│   ├── database/       → Prisma ORM, 9 repositories, types, seed (SQLite)
│   ├── security/       → Sanitize, validate (Zod), rate-limit, CSP, crypto (9 modules)
│   ├── observability/  → Logger, metrics, alerts, tracing, bot detection (16 modules)
│   └── tenant-config/  → Shared theme types, validation, design tokens
├── docs/               → You are here
├── turbo.json          → Turborepo build orchestration
└── package.json        → Workspace root
```

---

## 🛠️ Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 16.1.7 |
| UI | React | 19.2.3 |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | v4 |
| Visual Editor | GrapesJS | 0.22.14 |
| AI Provider | OpenAI (GPT-5.4-mini) | Responses API |
| Billing | Stripe | 20.4.1 |
| ORM | Prisma | 6.19.2 |
| Database | SQLite (dev) / PostgreSQL (prod) | — |
| Validation | Zod | 4.3.6 |
| Build System | Turborepo | 2.8.17 |

---

## 📦 Available Scripts

```bash
# From the root directory:
npm run dev           # Start both apps in dev mode
npm run build         # Production build (both apps)
npm run lint          # Run ESLint across all apps

# Database commands (from packages/database/):
npx prisma generate   # Generate Prisma client
npx prisma db push    # Push schema to SQLite
npx tsx seed.ts       # Seed with sample data
npx prisma studio     # Visual database browser
npx prisma migrate dev # Create migration (for production)

# Stripe CLI (local webhook testing):
stripe listen --forward-to localhost:3001/api/stripe/webhook

# From individual app directories:
cd apps/web && npm run dev     # Just the public site
cd apps/admin && npm run dev   # Just the admin editor
```

---

## 🗄️ Data Storage

All persistent data is stored in a **SQLite database** at `packages/database/prisma/dev.db`:

| Model | Records (seeded) | Purpose |
|-------|-----------------|---------|
| Tenant | 1 | Company configs (theme, branding, plan) |
| User | 3 | Admin accounts + billing (plan, stripeCustomerId, aiCredits, subscriptionStatus) |
| Job | 8 | Job postings across departments |
| Application | 5 | Sample job applications |
| Page | 1 | Visual editor page (blocks JSON) |
| AuditLog | — | Login events, page saves, alert persistence |
| AnalyticsEvent | — | Job views, searches, application tracking |
| Webhook | — | Outbound webhook configurations |

### Billing Fields on User Model

```
plan                  String    @default("free")        // free | pro | enterprise
stripeCustomerId      String?   @unique                 // cus_...
stripeSubscriptionId  String?   @unique                 // sub_...
stripePriceId         String?                           // price_...
subscriptionStatus    String    @default("none")        // none | active | past_due | canceled | trialing
aiCredits             Int       @default(0)             // remaining AI credits this cycle
aiCreditsResetAt      DateTime?                         // when credits reset (next billing cycle)
billingCycleStart     DateTime?                         // current billing cycle start
```

**Additionally**, file-based storage exists for media:

```
data/
├── media/              → Uploaded images
└── resumes/            → Uploaded resume files (PDF, DOC, etc.)
```

---

## 🔑 Environment Variables

| Variable | Where | Default | Description |
|----------|-------|---------|-------------|
| `DATABASE_URL` | All `.env` files | `file:/abs/path/dev.db` | **Must be absolute path** to SQLite DB |
| `SESSION_SECRET` | `apps/admin/.env` | — | **REQUIRED in production.** Iron-session encryption secret. Generate with `openssl rand -base64 32` |
| `AUTH_SECRET` | `apps/admin/.env` | `career-builder-secret-key` | Legacy session signing secret (superseded by SESSION_SECRET) |
| `NEXT_PUBLIC_SITE_URL` | `apps/web/.env` | `http://localhost:3000` | Base URL for server-side API calls |
| `OPENAI_API_KEY` | `apps/admin/.env.local` | — | OpenAI API key for AI features |
| `AI_MODEL` | `apps/admin/.env.local` | `gpt-5.4-mini` | AI model name (supports gpt-5.x Responses API + gpt-4 Chat Completions) |
| `OPENAI_BASE_URL` | `apps/admin/.env.local` | `https://api.openai.com/v1` | Custom AI endpoint (Azure, local proxy) |
| `STRIPE_SECRET_KEY` | `apps/admin/.env.local` | — | Stripe secret key (`sk_test_...` or `sk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | `apps/admin/.env.local` | — | Stripe webhook signing secret (`whsec_...`) |
| `STRIPE_PRO_PRICE_ID` | `apps/admin/.env.local` | — | Stripe Price ID for Pro plan (`price_...`) |
| `STRIPE_ENT_PRICE_ID` | `apps/admin/.env.local` | — | Stripe Price ID for Enterprise plan (`price_...`) |
| `NEXT_PUBLIC_APP_URL` | `apps/admin/.env.local` | `http://localhost:3001` | App URL for Stripe redirect callbacks |
| `SENTRY_DSN` | Optional | — | Sentry error tracking (optional, degrades gracefully) |
| `SLACK_WEBHOOK_URL` | Optional | — | Slack webhook for critical alerts |
| `FEATURE_FLAG_*` | Optional | — | Override feature flags (e.g., `FEATURE_FLAG_AI_CONTENT_GENERATION=false`) |

---

## 🤖 AI Content Generation

### Overview

The AI system generates, improves, and expands content for visual blocks and job postings using GPT-5.4-mini via the OpenAI Responses API.

### Actions

| Action | Description | Input |
|--------|-------------|-------|
| `generate` | Generate content for a single block | Block type + optional prompt |
| `improve` | Improve existing block content | Current props + prompt |
| `expand` | Expand/elaborate existing content | Current props + prompt |
| `generate-page` | Generate a full page (multiple blocks) | Page description prompt |
| `generate-job` | Generate a complete job posting | Partial job data + prompt |

### Architecture

```
AiAssistant.tsx → POST /api/ai → buildPrompt() → OpenAI → parseAiJson() → validateAiOutput()
                                  ↑                                              ↓
                           subscriptionRepo.canUseAi()              subscriptionRepo.decrementCredit()
```

### Key Features
- **Dual API support** — GPT-5.x uses Responses API (`/v1/responses`), GPT-4 uses Chat Completions
- **Schema-validated output** — AI output validated against `blockSchemas` before returning
- **Side-by-side diff preview** — Users see original vs AI-generated content per field
- **Per-field checkboxes** — Users choose which fields to accept
- **Response caching** — Same request → same response for 5 minutes
- **Rate limiting** — Per-IP, per-action (e.g., generate: 15/min, generate-page: 8/min) + per-user daily limit (200/day)
- **Server-side subscription guard** — `canUseAi()` check before processing, `decrementCredit()` after success (with `withDbRetry`)

---

## 💳 Stripe Billing System

### Plans

| Plan | Price (US) | Price (IN) | AI Credits/Month | Features |
|------|-----------|-----------|-------------------|----------|
| **Free** | $0 | ₹0 | 0 | Visual editor, 30+ blocks, publish, mobile responsive |
| **Pro** | $79/mo | ₹1,499/mo | 500 | + AI content generation, AI page builder, priority support |
| **Enterprise** | $249/mo | ₹4,999/mo | 2,500 | + Custom AI models, team collaboration, SSO, dedicated support |

### Checkout Flow

```
User clicks "Upgrade to Pro"
  → UpgradeModal → POST /api/stripe/checkout { plan: "pro" }
  → Create/get Stripe Customer → Create Checkout Session → redirect to Stripe
  → User pays on Stripe-hosted page
  → Stripe fires checkout.session.completed webhook
  → POST /api/stripe/webhook → activateSubscription(plan, credits)
  → User returns to /editor?checkout=success
  → useSubscription() fetches fresh state from /api/subscription
```

### Self-Service Billing Portal

Active subscribers can manage their subscription through Stripe's hosted Customer Portal:
- Upgrade / downgrade plan
- Cancel subscription
- Update payment method
- View / download invoices

Access via `BillingPortalButton` component or "Manage Billing →" link in AI panel.

### Webhook Events

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Activate subscription, link customer, set credits |
| `invoice.paid` | Reset credits on renewal |
| `invoice.payment_failed` | Set status to `past_due` |
| `customer.subscription.updated` | Sync status, handle plan changes |
| `customer.subscription.deleted` | Cancel → reset to free plan |

### Geo-Based Pricing

Pricing auto-adjusts based on user region (US/UK/EU/India) detected via:
1. IP geolocation (3 API cascade: country.is → ipwho.is → ipapi.co)
2. Timezone fallback (`Intl.DateTimeFormat`)
3. Language fallback (`navigator.language`)

### Local Development with Stripe

```bash
# 1. Install Stripe CLI: https://stripe.com/docs/stripe-cli
brew install stripe/stripe-cli/stripe

# 2. Login to Stripe
stripe login

# 3. Forward webhooks to local server
stripe listen --forward-to localhost:3001/api/stripe/webhook

# 4. Copy the webhook secret (whsec_...) to .env.local
```

### Dev Plan Switcher

For testing subscription gating without Stripe:
- `DevPlanSwitcher.tsx` — floating widget on `/editor` page (dev only)
- Calls `POST /api/dev/set-plan { plan: "pro" }` to directly set plan in DB
- Hard-blocked in production (`NODE_ENV === "production"` → returns 404)

---

## 🎨 Design System

### `apps/web/lib/design-system.ts` (~592 lines)

Production-grade token layer:
- **Spacing scale** — 4px base unit, 24 named spacing tokens + semantic spacing
- **Typography scale** — Semantic font sizes (xs–6xl)
- **Breakpoints** — Mobile-first responsive system
- **Z-index scale** — Predictable stacking context
- **Motion tokens** — Animation durations and easings
- **Color contrast utilities** — WCAG 2.1 AA compliance helpers
- **SEO utilities** — JSON-LD helpers, heading hierarchy
- **Performance utilities** — Image optimization, preload hints
- **Accessibility constants** — ARIA roles, screen reader text

### `apps/web/lib/design-system-components.tsx` (~553 lines)

Accessible React primitives:
- `SkipLink` — keyboard skip-to-content navigation
- `VisuallyHidden` — screen reader only text
- `FocusTrap` — trap focus within modals/drawers
- `ResponsiveDrawer` — mobile nav drawer with a11y
- `LoadingState` / `ErrorState` — consistent state UI
- `LazyImage` — optimized image with srcset, loading, alt enforcement
- `JsonLd` — safe JSON-LD script injection
- `Heading` — semantic heading with auto-level management
- `IconButton` — accessible icon-only button
- `AnnouncementRegion` — aria-live announcements

### `apps/web/lib/useScrollReveal.ts` (~104 lines)

IntersectionObserver-based scroll reveal animation hook. Respects `prefers-reduced-motion`. Adds `cb-reveal` / `cb-visible` classes for CSS-driven animations.

---

## 📡 API Routes (Quick Reference)

### Admin App (port 3001)

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/auth` | Login / logout / session check |
| GET/POST | `/api/pages` | List / save page blocks |
| GET/POST | `/api/preview` | SSE stream / push live update |
| GET/POST/DELETE | `/api/tenants` | Tenant CRUD |
| GET/POST/PUT/DELETE | `/api/users` | User management (admin only) |
| POST | `/api/media` | Image upload |
| GET | `/api/media/file/[filename]` | Serve uploaded media |
| GET | `/api/audit` | Audit log (admin only) |
| GET/POST | `/api/admin/metrics` | Observability dashboard data |
| GET/POST/PUT/DELETE | `/api/admin/jobs` | Job CRUD |
| GET/PUT | `/api/admin/applications` | Application management |
| GET | `/api/admin/analytics` | Analytics data |
| POST | `/api/ai` | AI content generation (auth + subscription + rate-limited) |
| POST | `/api/stripe/checkout` | Create Stripe Checkout Session |
| POST | `/api/stripe/portal` | Create Stripe Billing Portal session |
| POST | `/api/stripe/webhook` | Stripe webhook handler (signature-verified) |
| GET | `/api/subscription` | Server-side subscription status |
| GET | `/api/geo` | Server-side IP geolocation |
| POST | `/api/dev/set-plan` | Dev-only plan switcher |
| GET | `/api/health` | Liveness check |
| GET | `/api/ready` | Readiness probe (DB health + env validation) |

### Web App (port 3000)

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/jobs` | Job search with filters, facets, pagination |
| GET | `/api/jobs/[id]` | Job detail + related jobs |
| POST | `/api/jobs/apply` | Submit application (multipart or JSON) |
| GET | `/api/health` | Health check |

---

## 🧱 Visual Editor Blocks (30+)

| Block | Type Key | Category |
|-------|----------|----------|
| Hero Section | `hero` | Layout |
| Job Listing | `jobList` | Jobs |
| Content Section | `content` | Content |
| Features Grid | `features` | Content |
| Testimonial | `testimonial` | Social Proof |
| Carousel | `carousel` | Media |
| Accordion / FAQ | `accordion` | Content |
| CTA Button | `ctaButton` | Action |
| Search Bar | `searchBar` | Navigation |
| Job Details | `jobDetails` | Jobs |
| Job Category | `jobCategory` | Jobs |
| Join Talent Network | `joinTalentNetwork` | Jobs |
| Video & Text | `videoAndText` | Media |
| Personalization | `personalization` | Content |
| Show/Hide Tab | `showHideTab` | Interactive |
| Image Text Grid | `imageTextGrid` | Layout |
| Lightbox | `lightbox` | Media |
| Job Alert | `jobAlert` | Jobs |
| Navigate Back | `navigateBack` | Navigation |
| Basic Button | `basicButton` | Action |
| Basic Image | `basicImage` | Media |
| Spacer | `spacer` | Layout |
| Divider | `divider` | Layout |
| Navbar | `navbar` | Navigation |
| Footer | `footer` | Navigation |
| Notification Banner | `notificationBanner` | Content |
| Stats Counter | `statsCounter` | Content |
| Team Grid | `teamGrid` | Content |
| Social Proof | `socialProof` | Social Proof |
| Application Status | `applicationStatus` | Jobs |

---

## 📊 Codebase Stats

- **4 shared packages** (database, security, observability, tenant-config)
- **2 apps** (admin + web)
- **8 Prisma models** with 9 repository modules (including subscriptionRepo with `withDbRetry`)
- **9 security modules** (sanitize, validate, rate-limit, headers, middleware, file-upload, url, tenant, crypto)
- **16 observability modules** (logger, correlation, metrics, alerts, bot-detection, anomaly, request-logger, performance, api-protection, rate-limiter, rate-limiter-edge, persistence, tracing, edge, sentry, index)
- **30+ block types** in the visual editor
- **24 mock jobs** across 7 departments
- **5 AI actions** (generate, improve, expand, generate-page, generate-job)
- **5 Stripe webhook events** handled with 10-min idempotency
- **22+ API routes** across admin + web apps (including `/api/ready` readiness probe)
- **~592 lines** design system tokens + **~553 lines** design system components
- **3 subscription plans** (Free, Pro, Enterprise) with credit-based AI usage
- **4 supported pricing regions** (US, UK, EU, India) with geo-detection
- **7 feature flags** (env-var overridable, deploy-environment scoped)
- **3 background job handlers** (audit-log-flush, webhook-retry, periodic-cleanup)
