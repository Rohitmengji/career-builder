/*
 * POST /api/applications/[id]/withdraw — a candidate withdraws their OWN application
 * (ADR-0035). Candidate-control / transparency, alongside the data-rights work (A2).
 *
 * Own-only (email+tenant, ADR-0001). Allowed only while the application is in play and
 * PRE-OFFER (applied/screening/interview) — once an offer is out the candidate uses
 * accept/decline (ADR-0008), and a terminal app can't be withdrawn. Atomic CAS in the
 * repo (status guard folded into the WHERE — no TOCTOU). Emits a candidate-visible
 * "withdrawn" event (actorType "candidate"). CSRF is enforced by the web same-origin
 * middleware (no token), like the offer accept/decline route. Flag-gated.
 */

import { NextResponse } from "next/server";
import { getCandidateSession } from "@/lib/candidateAuth";
import { applicationRepo, eventRepo } from "@career-builder/database";
import { isEnabled } from "@career-builder/shared/feature-flags";
import { isWithdrawable } from "@career-builder/shared/application-status";

const NO_STORE = { "Cache-Control": "no-store" } as const;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isEnabled("candidate_withdrawal")) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  const session = await getCandidateSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });

  const { id } = await params;
  const app = await applicationRepo.findByIdScoped(id, session.tenantId);
  // Own-only: the application must belong to this candidate (email+tenant, ADR-0001).
  if (!app || app.email.toLowerCase() !== session.email.toLowerCase()) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  }
  if (!isWithdrawable(app.status)) {
    return NextResponse.json(
      { error: "This application can no longer be withdrawn.", status: app.status },
      { status: 409, headers: NO_STORE },
    );
  }

  // Authoritative atomic transition (guards the withdrawable statuses in the WHERE).
  const count = await applicationRepo.withdrawByIdIfActive(id, session.tenantId);
  if (count === 0) {
    const cur = await applicationRepo.findByIdScoped(id, session.tenantId);
    return NextResponse.json(
      { error: "This application can no longer be withdrawn.", status: cur?.status ?? "withdrawn" },
      { status: 409, headers: NO_STORE },
    );
  }

  // Candidate-visible event. actorType "candidate" → no candidate self-notification.
  eventRepo
    .record({
      tenantId: session.tenantId,
      applicationId: id,
      type: "application_withdrawn",
      fromStatus: app.status,
      toStatus: "withdrawn",
      actorType: "candidate",
      visibility: "candidate",
    })
    .catch(() => { /* event logging is best-effort; the withdrawal already committed */ });

  return NextResponse.json({ success: true, status: "withdrawn" }, { headers: NO_STORE });
}
