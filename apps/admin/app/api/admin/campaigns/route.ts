/*
 * Admin Nurture Campaigns API (ADR-0019, B4). Manage re-engagement sequences.
 *
 * GET    — list the tenant's campaigns + step/enrollment counts (recruiter+)
 * POST   — create a campaign (recruiter+)
 * PATCH  — rename / set status draft|active|paused (recruiter+)
 * DELETE — delete a campaign (recruiter+; cascades steps/enrollments/sends)
 *
 * Flag-gated (nurture_email). Steps live under ./[id]/steps; enrollment under
 * ./[id]/enroll; the actual sending is the C1 nurture-dispatch cron (consent-gated).
 */

import { NextResponse } from "next/server";
import { getSession, getSessionReadOnly, validateCsrf, writeAuditLog } from "@/lib/auth";
import { campaignRepo } from "@career-builder/database";
import { isEnabled } from "@career-builder/shared/feature-flags";
import { safeParse, createCampaignSchema, updateCampaignSchema, deleteCampaignSchema } from "@career-builder/security/validate";

const NO_STORE = { "Cache-Control": "no-store" } as const;
const WRITE_ROLES = ["super_admin", "admin", "hiring_manager", "recruiter"];
const flagOff = () => !isEnabled("nurture_email");

export async function GET() {
  if (flagOff()) return NextResponse.json({ campaigns: [], enabled: false }, { headers: NO_STORE });
  const session = await getSessionReadOnly();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  if (session.role === "viewer") return NextResponse.json({ error: "Insufficient permissions" }, { status: 403, headers: NO_STORE });

  const campaigns = await campaignRepo.listForTenant(session.tenantId);
  return NextResponse.json(
    { enabled: true, campaigns: campaigns.map((c) => ({ id: c.id, name: c.name, status: c.status, steps: c._count.steps, enrollments: c._count.enrollments })) },
    { headers: NO_STORE },
  );
}

export async function POST(req: Request) {
  if (flagOff()) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  if (!WRITE_ROLES.includes(session.role)) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403, headers: NO_STORE });
  if (!(await validateCsrf(req))) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403, headers: NO_STORE });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400, headers: NO_STORE }); }
  const parsed = safeParse(createCampaignSchema, body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });

  let campaign;
  try {
    campaign = await campaignRepo.create({ tenantId: session.tenantId, name: parsed.data.name, createdById: session.userId });
  } catch (err) {
    if (err && typeof err === "object" && (err as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "A campaign with that name already exists." }, { status: 409, headers: NO_STORE });
    }
    throw err;
  }
  await writeAuditLog(session.userId, session.email, "campaign_create", parsed.data.name);
  return NextResponse.json({ campaign: { id: campaign.id, name: campaign.name, status: campaign.status, steps: 0, enrollments: 0 } }, { status: 201, headers: NO_STORE });
}

export async function PATCH(req: Request) {
  if (flagOff()) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  if (!WRITE_ROLES.includes(session.role)) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403, headers: NO_STORE });
  if (!(await validateCsrf(req))) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403, headers: NO_STORE });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400, headers: NO_STORE }); }
  const parsed = safeParse(updateCampaignSchema, body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });

  const data: { name?: string; status?: string } = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.status !== undefined) data.status = parsed.data.status;
  let changed: number;
  try {
    changed = await campaignRepo.update(parsed.data.id, session.tenantId, data);
  } catch (err) {
    if (err && typeof err === "object" && (err as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "A campaign with that name already exists." }, { status: 409, headers: NO_STORE });
    }
    throw err;
  }
  if (changed === 0) return NextResponse.json({ error: "Campaign not found." }, { status: 404, headers: NO_STORE });
  await writeAuditLog(session.userId, session.email, "campaign_update", `campaign ${parsed.data.id.slice(-6)}`);
  return NextResponse.json({ success: true }, { headers: NO_STORE });
}

export async function DELETE(req: Request) {
  if (flagOff()) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  if (!WRITE_ROLES.includes(session.role)) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403, headers: NO_STORE });
  if (!(await validateCsrf(req))) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403, headers: NO_STORE });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400, headers: NO_STORE }); }
  const parsed = safeParse(deleteCampaignSchema, body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });

  const removed = await campaignRepo.delete(parsed.data.id, session.tenantId);
  if (removed === 0) return NextResponse.json({ error: "Campaign not found." }, { status: 404, headers: NO_STORE });
  await writeAuditLog(session.userId, session.email, "campaign_delete", `campaign ${parsed.data.id.slice(-6)}`);
  return NextResponse.json({ success: true }, { headers: NO_STORE });
}
