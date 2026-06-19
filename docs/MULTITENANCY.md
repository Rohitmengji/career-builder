# Multi-Tenancy

How the platform serves many clients (tenants) from one deployment with strict
per-client isolation, and how to operate it.

> Status: the web app ships **single-tenant by default** (env-pinned). Per-request
> multi-tenancy is implemented behind the `multi_tenant_web` feature flag and is
> opt-in per environment. Admin has always been per-request multi-tenant
> (`session.tenantId`).

---

## Concepts

A **tenant** is one client (a `Tenant` row). Every tenant-scoped table carries a
`tenantId`. The job of the platform is to make sure a request for tenant A can
only ever read/write tenant A's data, theme, uploads, and email.

### How a request finds its tenant

Resolution order (`@career-builder/shared/tenant-resolver` → `resolveFromHost`):

1. **Custom domain** — exact match on `Tenant.domain` (e.g. `careers.acme.com`)
2. **Platform subdomain** — `acme.<PLATFORM_ROOT_DOMAIN>` → tenant `acme`
3. **Path** `/[slug]` — fallback for path-based access
4. **Env pin** — `TENANT_ID` (single-tenant deploys / fallback)

Host parsing is pure and edge-safe (`@career-builder/shared/tenant-host`,
`parseHostTenant`) so the web **middleware** can derive a candidate without a DB
call, then forward it to the Node layer via the `x-tenant-host` / `x-tenant-id`
headers. The Node layer (`apps/web/lib/tenant-runtime.ts`) resolves the actual
tenant (cached per request) and everything downstream reads `getWebTenantId()`.

---

## Enabling multi-tenant web

1. **Set the platform root domain** so subdomains vs custom domains can be told
   apart:
   ```
   PLATFORM_ROOT_DOMAIN=hirebase.dev
   ```
2. **Turn on the flag** (per environment):
   ```
   FEATURE_FLAG_MULTI_TENANT_WEB=true
   ```
   With it off, the web app returns the `TENANT_ID` env pin everywhere — exactly
   today's single-tenant behavior.
3. **Onboard a tenant** — create the `Tenant` row (id = the subdomain slug) and,
   for a custom domain, set `Tenant.domain` to the exact host. No redeploy.

### Dark-launch first

Before flipping the flag, the middleware already runs in **observe-only** mode:
it logs when the host-derived tenant disagrees with `TENANT_ID`
(`[tenant][dark-launch] …`). Watch those logs against real traffic to confirm
host→tenant mapping before enforcing.

---

## Isolation guarantees (flag on)

| Surface | Guarantee | Where |
|---|---|---|
| Reads (jobs) | host decides the tenant, never the client query param | `api/jobs`, `api/jobs/[id]` |
| Apply (write) | a client `tenantId` ≠ host → **403**; persisted under the resolved tenant | `api/jobs/apply` |
| Apply (write) | the job must belong to the tenant (`assertOwned`) | `dbProvider.apply` |
| Sessions | a cookie minted on tenant A's host is rejected on tenant B | `sessionTenantMatchesHost` |
| Uploads | cloud keys namespaced `t/<tenantId>/…` (no cross-tenant guess/list) | `storage.objectKeyFor` |
| Email | per-tenant from-address (only if **verified**) + admin inbox | `email.resolveSender` |
| Rate limits | scoped per tenant (`apply:<tenantId>:<ip>`) | apply route |
| Repos | `candidateRepo.findById(id, tenantId)` requires the tenant | repositories |
| Defense-in-depth | `tenantWhere` / `assertTenantOwned` helpers | `@career-builder/database/tenant-guard` |

### Backstop & the deliberate-leak test

`packages/database/tenant-guard.test.ts` includes a test that a row owned by
another tenant is **denied** — a regression there fails CI (R3).

---

## Per-tenant configuration

Stored on the `Tenant` row (JSON columns; no migration to add keys):

- **`settings.featureFlags`** — per-tenant flag overrides (highest priority in
  `isEnabled(flag, overrides)`). Platform-global flags like `multi_tenant_web`
  are resolved without overrides.
- **`settings.email`** — `{ fromEmail, fromName, adminEmail, senderVerified }`.
  The tenant from-address is used **only** when `senderVerified` is true (R8);
  otherwise the platform default sender is used.
- **`branding` / `theme`** — site appearance (already consumed by the renderer).

---

## Feature flags

Engine: `@career-builder/shared/feature-flags` (admin re-exports it).

```ts
import { isEnabled } from "@career-builder/shared/feature-flags";

isEnabled("multi_tenant_web");                  // platform-global
isEnabled("ai_content_generation", overrides);  // per-tenant override wins
```

Resolution: per-tenant override → `FEATURE_FLAG_<NAME>` env → deploy-env
override → default.

---

## Operational checklist

- [ ] `PLATFORM_ROOT_DOMAIN` set
- [ ] Wildcard DNS / TLS for `*.<root>` (and custom domains pointed at the app)
- [ ] `FEATURE_FLAG_MULTI_TENANT_WEB=true`
- [ ] Upstash Redis configured (`UPSTASH_REDIS_REST_URL`) — see below
- [ ] Durable object storage (`STORAGE_DRIVER=blob|s3`) so uploads persist
- [ ] Each tenant's email sender verified before setting `senderVerified: true`

### Shared state on serverless

Rate limits, the job queue, metrics, and idempotency keys must be **shared**
across instances. `getKV()` auto-selects Upstash Redis when
`UPSTASH_REDIS_REST_URL` is set and warns when it falls back to per-instance
memory on a serverless deployment.

---

## Known follow-ups

- **Global Prisma `$extends` enforcement** — a query interceptor that injects
  `tenantId` everywhere is deferred: `update`/`delete`/`upsert` use unique-where
  types that can't take an injected field, and a global hook would break
  legitimate admin cross-tenant reads. Isolation is currently explicit
  (per-call scoping + `assertOwned` + `tenant-guard`); the raw `prisma` client
  is the escape hatch. See `packages/database/tenant-guard.ts`.
- **Web ↔ admin coupling** — the web app still fetches tenant config/pages from
  the admin API over HTTP; it can read directly via `@career-builder/database`
  (already a dependency) to drop the cross-app fetch.
- **Per-tenant billing** — `Subscription` is currently per-user; a per-tenant
  (company) model with pooled plan limits is the target.
