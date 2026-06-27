/*
 * Candidate Portable-Record sharing (ADR-0030).
 *
 * GET  — the candidate's current sharing state for THIS employer.
 * POST — { share } : opt in / out of revealing their verified cross-platform track
 *        record to this employer. Append-only consent ledger (granted=true/false); the
 *        latest row wins, so this is fully revocable. Own-session only; flag-gated.
 *
 * The grant is scoped to the candidate's CURRENT session tenant — i.e. the employer
 * whose career site they're on / applying to. The recruiter side (admin) only surfaces
 * the footprint when a current grant exists for (that tenant, that candidate email).
 */

import { NextResponse } from "next/server";
import { getCurrentCandidate } from "@/lib/candidateAuth";
import { consentRepo } from "@career-builder/database";
import { isEnabled } from "@career-builder/shared/feature-flags";
import { safeParse, portableShareSchema } from "@career-builder/security/validate";

const NO_STORE = { "Cache-Control": "no-store" } as const;
const CONSENT_TYPE = "portable_profile_share";

export async function GET() {
  if (!isEnabled("portable_record")) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  const candidate = await getCurrentCandidate();
  if (!candidate) return NextResponse.json({ error: "Not authenticated" }, { status: 401, headers: NO_STORE });
  const current = await consentRepo.currentFor(candidate.tenantId, candidate.email);
  return NextResponse.json({ shared: current[CONSENT_TYPE] === true }, { headers: NO_STORE });
}

export async function POST(req: Request) {
  if (!isEnabled("portable_record")) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  const candidate = await getCurrentCandidate();
  if (!candidate) return NextResponse.json({ error: "Not authenticated" }, { status: 401, headers: NO_STORE });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400, headers: NO_STORE }); }
  const parsed = safeParse(portableShareSchema, body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });

  // Append-only: a new row (granted true/false); currentFor reads the latest → revocable.
  const policyVersion = process.env.NEXT_PUBLIC_PRIVACY_POLICY_VERSION || "1.0";
  await consentRepo.record({
    tenantId: candidate.tenantId,
    subjectEmail: candidate.email,
    type: CONSENT_TYPE,
    policyVersion,
    granted: parsed.data.share,
    source: "profile_settings",
  });
  return NextResponse.json({ shared: parsed.data.share }, { headers: NO_STORE });
}
