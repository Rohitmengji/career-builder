/*
 * Admin Talent Pool Members API (ADR-0018, B3).
 *
 * GET    — list a pool's members (recruiter+). BLIND HIRING: member identity
 *          (name + email) is REDACTED to a stable non-identifying label, so the
 *          pool can't be used to de-anonymize a candidate the review hid. The
 *          re-engage flow still works (it sends server-side without showing email).
 * POST   — add a candidate to the pool BY APPLICATION ({ applicationId, note? }).
 *          The email/name are resolved from the tenant-scoped application — the
 *          client never supplies them. Idempotent.
 * DELETE — remove a candidate from the pool ({ email }).
 *
 * Flag-gated (talent_pool). Tenant isolation: the pool AND (on add) the application
 * are verified to belong to the caller's tenant.
 */

import { NextResponse } from "next/server";
import { getSession, getSessionReadOnly, validateCsrf, writeAuditLog } from "@/lib/auth";
import { talentPoolRepo, applicationRepo } from "@career-builder/database";
import { isEnabled } from "@career-builder/shared/feature-flags";
import { getBlindHiringConfig } from "@/lib/blindHiring";
import { safeParse, addPoolMemberSchema, removePoolMemberSchema } from "@career-builder/security/validate";

const NO_STORE = { "Cache-Control": "no-store" } as const;
const WRITE_ROLES = ["super_admin", "admin", "hiring_manager", "recruiter"];
const flagOff = () => !isEnabled("talent_pool");

/* ------------------------------------------------------------------ GET */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (flagOff()) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  const session = await getSessionReadOnly();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  if (session.role === "viewer") return NextResponse.json({ error: "Insufficient permissions" }, { status: 403, headers: NO_STORE });

  const { id } = await params;
  const pool = await talentPoolRepo.findByIdScoped(id, session.tenantId);
  if (!pool) return NextResponse.json({ error: "Pool not found." }, { status: 404, headers: NO_STORE });

  const blind = await getBlindHiringConfig(session.tenantId);
  const members = await talentPoolRepo.listMembers(session.tenantId, id);

  return NextResponse.json(
    {
      blindHiring: blind.enabled,
      members: members.map((m) => ({
        id: m.id,
        // Default-deny: under blind hiring, identity is replaced by a stable label.
        name: blind.enabled ? `Candidate ${m.id.slice(-4)}` : (m.candidateName ?? null),
        email: blind.enabled ? null : m.candidateEmail,
        // The note is recruiter free text and can carry identity ("Jane, ex-Google")
        // — it must be suppressed under blind hiring too, not just name/email.
        note: blind.enabled ? null : m.note,
        createdAt: m.createdAt,
      })),
    },
    { headers: NO_STORE },
  );
}

/* ----------------------------------------------------------------- POST */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (flagOff()) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  if (!WRITE_ROLES.includes(session.role)) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403, headers: NO_STORE });
  if (!(await validateCsrf(req))) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403, headers: NO_STORE });

  const { id } = await params;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400, headers: NO_STORE }); }
  const parsed = safeParse(addPoolMemberSchema, body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });

  const pool = await talentPoolRepo.findByIdScoped(id, session.tenantId);
  if (!pool) return NextResponse.json({ error: "Pool not found." }, { status: 404, headers: NO_STORE });

  // Resolve the candidate from the tenant-scoped application (never trust client email).
  const app = await applicationRepo.findByIdScoped(parsed.data.applicationId, session.tenantId);
  if (!app) return NextResponse.json({ error: "Application not found." }, { status: 404, headers: NO_STORE });

  const added = await talentPoolRepo.addMember(session.tenantId, id, app.email, {
    candidateName: `${app.firstName} ${app.lastName}`.trim() || null,
    note: parsed.data.note ?? null,
    addedById: session.userId,
  });
  await writeAuditLog(session.userId, session.email, "talent_pool_member_add", `pool ${id.slice(-6)} ← app ${parsed.data.applicationId.slice(-6)}`);
  return NextResponse.json({ success: true, added }, { headers: NO_STORE });
}

/* -------------------------------------------------------------- DELETE */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (flagOff()) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  if (!WRITE_ROLES.includes(session.role)) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403, headers: NO_STORE });
  if (!(await validateCsrf(req))) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403, headers: NO_STORE });

  const { id } = await params;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400, headers: NO_STORE }); }
  const parsed = safeParse(removePoolMemberSchema, body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });

  const pool = await talentPoolRepo.findByIdScoped(id, session.tenantId);
  if (!pool) return NextResponse.json({ error: "Pool not found." }, { status: 404, headers: NO_STORE });

  const removed = await talentPoolRepo.removeMember(session.tenantId, id, parsed.data.email);
  if (removed === 0) return NextResponse.json({ error: "Member not found." }, { status: 404, headers: NO_STORE });
  await writeAuditLog(session.userId, session.email, "talent_pool_member_remove", `pool ${id.slice(-6)}`);
  return NextResponse.json({ success: true }, { headers: NO_STORE });
}
