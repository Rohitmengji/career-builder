/*
 * GET /api/admin/team — active team members for @mention autocomplete.
 * Recruiter+ (anyone who can comment). Tenant-scoped; returns id/name/email only.
 */

import { NextResponse } from "next/server";
import { getSessionReadOnly } from "@/lib/auth";
import { userRepo } from "@career-builder/database";

export async function GET() {
  const session = await getSessionReadOnly();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role === "viewer") {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const users = await userRepo.findByTenant(session.tenantId);
  const team = users
    .filter((u) => u.isActive)
    .map((u) => ({ id: u.id, name: u.name, email: u.email }));

  return NextResponse.json({ team }, { headers: { "Cache-Control": "no-store" } });
}
