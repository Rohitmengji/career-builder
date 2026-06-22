/*
 * POST /api/offers/[id] — candidate accepts/declines their OWN offer (ADR-0008).
 *
 * Idempotent + race-safe: a KV `incr` fast-path dedupe in front of an
 * authoritative DB compare-and-swap (`offerRepo.decideAsCandidate`) that only
 * transitions a still-`sent`, not-yet-expired offer owned by this candidate
 * (email+tenant + expiry folded into the WHERE — no TOCTOU window). On accept the
 * application advances to "hired"; decline leaves the application for the recruiter
 * to triage. CSRF is enforced by the web middleware (same-origin). Flag-gated.
 */

import { NextResponse } from "next/server";
import { getCandidateSession } from "@/lib/candidateAuth";
import { offerRepo, applicationRepo, eventRepo } from "@career-builder/database";
import { isEnabled } from "@career-builder/shared/feature-flags";
import { isExpired, effectiveStatus } from "@career-builder/shared/offer";
import { offerDecisionSchema, safeParse } from "@career-builder/security/validate";
import { sanitizeString } from "@career-builder/security/sanitize";
import { getKV } from "@career-builder/shared/kv";
import { emailService } from "@career-builder/email";

const NO_STORE = { "Cache-Control": "no-store" } as const;
/** Application statuses an accepted offer may advance to "hired" (never regress a terminal app). */
const PRE_HIRE = new Set(["applied", "screening", "interview", "offer"]);

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isEnabled("offer_management")) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  }
  const session = await getCandidateSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });

  const { id } = await params;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400, headers: NO_STORE }); }
  const parsed = safeParse(offerDecisionSchema, body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });
  const { action, note } = parsed.data;

  // Load for a good error / ownership 404 (the OUTCOME is decided by the CAS below).
  const offer = await offerRepo.findForCandidate(id, session.email, session.tenantId);
  if (!offer) return NextResponse.json({ error: "Offer not found" }, { status: 404, headers: NO_STORE });

  const now = new Date();
  if (offer.status !== "sent") {
    return NextResponse.json({ error: "This offer is no longer open.", status: effectiveStatus({ status: offer.status, expiresAt: offer.expiresAt }, now) }, { status: 409, headers: NO_STORE });
  }
  if (isExpired({ status: offer.status, expiresAt: offer.expiresAt }, now)) {
    return NextResponse.json({ error: "This offer has expired.", status: "expired" }, { status: 409, headers: NO_STORE });
  }

  // KV fast-path dedupe (per offer — an offer is decided once). Fails open.
  const idemKey = `offer:decide:${session.tenantId}:${id}`;
  const hits = await getKV().incr(idemKey, 24 * 60 * 60).catch(() => 0);
  if (hits > 1) {
    const cur = await offerRepo.findForCandidate(id, session.email, session.tenantId);
    return NextResponse.json({ success: true, status: cur ? effectiveStatus({ status: cur.status, expiresAt: cur.expiresAt }, now) : action === "accept" ? "accepted" : "declined", duplicate: true }, { headers: NO_STORE });
  }

  const toStatus = action === "accept" ? "accepted" : "declined";
  const cleanNote = note ? sanitizeString(note, 1000) : null;
  // Authoritative atomic transition (guards status:"sent" + not-expired + ownership).
  const count = await offerRepo.decideAsCandidate(id, session.tenantId, session.email, toStatus, cleanNote, now);
  if (count === 0) {
    const cur = await offerRepo.findForCandidate(id, session.email, session.tenantId);
    return NextResponse.json({ error: "This offer is no longer open.", status: cur ? effectiveStatus({ status: cur.status, expiresAt: cur.expiresAt }, now) : "expired" }, { status: 409, headers: NO_STORE });
  }

  // Candidate-visible offer event.
  eventRepo
    .record({
      tenantId: session.tenantId,
      applicationId: offer.applicationId,
      type: action === "accept" ? "offer_accepted" : "offer_declined",
      actorType: "candidate",
      visibility: "candidate",
    })
    .catch((err) => console.error("[offers] decision event failed:", err));

  // On accept, advance the application to "hired" (+ status_change event). Decline
  // leaves the application status to the recruiter (ADR-0008 decision).
  if (action === "accept") {
    const app = await applicationRepo.findByIdScoped(offer.applicationId, session.tenantId);
    // Only advance from a pre-hire status — never regress a terminal (e.g. rejected) application
    // back to "hired" if the offer was accepted out of order.
    if (app && PRE_HIRE.has(app.status)) {
      await applicationRepo.updateStatus(offer.applicationId, "hired");
      eventRepo
        .record({ tenantId: session.tenantId, applicationId: offer.applicationId, type: "status_change", fromStatus: app.status, toStatus: "hired", actorType: "candidate", visibility: "candidate" })
        .catch(() => {});
    }
  }

  // Internal notification to the hiring team (best-effort).
  const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL || "http://localhost:3001";
  const companyName = process.env.NEXT_PUBLIC_COMPANY_NAME || "Our Company";
  emailService
    .sendOfferDecision({
      decision: toStatus,
      candidateFirstName: session.firstName || "Candidate",
      candidateLastName: session.lastName || "",
      jobTitle: offer.application?.job?.title || "the position",
      companyName,
      adminUrl,
      applicationId: offer.applicationId,
      note: cleanNote || undefined,
    })
    .catch((err) => console.error("[offers] decision email failed:", err));

  return NextResponse.json({ success: true, status: toStatus }, { headers: NO_STORE });
}
