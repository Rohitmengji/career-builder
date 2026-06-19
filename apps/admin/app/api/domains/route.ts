/*
 * Custom Domains API.
 *
 * GET    /api/domains            — list the tenant's domains + DNS target + plan status
 * POST   /api/domains            — add a domain (plan-gated, CSRF)  body: { hostname }
 * PATCH  /api/domains            — verify | set-primary (CSRF)      body: { id, action }
 * DELETE /api/domains?id=<id>    — remove a domain (CSRF)
 *
 * Every query is scoped to session.tenantId. Mutations require a non-viewer,
 * org-admin role + CSRF. Add/verify are gated to paid plans. The DNS verify
 * lookup is rate-limited (it makes an outbound query).
 */

import { NextResponse } from "next/server";
import { getSession, getSessionReadOnly, validateCsrf, writeAuditLog } from "@/lib/auth";
import { domainRepo, tenantRepo } from "@career-builder/database";
import { generateToken } from "@career-builder/security/crypto";
import { getRateLimiter, getClientIp } from "@career-builder/security/rate-limit";
import {
  planAllowsCustomDomain,
  isValidPublicHostname,
  verifyDomainTxt,
  dnsInstructions,
  customDomainCnameTarget,
} from "@/lib/domains";

const NO_STORE = { "Cache-Control": "no-store" } as const;
function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

function canManage(role: string): boolean {
  return role === "admin" || role === "super_admin";
}

/* ------------------------------------------------------------------ GET */
export async function GET() {
  const session = await getSessionReadOnly();
  if (!session) return json({ error: "Unauthorized" }, 401);

  const [domains, tenant] = await Promise.all([
    domainRepo.listByTenant(session.tenantId),
    tenantRepo.findById(session.tenantId),
  ]);

  return json({
    domains,
    cnameTarget: customDomainCnameTarget(),
    planAllowed: planAllowsCustomDomain(tenant?.plan),
    plan: tenant?.plan ?? "free",
  });
}

/* ------------------------------------------------------------------ POST (add) */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return json({ error: "Unauthorized" }, 401);
  if (!canManage(session.role)) return json({ error: "Insufficient permissions" }, 403);
  if (!(await validateCsrf(req))) return json({ error: "Invalid CSRF token" }, 403);

  // Plan gate (server-side — the UI also gates, but never trust the client).
  const tenant = await tenantRepo.findById(session.tenantId);
  if (!planAllowsCustomDomain(tenant?.plan)) {
    return json({ error: "Custom domains are available on the Pro and Enterprise plans." }, 403);
  }

  let body: { hostname?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const hostnameRaw = typeof body.hostname === "string" ? body.hostname : "";
  if (!isValidPublicHostname(hostnameRaw)) {
    return json({ error: "Enter a valid public domain, e.g. careers.yourcompany.com." }, 400);
  }
  const hostname = domainRepo.normalizeHostname(hostnameRaw);

  // Reject a host already claimed by ANY tenant (the column is globally unique).
  const existing = await domainRepo.findByHostname(hostname);
  if (existing) {
    return json({ error: "That domain is already registered." }, 409);
  }

  const verifyToken = generateToken(16); // 32 hex chars, crypto-random
  const domain = await domainRepo.create({ tenantId: session.tenantId, hostname, verifyToken });
  await writeAuditLog(session.userId, session.email, "domain_add", `domain: ${hostname}`);

  return json({ domain, instructions: dnsInstructions(hostname, verifyToken) }, 201);
}

/* ------------------------------------------------------------------ PATCH (verify | set-primary) */
export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) return json({ error: "Unauthorized" }, 401);
  if (!canManage(session.role)) return json({ error: "Insufficient permissions" }, 403);
  if (!(await validateCsrf(req))) return json({ error: "Invalid CSRF token" }, 403);

  let body: { id?: unknown; action?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }
  const id = typeof body.id === "string" ? body.id : "";
  const action = body.action === "verify" || body.action === "set-primary" ? body.action : null;
  if (!id || !action) return json({ error: "Missing id or action." }, 400);

  const tenant = await tenantRepo.findById(session.tenantId);
  if (!planAllowsCustomDomain(tenant?.plan)) {
    return json({ error: "Custom domains are available on the Pro and Enterprise plans." }, 403);
  }

  const domain = await domainRepo.getOwned(id, session.tenantId);
  if (!domain) return json({ error: "Domain not found." }, 404);

  if (action === "set-primary") {
    if (domain.status !== "active") {
      return json({ error: "Verify the domain before making it primary." }, 409);
    }
    await domainRepo.setPrimary(id, session.tenantId);
    await writeAuditLog(session.userId, session.email, "domain_set_primary", `domain: ${domain.hostname}`);
    return json({ success: true });
  }

  // action === "verify" — rate-limit the outbound DNS lookup per tenant.
  const limiter = getRateLimiter("api");
  const ip = getClientIp(req) || "unknown";
  const rl = limiter.check(`domain-verify:${session.tenantId}:${ip}`);
  if (!rl.allowed) {
    return json({ error: "Too many verification attempts. Please wait a moment." }, 429);
  }

  const ok = await verifyDomainTxt(domain.hostname, domain.verifyToken);
  const status = ok ? "active" : "failed";
  await domainRepo.setStatus(id, session.tenantId, status, ok ? new Date() : null);
  await writeAuditLog(
    session.userId,
    session.email,
    "domain_verify",
    `domain: ${domain.hostname} → ${status}`,
  );

  return json({
    success: ok,
    status,
    error: ok ? undefined : "We couldn't find the TXT record yet. DNS can take a few minutes to propagate — try again shortly.",
  });
}

/* ------------------------------------------------------------------ DELETE */
export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session) return json({ error: "Unauthorized" }, 401);
  if (!canManage(session.role)) return json({ error: "Insufficient permissions" }, 403);
  if (!(await validateCsrf(req))) return json({ error: "Invalid CSRF token" }, 403);

  const id = new URL(req.url).searchParams.get("id") || "";
  if (!id) return json({ error: "Missing id." }, 400);

  const count = await domainRepo.delete(id, session.tenantId);
  if (count === 0) return json({ error: "Domain not found." }, 404);
  await writeAuditLog(session.userId, session.email, "domain_delete", `domain id: ${id}`);
  return json({ success: true });
}
