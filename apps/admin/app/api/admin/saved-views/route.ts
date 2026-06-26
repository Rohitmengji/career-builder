/*
 * Admin Saved Views API (ADR-0016, B2b). Named, PRIVATE filter presets on the
 * applications list.
 *
 * GET    — list the CALLER'S OWN views (scoped tenant + user)
 * POST   — create a view ({ name, filters })
 * DELETE — delete one of the caller's OWN views ({ id })
 *
 * Flag-gated (saved_views). A view belongs to exactly one user in one tenant and is
 * never visible to (or deletable by) anyone else. `filters` is sanitized to the
 * whitelisted key set (shared/saved-view) before storage.
 */

import { NextResponse } from "next/server";
import { getSession, getSessionReadOnly, validateCsrf, writeAuditLog } from "@/lib/auth";
import { savedViewRepo } from "@career-builder/database";
import { isEnabled } from "@career-builder/shared/feature-flags";
import { serializeViewFilters, parseViewFilters } from "@career-builder/shared/saved-view";
import { safeParse, createSavedViewSchema, deleteSavedViewSchema } from "@career-builder/security/validate";

const NO_STORE = { "Cache-Control": "no-store" } as const;
const flagOff = () => !isEnabled("saved_views");

/* ------------------------------------------------------------------ GET */
export async function GET() {
  if (flagOff()) return NextResponse.json({ views: [], enabled: false }, { headers: NO_STORE });
  const session = await getSessionReadOnly();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  // Viewers can't access the applications list a view targets — deny here too, to
  // match the rest of B2b (tags + applications routes both 403 viewers).
  if (session.role === "viewer") return NextResponse.json({ error: "Insufficient permissions" }, { status: 403, headers: NO_STORE });

  const views = await savedViewRepo.listForUser(session.tenantId, session.userId);
  return NextResponse.json(
    { enabled: true, views: views.map((v) => ({ id: v.id, name: v.name, filters: parseViewFilters(v.filters) })) },
    { headers: NO_STORE },
  );
}

/* ----------------------------------------------------------------- POST */
export async function POST(req: Request) {
  if (flagOff()) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  if (session.role === "viewer") return NextResponse.json({ error: "Insufficient permissions" }, { status: 403, headers: NO_STORE });
  if (!(await validateCsrf(req))) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403, headers: NO_STORE });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400, headers: NO_STORE }); }
  const parsed = safeParse(createSavedViewSchema, body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });

  const view = await savedViewRepo.create({
    tenantId: session.tenantId,
    userId: session.userId,
    name: parsed.data.name,
    // Double-sanitize: zod validated the shape; serializeViewFilters re-whitelists keys.
    filters: serializeViewFilters(parsed.data.filters),
  });
  await writeAuditLog(session.userId, session.email, "saved_view_create", parsed.data.name);
  return NextResponse.json(
    { view: { id: view.id, name: view.name, filters: parseViewFilters(view.filters) } },
    { status: 201, headers: NO_STORE },
  );
}

/* -------------------------------------------------------------- DELETE */
export async function DELETE(req: Request) {
  if (flagOff()) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  if (session.role === "viewer") return NextResponse.json({ error: "Insufficient permissions" }, { status: 403, headers: NO_STORE });
  if (!(await validateCsrf(req))) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403, headers: NO_STORE });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400, headers: NO_STORE }); }
  const parsed = safeParse(deleteSavedViewSchema, body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });

  const removed = await savedViewRepo.delete(parsed.data.id, session.tenantId, session.userId);
  if (removed === 0) return NextResponse.json({ error: "View not found." }, { status: 404, headers: NO_STORE });
  await writeAuditLog(session.userId, session.email, "saved_view_delete", `view ${parsed.data.id.slice(-6)}`);
  return NextResponse.json({ success: true }, { headers: NO_STORE });
}
