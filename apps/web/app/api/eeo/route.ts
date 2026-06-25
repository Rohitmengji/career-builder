/*
 * POST /api/eeo — voluntary EEO self-identification (ADR-0013).
 *
 * A SEPARATE request from the application itself, so demographics never travel
 * through the apply handler that builds the recruiter-facing application. The
 * candidate may only self-ID for their OWN application (email+tenant). Stored in
 * the isolated EeoSelfId table (no relation to Application). Flag-gated. CSRF via
 * the web middleware (same-origin).
 */

import { NextResponse } from "next/server";
import { getCandidateSession } from "@/lib/candidateAuth";
import { applicationRepo, eeoRepo } from "@career-builder/database";
import { isEnabled } from "@career-builder/shared/feature-flags";
import { eeoSelfIdSchema, safeParse } from "@career-builder/security/validate";

const NO_STORE = { "Cache-Control": "no-store" } as const;

export async function POST(req: Request) {
  if (!isEnabled("eeo_self_id")) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  const session = await getCandidateSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400, headers: NO_STORE }); }
  const parsed = safeParse(eeoSelfIdSchema, body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });
  const d = parsed.data;

  // Own-application only — the candidate can only self-ID for an application they submitted.
  const app = await applicationRepo.findByIdScoped(d.applicationId, session.tenantId);
  if (!app || app.email.toLowerCase() !== session.email.toLowerCase()) {
    return NextResponse.json({ error: "Application not found" }, { status: 404, headers: NO_STORE });
  }

  await eeoRepo.record({
    tenantId: session.tenantId,
    applicationId: d.applicationId,
    gender: d.gender ?? null,
    race: d.race ?? null,
    ethnicity: d.ethnicity ?? null,
    veteranStatus: d.veteranStatus ?? null,
    disability: d.disability ?? null,
  });

  return NextResponse.json({ success: true }, { headers: NO_STORE });
}
