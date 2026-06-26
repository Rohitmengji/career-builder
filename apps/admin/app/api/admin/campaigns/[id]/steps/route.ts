/*
 * Admin Nurture Campaign Steps API (ADR-0019, B4).
 *
 * GET    — list a campaign's steps (recruiter+)
 * POST   — append a step ({ offsetDays, subject, body }) (recruiter+)
 * DELETE — remove a step ({ stepId }) (recruiter+)
 *
 * Flag-gated (nurture_email). Tenant-scoped: the campaign is verified tenant-owned.
 */

import { NextResponse } from "next/server";
import { getSession, getSessionReadOnly, validateCsrf, writeAuditLog } from "@/lib/auth";
import { campaignRepo } from "@career-builder/database";
import { isEnabled } from "@career-builder/shared/feature-flags";
import { safeParse, addCampaignStepSchema, deleteCampaignStepSchema } from "@career-builder/security/validate";

const NO_STORE = { "Cache-Control": "no-store" } as const;
const WRITE_ROLES = ["super_admin", "admin", "hiring_manager", "recruiter"];
const flagOff = () => !isEnabled("nurture_email");

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (flagOff()) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  const session = await getSessionReadOnly();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  if (session.role === "viewer") return NextResponse.json({ error: "Insufficient permissions" }, { status: 403, headers: NO_STORE });

  const { id } = await params;
  if (!(await campaignRepo.findByIdScoped(id, session.tenantId))) return NextResponse.json({ error: "Campaign not found." }, { status: 404, headers: NO_STORE });
  const steps = await campaignRepo.listSteps(session.tenantId, id);
  return NextResponse.json({ steps: steps.map((s) => ({ id: s.id, stepIndex: s.stepIndex, offsetDays: s.offsetDays, subject: s.subject, body: s.body })) }, { headers: NO_STORE });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (flagOff()) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  if (!WRITE_ROLES.includes(session.role)) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403, headers: NO_STORE });
  if (!(await validateCsrf(req))) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403, headers: NO_STORE });

  const { id } = await params;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400, headers: NO_STORE }); }
  const parsed = safeParse(addCampaignStepSchema, body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });

  if (!(await campaignRepo.findByIdScoped(id, session.tenantId))) return NextResponse.json({ error: "Campaign not found." }, { status: 404, headers: NO_STORE });
  const step = await campaignRepo.addStep(session.tenantId, id, { offsetDays: parsed.data.offsetDays, subject: parsed.data.subject, body: parsed.data.body });
  await writeAuditLog(session.userId, session.email, "campaign_step_add", `campaign ${id.slice(-6)} step ${step.stepIndex}`);
  return NextResponse.json({ step: { id: step.id, stepIndex: step.stepIndex, offsetDays: step.offsetDays, subject: step.subject, body: step.body } }, { status: 201, headers: NO_STORE });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (flagOff()) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  if (!WRITE_ROLES.includes(session.role)) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403, headers: NO_STORE });
  if (!(await validateCsrf(req))) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403, headers: NO_STORE });

  const { id } = await params;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400, headers: NO_STORE }); }
  const parsed = safeParse(deleteCampaignStepSchema, body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });

  if (!(await campaignRepo.findByIdScoped(id, session.tenantId))) return NextResponse.json({ error: "Campaign not found." }, { status: 404, headers: NO_STORE });
  const removed = await campaignRepo.deleteStep(parsed.data.stepId, session.tenantId);
  if (removed === 0) return NextResponse.json({ error: "Step not found." }, { status: 404, headers: NO_STORE });
  await writeAuditLog(session.userId, session.email, "campaign_step_delete", `step ${parsed.data.stepId.slice(-6)}`);
  return NextResponse.json({ success: true }, { headers: NO_STORE });
}
