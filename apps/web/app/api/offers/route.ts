/*
 * GET /api/offers — the authenticated candidate's own offers (ADR-0008).
 * Matched by application email + tenant; returns candidate-safe fields only
 * (NEVER internal notes / approver identity). Status is the EFFECTIVE status
 * (an un-swept past-expiry offer reads as "expired"). Flag-gated.
 */

import { NextResponse } from "next/server";
import { getCandidateSession } from "@/lib/candidateAuth";
import { offerRepo } from "@career-builder/database";
import { isEnabled } from "@career-builder/shared/feature-flags";
import { effectiveStatus } from "@career-builder/shared/offer";

const NO_STORE = { "Cache-Control": "no-store" } as const;

export async function GET() {
  if (!isEnabled("offer_management")) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  }
  const session = await getCandidateSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  }

  const now = new Date();
  const offers = await offerRepo.listForCandidate(session.email, session.tenantId);
  const safe = offers.map((o) => ({
    id: o.id,
    status: effectiveStatus({ status: o.status, expiresAt: o.expiresAt }, now),
    salaryAmount: o.salaryAmount,
    salaryCurrency: o.salaryCurrency,
    salaryPeriod: o.salaryPeriod,
    startDate: o.startDate ? o.startDate.toISOString() : null,
    expiresAt: o.expiresAt ? o.expiresAt.toISOString() : null,
    terms: o.terms, // candidate-visible note only
    decidedAt: o.respondedAt ? o.respondedAt.toISOString() : null,
    applicationId: o.applicationId,
    jobTitle: o.application?.job?.title ?? null,
  }));

  return NextResponse.json({ offers: safe }, { headers: NO_STORE });
}
