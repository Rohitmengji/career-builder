/*
 * Admin Application Tags API (ADR-0016, B2b). Manage the per-tenant tag library.
 *
 * GET    — list the tenant's tags + usage counts (recruiter+; needed for chips/filter)
 * POST   — create a tag (recruiter+)
 * PATCH  — rename / recolour a tag (recruiter+)
 * DELETE — remove a tag from the library (recruiter+; cascade unlinks it everywhere)
 *
 * Flag-gated (application_tags). Tenant-scoped throughout. Colour is constrained to
 * the closed palette (validate.createTagSchema) so it can never become raw CSS.
 */

import { NextResponse } from "next/server";
import { getSession, getSessionReadOnly, validateCsrf, writeAuditLog } from "@/lib/auth";
import { tagRepo } from "@career-builder/database";
import { isEnabled } from "@career-builder/shared/feature-flags";
import { safeParse, createTagSchema, updateTagSchema, deleteTagSchema } from "@career-builder/security/validate";

const NO_STORE = { "Cache-Control": "no-store" } as const;
const WRITE_ROLES = ["super_admin", "admin", "hiring_manager", "recruiter"];
const flagOff = () => !isEnabled("application_tags");

/* ------------------------------------------------------------------ GET */
export async function GET() {
  if (flagOff()) return NextResponse.json({ tags: [], enabled: false }, { headers: NO_STORE });
  const session = await getSessionReadOnly();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  if (session.role === "viewer") return NextResponse.json({ error: "Insufficient permissions" }, { status: 403, headers: NO_STORE });

  const tags = await tagRepo.listForTenant(session.tenantId);
  return NextResponse.json(
    { enabled: true, tags: tags.map((t) => ({ id: t.id, label: t.label, color: t.color, count: t._count.applications })) },
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
  const parsed = safeParse(createTagSchema, body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });

  let tag;
  try {
    tag = await tagRepo.create({ tenantId: session.tenantId, label: parsed.data.label, color: parsed.data.color ?? null });
  } catch (err) {
    // @@unique([tenantId, label]) — a tag with that name already exists.
    if (err && typeof err === "object" && (err as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "A tag with that name already exists." }, { status: 409, headers: NO_STORE });
    }
    throw err;
  }
  await writeAuditLog(session.userId, session.email, "application_tag_create", parsed.data.label);
  return NextResponse.json({ tag: { id: tag.id, label: tag.label, color: tag.color, count: 0 } }, { status: 201, headers: NO_STORE });
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
  const parsed = safeParse(updateTagSchema, body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });

  const data: { label?: string; color?: string | null } = {};
  if (parsed.data.label !== undefined) data.label = parsed.data.label;
  if (parsed.data.color !== undefined) data.color = parsed.data.color;

  let changed: number;
  try {
    changed = await tagRepo.update(parsed.data.id, session.tenantId, data);
  } catch (err) {
    if (err && typeof err === "object" && (err as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "A tag with that name already exists." }, { status: 409, headers: NO_STORE });
    }
    throw err;
  }
  if (changed === 0) return NextResponse.json({ error: "Tag not found." }, { status: 404, headers: NO_STORE });
  await writeAuditLog(session.userId, session.email, "application_tag_update", `tag ${parsed.data.id.slice(-6)}`);
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
  const parsed = safeParse(deleteTagSchema, body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });

  const removed = await tagRepo.delete(parsed.data.id, session.tenantId);
  if (removed === 0) return NextResponse.json({ error: "Tag not found." }, { status: 404, headers: NO_STORE });
  await writeAuditLog(session.userId, session.email, "application_tag_delete", `tag ${parsed.data.id.slice(-6)}`);
  return NextResponse.json({ success: true }, { headers: NO_STORE });
}
