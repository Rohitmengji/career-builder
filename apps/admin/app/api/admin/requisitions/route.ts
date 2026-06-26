/*
 * Admin Requisitions API (ADR-0020, B6a). The approval record that authorizes a job
 * to be published.
 *
 * GET    — list the tenant's requisitions (recruiter+)
 * POST   — raise a requisition (recruiter+); optionally linked to a job (one per job)
 * PATCH  — { id, ...fields }            edit a DRAFT requisition (recruiter+)
 *        — { id, action, decisionNote? } drive the state machine:
 *            submit/reopen → recruiter+ ; approve/reject → manager+ (APPROVE_ROLES)
 * DELETE — remove a requisition (recruiter+)
 *
 * Flag-gated (req_approval). State machine in shared/requisition; transitions are an
 * atomic CAS in the repo so concurrent approvals can't double-apply. The publish gate
 * itself lives in the jobs route (a job needs an approved requisition to go live).
 */

import { NextResponse } from "next/server";
import { getSession, getSessionReadOnly, validateCsrf, writeAuditLog } from "@/lib/auth";
import { requisitionRepo, jobRepo } from "@career-builder/database";
import { isEnabled } from "@career-builder/shared/feature-flags";
import { canTransition, targetFor, isRequisitionStatus, type RequisitionStatus, type RequisitionAction } from "@career-builder/shared/requisition";
import { safeParse, createRequisitionSchema, updateRequisitionSchema, requisitionActionSchema, deleteRequisitionSchema } from "@career-builder/security/validate";

const NO_STORE = { "Cache-Control": "no-store" } as const;
const WRITE_ROLES = ["super_admin", "admin", "hiring_manager", "recruiter"];
const APPROVE_ROLES = ["super_admin", "admin", "hiring_manager"]; // approve/reject — manager+
const flagOff = () => !isEnabled("req_approval");

/* ------------------------------------------------------------------ GET */
export async function GET() {
  if (flagOff()) return NextResponse.json({ requisitions: [], enabled: false }, { headers: NO_STORE });
  const session = await getSessionReadOnly();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  if (session.role === "viewer") return NextResponse.json({ error: "Insufficient permissions" }, { status: 403, headers: NO_STORE });

  const reqs = await requisitionRepo.listForTenant(session.tenantId);
  return NextResponse.json({ enabled: true, requisitions: reqs }, { headers: NO_STORE });
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
  const parsed = safeParse(createRequisitionSchema, body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });

  // If linked to a job, verify the job is tenant-owned (no cross-tenant linkage).
  if (parsed.data.jobId) {
    const job = await jobRepo.findById(parsed.data.jobId);
    if (!job || job.tenantId !== session.tenantId) return NextResponse.json({ error: "Job not found." }, { status: 404, headers: NO_STORE });
  }

  let requisition;
  try {
    requisition = await requisitionRepo.create({
      tenantId: session.tenantId,
      jobId: parsed.data.jobId ?? null,
      title: parsed.data.title,
      department: parsed.data.department ?? null,
      headcount: parsed.data.headcount,
      justification: parsed.data.justification ?? null,
      createdById: session.userId,
    });
  } catch (err) {
    if (requisitionRepo.isDuplicateJobError(err)) return NextResponse.json({ error: "This job already has a requisition." }, { status: 409, headers: NO_STORE });
    throw err;
  }
  await writeAuditLog(session.userId, session.email, "requisition_create", parsed.data.title);
  return NextResponse.json({ requisition }, { status: 201, headers: NO_STORE });
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

  // Action mode (drive the state machine) vs edit mode.
  if (body && typeof body === "object" && "action" in body) {
    const parsed = safeParse(requisitionActionSchema, body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });

    const current = await requisitionRepo.findByIdScoped(parsed.data.id, session.tenantId);
    if (!current) return NextResponse.json({ error: "Requisition not found." }, { status: 404, headers: NO_STORE });

    const from = current.status as RequisitionStatus;
    if (!isRequisitionStatus(from)) return NextResponse.json({ error: "Invalid current status." }, { status: 409, headers: NO_STORE });
    const to = targetFor(parsed.data.action as RequisitionAction);

    // Structural rule (state machine) + RBAC (who may drive it).
    if (!canTransition(from, to)) return NextResponse.json({ error: `Cannot ${parsed.data.action} a requisition that is ${from}.` }, { status: 409, headers: NO_STORE });
    const isDecision = parsed.data.action === "approve" || parsed.data.action === "reject";
    if (isDecision && !APPROVE_ROLES.includes(session.role)) return NextResponse.json({ error: "Only a hiring manager or admin can approve or reject." }, { status: 403, headers: NO_STORE });

    const changed = await requisitionRepo.transition(parsed.data.id, session.tenantId, from, to, {
      ...(isDecision ? { approverId: session.userId, decidedAt: new Date(), decisionNote: parsed.data.decisionNote ?? null } : {}),
    });
    if (changed === 0) return NextResponse.json({ error: "Requisition changed since you loaded it — refresh and retry." }, { status: 409, headers: NO_STORE });
    await writeAuditLog(session.userId, session.email, `requisition_${parsed.data.action}`, `req ${parsed.data.id.slice(-6)} → ${to}`);
    return NextResponse.json({ success: true, status: to }, { headers: NO_STORE });
  }

  // Edit mode — only DRAFT requisitions are editable.
  const parsed = safeParse(updateRequisitionSchema, body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });
  const current = await requisitionRepo.findByIdScoped(parsed.data.id, session.tenantId);
  if (!current) return NextResponse.json({ error: "Requisition not found." }, { status: 404, headers: NO_STORE });
  if (current.status !== "draft") return NextResponse.json({ error: "Only a draft requisition can be edited." }, { status: 409, headers: NO_STORE });

  const data: { title?: string; department?: string | null; headcount?: number; justification?: string | null } = {};
  if (parsed.data.title !== undefined) data.title = parsed.data.title;
  if (parsed.data.department !== undefined) data.department = parsed.data.department;
  if (parsed.data.headcount !== undefined) data.headcount = parsed.data.headcount;
  if (parsed.data.justification !== undefined) data.justification = parsed.data.justification;
  // Atomic edit: update() CASes on status==="draft" — 0 rows means it was submitted/
  // approved between our read and write (TOCTOU) → 409, never silently mutate it.
  const edited = await requisitionRepo.update(parsed.data.id, session.tenantId, data);
  if (edited === 0) return NextResponse.json({ error: "Requisition is no longer a draft — refresh and retry." }, { status: 409, headers: NO_STORE });
  await writeAuditLog(session.userId, session.email, "requisition_update", `req ${parsed.data.id.slice(-6)}`);
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
  const parsed = safeParse(deleteRequisitionSchema, body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });

  const removed = await requisitionRepo.delete(parsed.data.id, session.tenantId);
  if (removed === 0) return NextResponse.json({ error: "Requisition not found." }, { status: 404, headers: NO_STORE });
  await writeAuditLog(session.userId, session.email, "requisition_delete", `req ${parsed.data.id.slice(-6)}`);
  return NextResponse.json({ success: true }, { headers: NO_STORE });
}
