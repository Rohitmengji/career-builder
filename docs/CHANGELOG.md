# Changelog

## Global Job Board + Candidate Application Tracking (2026-06-19)

### 156 global job listings
Seeded a full job board for an AI developer tools company:
- **50 US-based roles**: Engineering (ML, Backend, Frontend, DevOps, SRE, Security, etc.), Product, Design, Sales, Marketing, Customer Success, Operations, HR.
- **50 additional tech roles**: GPU Systems, Inference Engine, Distributed Systems, RL, Compilers, Cryptography, AI Safety, Computer Vision, Speech/Audio, and more.
- **49 international roles**: London, Berlin, Amsterdam, Paris, Dublin, Zurich, Stockholm, Barcelona, Warsaw, Lisbon, Tel Aviv, Dubai, Singapore, Tokyo, Bangalore, Hyderabad, Seoul, Sydney, Melbourne, Beijing, Toronto, Vancouver, São Paulo, Mexico City, Buenos Aires, Remote-Global/EMEA/LATAM/Africa.
- **Local currencies**: GBP, EUR, INR, JPY, AUD, SGD, CAD, AED, KRW, CNY, BRL, MXN, ARS, ILS — proper salary ranges per market.

### Candidate "My Applications" page
- **New page**: `/applications` — candidates see all jobs they applied to with live status badges (Applied, Under Review, Interview, Offer, Hired, Not Selected).
- **New API**: `GET /api/applications` — returns applications scoped by email + tenant (no internal notes/ratings exposed).
- **New repo method**: `applicationRepo.findByCandidateEmail()`.
- **SiteHeader**: added "My applications" nav link for logged-in candidates.
- **PR #22** — merged via squash.

### Renderer resilience
- **Block type aliases**: `stats`→`stats-counter`, `cta`→`cta-button`, `video-text`→`video-and-text`, `button`→`basic-button`, `image`→`basic-image`.
- **Prop normalization**: Features accepts `features`/`items` array field, normalizes `description`→`desc`; StatsCounter accepts `stats`/`items`.
- Makes renderer robust to AI-generated content naming variations.
- **PR merged** — `fix(renderer): add block type aliases`.

### Editor UX improvements
- **Small screen blocker**: screens <1024px show "Larger screen required" message with dashboard link instead of broken editor layout.
- **Publish button**: replaced raw `<button>` with shared `<Button>` component for consistent styling and loading state.
- **Loading spinner**: larger (h-8 w-8) for visibility during initial auth check.
- **Tailwind v4 fixes**: `break-words`→`wrap-break-word`, `min-h-[44px]`→`min-h-11`.
- **CSS type declarations**: added `global.d.ts` for both apps.
- **PR #25, #26** — merged.

### Quality & security improvements
- **Homepage nav**: "Sign in" + "Create account" links added; mobile-responsive collapse (hidden sm:flex + mobile CTA).
- **Jobs SEO**: `generateMetadata()` in jobs layout with company name.
- **Rate limiting**: added to `PATCH /api/profile` and `POST /api/media`.
- **Error logging**: profile PATCH catch block now logs actual error.
- **Stripe webhook**: migrated all 15 console.log/warn/error calls to structured logger (`@career-builder/observability`).
- **Tenant API**: public GET access for theme/branding (web app SSR).
- **Bot detection**: disabled on pages GET handler for public access.
- **Font preload**: `Geist_Mono` set to `preload: false` in both apps.

---

## Candidate Accounts + Web Overlay Fix (2026-06-18)

### Candidate auth (public career site)
Full job-seeker account system on `apps/web`, separate from staff RBAC users:
- **New `Candidate` model** (tenant-scoped) + `candidateRepo`; Turso DDL
  regenerated and parity-verified.
- **Sessions** via iron-session (`apps/web/lib/session.ts`) — AES-256-GCM
  encrypted cookie; passwords hashed with scrypt (`@career-builder/security`).
- **Pages:** `/login`, `/register`, `/forgot-password`, `/reset-password`,
  `/profile` (view + edit/update).
- **API:** `POST /api/auth/{register,login,logout,forgot-password,reset-password}`,
  `GET /api/auth/session`, `GET|PATCH /api/profile`.
- **Security:** rate-limited; enumeration-resistant login/forgot; one-time,
  hashed, 1-hour reset tokens (raw token only emailed); responses never expose
  `passwordHash`; LinkedIn URL validated (https + host allowlist).
- **Email:** new `emailService.sendPasswordReset` with an escaped reset link.
- Requires `SESSION_SECRET` (32+ chars) in production on the web app.

### Fix: stuck full-page dark overlay (public site)
The nav drawer's fixed backdrop/panel rendered as `main > div` siblings of page
blocks, so two reveal mechanisms forced their opacity to 1 — a 50% black scrim
over the whole site. Fixed: `useScrollReveal` skips fixed/absolute overlays; the
`main > div` entry animation excludes `.fixed`/`[role=dialog]`/`[aria-hidden]`;
the drawer drives opacity/transform via inline styles.

## Security & Reliability Hardening (2026-06-18)

A platform-wide hardening pass driven by a full-codebase audit. Closes the
confirmed critical/high findings, adds production-durability abstractions, and
makes the CI gate (type-check + lint + build) genuinely green.

> **Verification:** `npm run type-check` ✅ · `npm run lint` (`--max-warnings 0`) ✅ · `npm run build` ✅ — both apps.

### Critical / High

- **Turso schema drift eliminated.** The hand-maintained DDL diverged from
  `schema.prisma` (missing `Application.resumePath`/`externalId`, `Job.external*`,
  `appliedAt`→`submittedAt`, wrong FKs/indexes) — a prior outage source. The DDL
  is now a **generated artifact**: `packages/database/prisma/turso-schema.sql`
  is produced from the schema (`npm run db:gen-turso-sql`), consumed by
  `push-turso.ts`, and **parity-enforced in CI** (`npm run db:verify-turso`).
  Also fixed the CI migration-safety guard (`fetch-depth: 0`) and added an
  offline libSQL adapter smoke test.
- **Broken candidate flows repaired.** The tenant apply form (`/[slug]/jobs/[jobId]/apply`)
  was a no-op; it now POSTs to `/api/jobs/apply`. The tenant job-detail page read
  hardcoded mock data; it now reads the DB provider (tenant-scoped). Fixed the
  block renderer's job link (`/careers/jobs/…` → `/jobs/[id]`).
- **Durable object storage.** Resume + media uploads no longer write only to the
  ephemeral local filesystem. New `@career-builder/shared/storage` driver: local
  (dev) → Vercel Blob / S3-compatible (prod) via `STORAGE_DRIVER`.
- **Cross-tenant isolation.** Closed the job publish/unpublish IDOR, scoped
  `/api/tenants` to the session tenant (super_admin retains cross-tenant access),
  added repo-level tenant guards on job mutations, and stopped the theme editor
  trusting a client-supplied `?tenant=`.
- **CSRF.** Fixed an inverted check on `/api/ai/memory`; hardened the security
  package's `validateCsrf` into a real constant-time double-submit + Sec-Fetch-Site
  check; added a Sec-Fetch-Site/Referer fallback to both app middlewares so
  missing-`Origin` mutations aren't waved through; added CSRF to `/api/admin/metrics`.
- **Trusted client IP.** Rate-limit / lockout / bot-detection keys now use
  platform headers (Cloudflare/Vercel) then the trusted **rightmost**
  `X-Forwarded-For` hop instead of the spoofable leftmost entry
  (`TRUSTED_PROXY_COUNT`, default 1).
- **AI engine.** Dropped the invalid `temperature` on the Responses-API path so
  gpt-5/o-series models no longer silently fall back; renamed the phantom
  `job-list` blueprint to the real `search-results` block type.

### Reliability (P1)

- **Atomic optimistic locking** for page saves (`pageRepo.upsert` now uses a
  compare-and-set `updateMany` with `version: { increment: 1 }` — no lost updates).
- **Durable KV abstraction** (`@career-builder/shared/kv`): in-memory (dev) →
  Upstash Redis (prod) via `KV_DRIVER`. Wired into Stripe webhook idempotency
  (atomic, cross-instance) — previously a per-process map that allowed duplicate
  event processing on serverless.

### Hardening (P2)

- Sanitizer strips HTML comments/CDATA/declarations and handles single/unquoted
  `href`. WEBP uploads verified via the `WEBP` fourCC (not just the RIFF prefix).
  SVGs forced to download + sandbox CSP, with a stronger script/XXE scan.
  `scrypt` verify clamps cost params + caps `maxmem` (anti-DoS). New-credential
  min length raised to 8. Tenant save schema strips unknown keys.
- Editor: inline rich-text edits to list items now write to `props.items[i][key]`
  (were lost as flat junk keys); wired Cmd/Ctrl+Z / Shift+Cmd+Z undo/redo.
- `withRequestLogging` mutates response headers in place instead of re-wrapping
  the body, so SSE/streaming responses are no longer broken.

### Hygiene (P3 / follow-ups)

- Stripe client is lazily constructed (a missing key no longer crashes module
  load / `next build`); Stripe env is soft at load, guarded at use.
- Next image optimizer locked to an `IMAGE_REMOTE_HOSTS` allowlist (prod);
  removed an unused `resend` dependency; deleted a stale `renderer.tsx.bak`.
- **Lint gate made real:** the repo previously failed `eslint --max-warnings 0`
  (~360 violations). Set an enforceable policy (`no-explicit-any` off for
  pervasive dynamic data; ignore `_`-prefixed unused), removed dead code, fixed
  real react-hooks/next issues — including a genuine **Rules-of-Hooks bug**
  (`useId()` after an early return in the renderer's `Personalization` block).

### New environment variables

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the full table. Summary:

| Var | Purpose |
|---|---|
| `STORAGE_DRIVER`, `BLOB_READ_WRITE_TOKEN`, `S3_*` | Durable uploads (resumes/media) |
| `KV_DRIVER`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Durable rate-limit/idempotency state |
| `TRUSTED_PROXY_COUNT` | Trusted reverse-proxy hops for client-IP resolution |
| `IMAGE_REMOTE_HOSTS` | Allowlist for the Next image optimizer |

### Known follow-ups (not in this pass)

- Adopt the KV store in the remaining in-memory consumers (rate limiters, login
  lockout, AI/tenant caches).
- Cloud media-library listing (the GET listing is still local-driver only).
- A `unknown`-based typing pass to re-enable `no-explicit-any`.
- Automated test suite (Vitest unit + Playwright e2e) to pin these fixes.
- De-duplicate the two `callAi()` implementations.
- Remaining medium findings: `AUTH_SECRET` prod-fatal, `/api/site-context`
  validation, autosave `expectedVersion`, prod-seed default passwords.
