/*
 * /api/audit — read-only audit-log feed for the admin app.
 *
 * WHAT: Returns audit-log entries (logins, user/page changes, etc.) for the caller's tenant.
 *
 * WHY: Compliance + accountability — admins need to see who did what without DB access.
 *
 * HOW it fits in:
 *   - Read-only → getSessionReadOnly() (never writes a cookie).
 *   - Restricted to admin / super_admin; other roles get 403.
 *   - TENANT ISOLATION: entries are scoped by passing session.tenantId into readAuditLog;
 *     there is no cross-tenant query path and the tenant is taken from the session, never
 *     from the request (enforced in app code — no DB row-level security).
 */
import { NextResponse } from "next/server";
import { getSessionReadOnly, readAuditLog } from "@/lib/auth";

/** GET /api/audit — get audit log (admin only) */
export async function GET() {
  const session = await getSessionReadOnly();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role !== "admin" && session.role !== "super_admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const entries = await readAuditLog(session.tenantId);
  return NextResponse.json({ entries });
}
