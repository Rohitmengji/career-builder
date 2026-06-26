/*
 * Admin Nurture Enrollment API (ADR-0019, B4).
 *
 * POST — enroll a campaign's audience FROM A TALENT POOL ({ poolId }) (recruiter+).
 *   Reuses B3 pools as the audience source. Each pool member is enrolled idempotently
 *   (re-enroll = no-op). Consent is NOT checked here — it is enforced PER SEND by the
 *   dispatcher (a candidate may grant/withdraw marketing consent after enrollment).
 *
 * Flag-gated (nurture_email). Tenant-scoped: both the campaign and the pool are
 * verified tenant-owned.
 */

import { NextResponse } from "next/server";
import { getSession, validateCsrf, writeAuditLog } from "@/lib/auth";
import { campaignRepo, talentPoolRepo } from "@career-builder/database";
import { isEnabled } from "@career-builder/shared/feature-flags";
import { safeParse, enrollCampaignSchema } from "@career-builder/security/validate";

const NO_STORE = { "Cache-Control": "no-store" } as const;
const WRITE_ROLES = ["super_admin", "admin", "hiring_manager", "recruiter"];
const flagOff = () => !isEnabled("nurture_email");
const MAX_ENROLL = 2000;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (flagOff()) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  if (!WRITE_ROLES.includes(session.role)) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403, headers: NO_STORE });
  if (!(await validateCsrf(req))) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403, headers: NO_STORE });

  const { id } = await params;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400, headers: NO_STORE }); }
  const parsed = safeParse(enrollCampaignSchema, body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });

  if (!(await campaignRepo.findByIdScoped(id, session.tenantId))) return NextResponse.json({ error: "Campaign not found." }, { status: 404, headers: NO_STORE });
  if (!(await talentPoolRepo.findByIdScoped(parsed.data.poolId, session.tenantId))) return NextResponse.json({ error: "Pool not found." }, { status: 404, headers: NO_STORE });

  const members = await talentPoolRepo.listMembers(session.tenantId, parsed.data.poolId, MAX_ENROLL);
  let enrolled = 0;
  for (const m of members) {
    const ok = await campaignRepo.enroll(session.tenantId, id, m.candidateEmail, m.candidateName);
    if (ok) enrolled += 1;
  }
  await writeAuditLog(session.userId, session.email, "campaign_enroll", `campaign ${id.slice(-6)} ← pool ${parsed.data.poolId.slice(-6)}: ${enrolled}`);
  return NextResponse.json({ enrolled, fromPool: members.length }, { headers: NO_STORE });
}
