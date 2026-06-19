# Career Builder — Copilot Instructions

> Save this file at **`.github/copilot-instructions.md`** in the repo root.
> GitHub Copilot automatically loads it as context in every Chat / Edits / Agent session.
> Adjust any paths/names below to match the actual repo before committing.

## What this project is

A multi-tenant **career-site builder + ATS** platform. Turborepo monorepo:

- `apps/admin` (port **3001**): GrapesJS visual page editor, 4-layer AI site generation, Stripe billing, ATS dashboards (jobs, applications pipeline, ratings, notes).
- `apps/web` (port **3000**): public career site, job search, candidate accounts (register/login/profile/forgot-password/resume upload), themed rendering per tenant.
- `packages/*`: 7 shared packages (database, ui, ai, config, theme, security, observability — adjust to real names).

## Stack

- **Next.js 16** (App Router), React, **TypeScript (strict)**.
- **Prisma 6** ORM. **SQLite** in dev, **Turso / libsql** in prod. Schema at `packages/db/prisma/schema.prisma` (~10 models).
- **Stripe** billing (free/pro/enterprise + credit system + webhooks + customer portal).
- **SSE** for signed-token live preview.
- **Tailwind + CSS variables** for the per-tenant design-token theme system (colors, fonts, spacing, radius, shadows, light/dark).

## Non-negotiables (read these before writing anything)

- **Tenant isolation is sacred.** Every query that touches tenant-owned data MUST be scoped by `tenantId`. Never write a query that can read or mutate another tenant's rows. Resolve the tenant from the **session** (admin) or the **hostname** (web) — never trust a client-supplied tenant id.
- **TypeScript strict.** No `any` unless truly unavoidable. Validate all external input with **zod** at the boundary.
- **Server-first.** Prefer Server Components, server actions, and route handlers. Keep secrets and DB access server-side only.
- **Keep existing protections intact** on every new route: rate limiting, CSRF, XSS sanitization, bot detection, IP blocklist, CSP headers, file validation.
- **Don't break** the GrapesJS editor, Stripe billing, candidate auth, live preview, or version history.

## Conventions (mirror neighboring code — read it first)

- Prisma models: PascalCase singular. **After any schema change** run `npx prisma migrate dev --name <change>` then `npx prisma generate`.
- API: route handlers live in `app/api/.../route.ts`. Public (web) API responses must set tenant-safe CORS.
- Use the **shared logger / metrics / error helpers** — never `console.log` in app code.
- UI: reuse components from `packages/ui` before creating new ones. Always use the **CSS-variable design tokens**; never hardcode colors/fonts.
- Emails: reuse the existing mailer and put new templates alongside current ones.
- Background work: match whatever pattern already exists (cron route, queue, worker). Don't introduce a new infra dependency without flagging it.

## Commands

- Dev: `pnpm dev` (or `turbo dev`)
- Build: `pnpm build` · Lint: `pnpm lint` · Typecheck: `pnpm typecheck`
- Tests: `pnpm test` (match the framework already in the repo)
- Prisma: `npx prisma migrate dev` · `npx prisma studio`

## How to implement a feature (default workflow)

1. **Read the closest existing feature first** and mirror its structure, naming, and patterns.
2. Order of work: **schema → migration → server logic → API → UI → tests**.
3. Keep the change **scoped**. Do not refactor unrelated code in the same pass.
4. Re-verify **tenant isolation** and **input validation** on every new path before finishing.
5. Leave a short note of any assumption you made or any follow-up the human should do (e.g. env vars, third-party setup).
