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
