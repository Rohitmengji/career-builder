/*
 * Admin Talent Pool Re-engage API (ADR-0018, B3) — consent-gated broadcast.
 *
 * POST — send a re-engagement email to a pool's members ({ subject, message }).
 *   The TRUST GATE: a candidate is emailed ONLY if they granted marketing consent
 *   (ADR-0011 consent ledger). Members without consent are silently skipped and
 *   counted. Recruiter+; CSRF; flag talent_pool. Blind-hiring-safe: the recruiter
 *   never sees the recipient emails — sending happens server-side.
 *
 * This is an IMMEDIATE single send (capped). Scheduled multi-step nurture is B4.
 */

import { NextResponse } from "next/server";
import { getSession, validateCsrf, writeAuditLog } from "@/lib/auth";
import { talentPoolRepo, consentRepo } from "@career-builder/database";
import { isEnabled } from "@career-builder/shared/feature-flags";
import { partitionReengageRecipients } from "@career-builder/shared/talent-pool";
import { emailService } from "@career-builder/email";
import { safeParse, reengagePoolSchema } from "@career-builder/security/validate";

const NO_STORE = { "Cache-Control": "no-store" } as const;
const WRITE_ROLES = ["super_admin", "admin", "hiring_manager", "recruiter"];
const MAX_RECIPIENTS = 500; // immediate-send cap (B4 adds a durable queue for larger sends)
const flagOff = () => !isEnabled("talent_pool");

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (flagOff()) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  if (!WRITE_ROLES.includes(session.role)) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403, headers: NO_STORE });
  if (!(await validateCsrf(req))) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403, headers: NO_STORE });

  const { id } = await params;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400, headers: NO_STORE }); }
  const parsed = safeParse(reengagePoolSchema, body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });

  const pool = await talentPoolRepo.findByIdScoped(id, session.tenantId);
  if (!pool) return NextResponse.json({ error: "Pool not found." }, { status: 404, headers: NO_STORE });

  const members = await talentPoolRepo.listMembers(session.tenantId, id);
  if (members.length === 0) return NextResponse.json({ sent: 0, skippedNoConsent: 0, total: 0 }, { headers: NO_STORE });

  // Build the consent map (one lookup per unique candidate), then partition by
  // marketing consent — DEFAULT-DENY (no consent record → skipped).
  const uniqueEmails = Array.from(new Set(members.map((m) => m.candidateEmail.toLowerCase())));
  const consentByEmail: Record<string, Record<string, boolean>> = {};
  await Promise.all(
    uniqueEmails.map(async (email) => {
      consentByEmail[email] = await consentRepo.currentFor(session.tenantId, email);
    }),
  );
  const { willSend, skippedNoConsent } = partitionReengageRecipients(members, consentByEmail);

  const capped = willSend.slice(0, MAX_RECIPIENTS);
  const companyName = process.env.NEXT_PUBLIC_COMPANY_NAME || "Our Company";

  // Send best-effort; a single failed send must not fail the whole broadcast.
  const results = await Promise.allSettled(
    capped.map((email) =>
      emailService.sendTalentPoolReengagement({ to: email, companyName, subject: parsed.data.subject, message: parsed.data.message }),
    ),
  );
  const sent = results.filter((r) => r.status === "fulfilled" && (r.value as { success?: boolean })?.success !== false).length;
  const failed = capped.length - sent;

  await writeAuditLog(session.userId, session.email, "talent_pool_reengage", `pool ${id.slice(-6)}: sent ${sent}, skipped ${skippedNoConsent.length}`);
  return NextResponse.json(
    { sent, failed, skippedNoConsent: skippedNoConsent.length, total: members.length, capped: willSend.length > MAX_RECIPIENTS },
    { headers: NO_STORE },
  );
}
