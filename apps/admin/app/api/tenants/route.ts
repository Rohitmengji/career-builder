/*
 * Tenant API — CRUD for tenant configurations.
 *
 * GET    /api/tenants              — list all tenants
 * GET    /api/tenants?id=<tenantId> — get a specific tenant
 * POST   /api/tenants              — create or update a tenant (auth + CSRF required)
 * DELETE /api/tenants?id=<tenantId> — delete a tenant (auth + CSRF required, admin only)
 */

import { NextResponse } from "next/server";
import { loadTenant, saveTenant, listTenants, deleteTenant } from "@/lib/tenantStore";
import { getSession, getSessionReadOnly, validateCsrf, writeAuditLog } from "@/lib/auth";
import { mergeTenantConfig, type TenantConfig } from "@career-builder/tenant-config";
import { saveTenantSchema, safeParse } from "@career-builder/security/validate";
import { sanitizeTenantId, sanitizeString, sanitizeThemeColors } from "@career-builder/security/sanitize";

/** GET /api/tenants — list tenants (authenticated users only) */
export async function GET(req: Request) {
  const session = await getSessionReadOnly();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (id) {
    const safeId = sanitizeTenantId(id);
    if (!safeId) {
      return NextResponse.json({ error: "Invalid tenant ID" }, { status: 400 });
    }
    const tenant = await loadTenant(safeId);
    return NextResponse.json({ tenant });
  }

  const ids = await listTenants();
  const tenants = await Promise.all(ids.map((tid) => loadTenant(tid)));
  return NextResponse.json({ tenants });
}

/** POST /api/tenants — create or update */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role === "viewer") {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }
  const csrfValid = await validateCsrf(req);
  if (!csrfValid) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  const body = await req.json();

  // Validate with Zod schema
  const parsed = safeParse(saveTenantSchema, body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const id = sanitizeTenantId(parsed.data.id);
  if (!id) {
    return NextResponse.json({ error: "Invalid tenant ID" }, { status: 400 });
  }

  // Sanitize tenant name and theme colors if present
  const sanitizedBody: Record<string, unknown> = { ...parsed.data, id };
  if (parsed.data.name) sanitizedBody.name = sanitizeString(parsed.data.name as string, 200);
  if (parsed.data.colors) sanitizedBody.colors = sanitizeThemeColors(parsed.data.colors as Record<string, string>);

  const config = mergeTenantConfig({
    ...sanitizedBody,
    updatedAt: new Date().toISOString(),
    createdAt: (parsed.data as Record<string, unknown>).createdAt as string || new Date().toISOString(),
  });

  await saveTenant(config);
  await writeAuditLog(session.userId, session.email, "tenant_save", `tenant: ${id}`);

  return NextResponse.json({ success: true, tenant: config });
}

/** DELETE /api/tenants?id=<tenantId> */
export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role !== "admin" && session.role !== "super_admin") {
    return NextResponse.json({ error: "Admin role required" }, { status: 403 });
  }
  const csrfValid = await validateCsrf(req);
  if (!csrfValid) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const rawId = searchParams.get("id");
  if (!rawId) {
    return NextResponse.json({ error: "Tenant ID is required" }, { status: 400 });
  }

  const id = sanitizeTenantId(rawId);
  if (!id) {
    return NextResponse.json({ error: "Invalid tenant ID" }, { status: 400 });
  }

  const deleted = await deleteTenant(id);
  if (!deleted) {
    return NextResponse.json({ error: "Cannot delete default tenant" }, { status: 400 });
  }

  await writeAuditLog(session.userId, session.email, "tenant_delete", `tenant: ${id}`);
  return NextResponse.json({ success: true });
}
