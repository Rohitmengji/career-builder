/*
 * Admin Talent Pools API (ADR-0018, B3). Manage the per-tenant talent-pool library.
 *
 * GET    — list the tenant's pools + member counts (recruiter+)
 * POST   — create a pool (recruiter+)
 * PATCH  — rename / re-describe a pool (recruiter+)
 * DELETE — delete a pool (recruiter+; cascade removes its members)
 *
 * Flag-gated (talent_pool). Tenant-scoped throughout. Member management + the
 * consent-gated re-engage live under ./[id]/members and ./[id]/reengage.
 */

import { NextResponse } from "next/server";
import { getSession, getSessionReadOnly, validateCsrf, writeAuditLog } from "@/lib/auth";
import { talentPoolRepo } from "@career-builder/database";
import { isEnabled } from "@career-builder/shared/feature-flags";
import { safeParse, createTalentPoolSchema, updateTalentPoolSchema, deleteTalentPoolSchema } from "@career-builder/security/validate";

const NO_STORE = { "Cache-Control": "no-store" } as const;
const WRITE_ROLES = ["super_admin", "admin", "hiring_manager", "recruiter"];
const flagOff = () => !isEnabled("talent_pool");

/* ------------------------------------------------------------------ GET */
export async function GET() {
  if (flagOff()) return NextResponse.json({ pools: [], enabled: false }, { headers: NO_STORE });
  const session = await getSessionReadOnly();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  if (session.role === "viewer") return NextResponse.json({ error: "Insufficient permissions" }, { status: 403, headers: NO_STORE });

  const pools = await talentPoolRepo.listForTenant(session.tenantId);
  return NextResponse.json(
    { enabled: true, pools: pools.map((p) => ({ id: p.id, name: p.name, description: p.description, count: p._count.members })) },
    { headers: NO_STORE },
  );
}

/* ----------------------------------------------------------------- POST */
export async function POST(req: Request) {
  if (flagOff()) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  if (!WRITE_ROLES.includes(session.role)) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403, headers: NO_STORE });
  if (!(await validateCsrf(req))) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403, headers: NO_STORE });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400, headers: NO_STORE }); }
  const parsed = safeParse(createTalentPoolSchema, body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });

  let pool;
  try {
    pool = await talentPoolRepo.create({ tenantId: session.tenantId, name: parsed.data.name, description: parsed.data.description ?? null, createdById: session.userId });
  } catch (err) {
    if (err && typeof err === "object" && (err as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "A pool with that name already exists." }, { status: 409, headers: NO_STORE });
    }
    throw err;
  }
  await writeAuditLog(session.userId, session.email, "talent_pool_create", parsed.data.name);
  return NextResponse.json({ pool: { id: pool.id, name: pool.name, description: pool.description, count: 0 } }, { status: 201, headers: NO_STORE });
}

/* --------------------------------------------------------------- PATCH */
export async function PATCH(req: Request) {
  if (flagOff()) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  if (!WRITE_ROLES.includes(session.role)) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403, headers: NO_STORE });
  if (!(await validateCsrf(req))) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403, headers: NO_STORE });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400, headers: NO_STORE }); }
  const parsed = safeParse(updateTalentPoolSchema, body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });

  const data: { name?: string; description?: string | null } = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.description !== undefined) data.description = parsed.data.description;

  let changed: number;
  try {
    changed = await talentPoolRepo.update(parsed.data.id, session.tenantId, data);
  } catch (err) {
    if (err && typeof err === "object" && (err as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "A pool with that name already exists." }, { status: 409, headers: NO_STORE });
    }
    throw err;
  }
  if (changed === 0) return NextResponse.json({ error: "Pool not found." }, { status: 404, headers: NO_STORE });
  await writeAuditLog(session.userId, session.email, "talent_pool_update", `pool ${parsed.data.id.slice(-6)}`);
  return NextResponse.json({ success: true }, { headers: NO_STORE });
}

/* -------------------------------------------------------------- DELETE */
export async function DELETE(req: Request) {
  if (flagOff()) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  if (!WRITE_ROLES.includes(session.role)) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403, headers: NO_STORE });
  if (!(await validateCsrf(req))) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403, headers: NO_STORE });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400, headers: NO_STORE }); }
  const parsed = safeParse(deleteTalentPoolSchema, body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });

  const removed = await talentPoolRepo.delete(parsed.data.id, session.tenantId);
  if (removed === 0) return NextResponse.json({ error: "Pool not found." }, { status: 404, headers: NO_STORE });
  await writeAuditLog(session.userId, session.email, "talent_pool_delete", `pool ${parsed.data.id.slice(-6)}`);
  return NextResponse.json({ success: true }, { headers: NO_STORE });
}
