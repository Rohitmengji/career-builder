/*
 * Admin Hiring Team API (ADR-0020, B6b). Manage who may see/act on a job's applications.
 *
 * GET    — list the job's hiring team (manager+)
 * POST   — add a tenant user to the team ({ userId, role? }) (manager+)
 * DELETE — remove a user from the team ({ userId }) (manager+)
 *
 * Flag-gated (hiring_teams). Team management is MANAGER+ only (assigning access is a
 * privileged act). Tenant isolation: the job AND the user are verified tenant-owned
 * before linking. The actual visibility enforcement lives in lib/hiringTeams + every
 * application-access route.
 */

import { NextResponse } from "next/server";
import { getSession, getSessionReadOnly, validateCsrf, writeAuditLog } from "@/lib/auth";
import { jobRepo, userRepo, hiringTeamRepo } from "@career-builder/database";
import { isEnabled } from "@career-builder/shared/feature-flags";
import { safeParse, addTeamMemberSchema, removeTeamMemberSchema } from "@career-builder/security/validate";

const NO_STORE = { "Cache-Control": "no-store" } as const;
const MANAGE_ROLES = ["super_admin", "admin", "hiring_manager"];
const flagOff = () => !isEnabled("hiring_teams");

async function ownsJob(jobId: string, tenantId: string) {
  const job = await jobRepo.findById(jobId);
  return job && job.tenantId === tenantId ? job : null;
}

/* ------------------------------------------------------------------ GET */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (flagOff()) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  const session = await getSessionReadOnly();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  if (!MANAGE_ROLES.includes(session.role)) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403, headers: NO_STORE });

  const { id } = await params;
  if (!(await ownsJob(id, session.tenantId))) return NextResponse.json({ error: "Job not found." }, { status: 404, headers: NO_STORE });

  const members = await hiringTeamRepo.listForJob(session.tenantId, id);
  return NextResponse.json(
    { members: members.map((m) => ({ userId: m.userId, name: m.user.name, email: m.user.email, role: m.role })) },
    { headers: NO_STORE },
  );
}

/* ----------------------------------------------------------------- POST */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (flagOff()) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  if (!MANAGE_ROLES.includes(session.role)) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403, headers: NO_STORE });
  if (!(await validateCsrf(req))) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403, headers: NO_STORE });

  const { id } = await params;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400, headers: NO_STORE }); }
  const parsed = safeParse(addTeamMemberSchema, body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });

  if (!(await ownsJob(id, session.tenantId))) return NextResponse.json({ error: "Job not found." }, { status: 404, headers: NO_STORE });

  // The user being added MUST belong to this tenant (no cross-tenant team linkage).
  const members = await userRepo.findByTenant(session.tenantId);
  if (!members.some((u) => u.id === parsed.data.userId)) {
    return NextResponse.json({ error: "User not found." }, { status: 404, headers: NO_STORE });
  }

  const added = await hiringTeamRepo.addMember(session.tenantId, id, parsed.data.userId, parsed.data.role ?? "member");
  await writeAuditLog(session.userId, session.email, "hiring_team_add", `job ${id.slice(-6)} ← user ${parsed.data.userId.slice(-6)}`);
  return NextResponse.json({ success: true, added }, { headers: NO_STORE });
}

/* -------------------------------------------------------------- DELETE */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (flagOff()) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  if (!MANAGE_ROLES.includes(session.role)) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403, headers: NO_STORE });
  if (!(await validateCsrf(req))) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403, headers: NO_STORE });

  const { id } = await params;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400, headers: NO_STORE }); }
  const parsed = safeParse(removeTeamMemberSchema, body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });

  if (!(await ownsJob(id, session.tenantId))) return NextResponse.json({ error: "Job not found." }, { status: 404, headers: NO_STORE });

  await hiringTeamRepo.removeMember(session.tenantId, id, parsed.data.userId);
  await writeAuditLog(session.userId, session.email, "hiring_team_remove", `job ${id.slice(-6)} ✕ user ${parsed.data.userId.slice(-6)}`);
  return NextResponse.json({ success: true }, { headers: NO_STORE });
}
