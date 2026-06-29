/*
 * Admin Offers API (ADR-0008). Tenant-scoped throughout; flag-gated.
 *
 * GET    /api/admin/offers?applicationId=…   — list offers for an application
 * POST   /api/admin/offers                   — create a draft offer
 * PATCH  /api/admin/offers                    — { id, action } lifecycle transition
 *
 * Full approval workflow: draft → submit_for_approval → approve → send → (candidate
 * accepts/declines). approve / request_changes / rescind require APPROVE_ROLES
 * (excludes recruiter — separation of duties). Every transition is an atomic
 * compare-and-swap (offerRepo.transition). `send`/`accept`/`decline` sync the
 * application status + write the matching candidate-visible events; the offer's own
 * offer_* events feed the candidate timeline.
 */

import { NextResponse } from "next/server";
import { getSession, getSessionReadOnly, validateCsrf, writeAuditLog } from "@/lib/auth";
import { applicationRepo, offerRepo, eventRepo, userRepo, notificationRepo, decisionLedgerRepo } from "@career-builder/database";
import { entriesFromRaw, seal as sealLedgerEntries } from "@career-builder/shared/decision-ledger";
import { createOfferSchema, updateOfferSchema, safeParse } from "@career-builder/security/validate";
import { canAccessJob } from "@/lib/hiringTeams";
import { sanitizeString } from "@career-builder/security/sanitize";
import { emailService } from "@career-builder/email";
import { isEnabled } from "@career-builder/shared/feature-flags";
import { canTransition, isReadyForApproval, isExpired, ACTION_TARGET, type OfferStatus, type OfferAction } from "@career-builder/shared/offer";

const WRITE_ROLES = ["super_admin", "admin", "hiring_manager", "recruiter"];
const APPROVE_ROLES = ["super_admin", "admin", "hiring_manager"]; // excludes recruiter
const NO_STORE = { "Cache-Control": "no-store" } as const;
const flagOff = () => !isEnabled("offer_management");

/** Pre-offer application statuses an offer-send may advance to "offer". */
const PRE_OFFER = new Set(["applied", "screening", "interview"]);
/** Application statuses an accepted offer may advance to "hired" (never regress a terminal app). */
const PRE_HIRE = new Set(["applied", "screening", "interview", "offer"]);

const PERIOD_SUFFIX: Record<string, string> = { yearly: "/ yr", monthly: "/ mo", hourly: "/ hr" };

function formatComp(amount: number | null, currency: string, period: string): string {
  if (amount == null) return "—";
  let money: string;
  try {
    money = new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    money = `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(amount)} ${currency}`;
  }
  return `${money} ${PERIOD_SUFFIX[period] || ""}`.trim();
}

function formatDate(d: Date | null): string | undefined {
  if (!d) return undefined;
  try {
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(d);
  } catch {
    return undefined;
  }
}

/* ----------------------------------------------------------------- GET */
export async function GET(req: Request) {
  if (flagOff()) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  const session = await getSessionReadOnly();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  if (session.role === "viewer") return NextResponse.json({ error: "Insufficient permissions" }, { status: 403, headers: NO_STORE });

  const applicationId = new URL(req.url).searchParams.get("applicationId");
  if (!applicationId) return NextResponse.json({ error: "applicationId is required" }, { status: 400, headers: NO_STORE });
  const app = await applicationRepo.findByIdScoped(applicationId, session.tenantId);
  if (!app || !(await canAccessJob(session, app.jobId))) return NextResponse.json({ error: "Application not found" }, { status: 404, headers: NO_STORE });

  const offers = await offerRepo.listForApplication(session.tenantId, applicationId);
  // Tell the UI which actions THIS user may approve (separation of duties).
  return NextResponse.json({ offers, canApprove: APPROVE_ROLES.includes(session.role) }, { headers: NO_STORE });
}

/* ---------------------------------------------------------------- POST */
export async function POST(req: Request) {
  if (flagOff()) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  if (!WRITE_ROLES.includes(session.role)) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403, headers: NO_STORE });
  if (!(await validateCsrf(req))) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403, headers: NO_STORE });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400, headers: NO_STORE }); }
  const parsed = safeParse(createOfferSchema, body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });
  const d = parsed.data;

  const app = await applicationRepo.findByIdScoped(d.applicationId, session.tenantId);
  if (!app || !(await canAccessJob(session, app.jobId))) return NextResponse.json({ error: "Application not found" }, { status: 404, headers: NO_STORE });

  const activeCount = await offerRepo.countActiveForApplication(session.tenantId, d.applicationId);

  const offer = await offerRepo.create({
    tenantId: session.tenantId,
    applicationId: d.applicationId,
    createdById: session.userId, // always the caller — never client-supplied
    jobId: app.job?.id ?? app.jobId ?? null,
    salaryAmount: d.salaryAmount ?? null,
    salaryCurrency: d.salaryCurrency,
    salaryPeriod: d.salaryPeriod,
    startDate: d.startDate ? new Date(d.startDate) : null,
    expiresAt: d.expiresAt ? new Date(d.expiresAt) : null,
    terms: d.terms ? sanitizeString(d.terms, 10_000) : null,
    notes: d.notes ? sanitizeString(d.notes, 5000) : null,
  });

  await writeAuditLog(session.userId, session.email, "offer_created", `application ${d.applicationId.slice(-6)} (draft)`);
  // Soft-warn (not a block) if another active offer already exists for this application.
  return NextResponse.json({ offer, warning: activeCount > 0 ? "An active offer already exists for this application." : undefined }, { status: 201, headers: NO_STORE });
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
  const parsed = safeParse(updateOfferSchema, body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });
  const { id, action } = parsed.data as { id: string; action: OfferAction };

  // Separation of duties: approving / bouncing / rescinding is manager+ only.
  if (["approve", "request_changes", "rescind"].includes(action) && !APPROVE_ROLES.includes(session.role)) {
    return NextResponse.json({ error: "Only a hiring manager or admin can do that." }, { status: 403, headers: NO_STORE });
  }

  const offer = await offerRepo.findByIdScoped(id, session.tenantId);
  if (!offer) return NextResponse.json({ error: "Offer not found" }, { status: 404, headers: NO_STORE });
  // Hiring-team scope (ADR-0020): driving an offer requires access to its application's job.
  const offerApp = await applicationRepo.findByIdScoped(offer.applicationId, session.tenantId);
  if (!offerApp || !(await canAccessJob(session, offerApp.jobId))) return NextResponse.json({ error: "Offer not found" }, { status: 404, headers: NO_STORE });

  const from = offer.status as OfferStatus;
  const target = ACTION_TARGET[action];
  if (!canTransition(from, target)) {
    return NextResponse.json({ error: `Cannot ${action.replace(/_/g, " ")} an offer that is ${from.replace(/_/g, " ")}.` }, { status: 409, headers: NO_STORE });
  }

  // Comp must be valid before it can leave draft / be approved.
  if ((action === "submit_for_approval" || action === "approve") && !isReadyForApproval(offer)) {
    return NextResponse.json({ error: "Add a valid salary amount, currency, and period before approval." }, { status: 400, headers: NO_STORE });
  }

  const now = new Date();
  // An expired (but un-swept, still-"sent") offer must not be acceptable/declinable via the
  // admin path either — mirror the candidate CAS guard (the DB row stays "sent" until a sweep).
  if ((action === "accept" || action === "decline") && isExpired({ status: from, expiresAt: offer.expiresAt }, now)) {
    return NextResponse.json({ error: "This offer has expired." }, { status: 409, headers: NO_STORE });
  }

  const extra: Record<string, unknown> = { status: target };
  if (action === "approve") { extra.approverId = session.userId; extra.approvedAt = now; }
  if (action === "send") { extra.sentAt = now; }
  if (action === "accept" || action === "decline") { extra.respondedAt = now; }

  const count = await offerRepo.transition(id, session.tenantId, from, extra);
  if (count === 0) {
    return NextResponse.json({ error: "This offer just changed — please reload." }, { status: 409, headers: NO_STORE });
  }

  await writeAuditLog(session.userId, session.email, `offer_${action}`, `offer ${id.slice(-6)}: ${from} → ${target}`);

  // --- Candidate-visible offer events + application-status sync ---
  const recordEvent = (type: string, visibility: "candidate" | "internal", metadata?: Record<string, unknown>) =>
    eventRepo
      .record({ tenantId: session.tenantId, applicationId: offer.applicationId, type, actorId: session.userId, actorType: "recruiter", visibility, metadata })
      .catch((err) => console.error("[offers] event failed:", err));

  // Advance the application + record a candidate-visible status_change (timeline + responsiveness).
  // The advance is an ATOMIC, status-guarded CAS (only from `fromSet`) so a concurrent
  // candidate withdrawal can't be silently clobbered by a stale-snapshot write (ADR-0035).
  // If the app already left the valid source state (count 0), skip the sync/event/seal.
  const syncApplicationStatus = async (fromSet: Set<string>, snapshotFrom: string, toStatus: string) => {
    const advanced = await applicationRepo.advanceStatusIfIn(offer.applicationId, session.tenantId, [...fromSet], toStatus);
    if (advanced === 0) return;
    await writeAuditLog(session.userId, session.email, "application_status_change", `application ${offer.applicationId.slice(-6)}: ${snapshotFrom} → ${toStatus}`);
    const evRecorded = eventRepo
      .record({ tenantId: session.tenantId, applicationId: offer.applicationId, type: "status_change", fromStatus: snapshotFrom, toStatus, actorId: session.userId, actorType: "recruiter", visibility: "candidate" })
      .catch(() => {});
    // Decision Ledger (ADR-0027): seal terminal decisions reached via the offer flow
    // (accept → hired), mirroring the applications PATCH. Await the event first.
    if (isEnabled("decision_ledger") && (toStatus === "hired" || toStatus === "rejected")) {
      try {
        await evRecorded;
        const raw = await decisionLedgerRepo.buildInput(session.tenantId, offer.applicationId);
        const digest = sealLedgerEntries(entriesFromRaw(raw));
        await decisionLedgerRepo.storeSeal(session.tenantId, offer.applicationId, digest, new Date().toISOString());
      } catch (err) { console.error("[offers] decision-ledger seal failed:", err); }
    }
  };

  if (action === "send") {
    void recordEvent("offer_extended", "candidate", { salaryPeriod: offer.salaryPeriod });
    if (offer.application) {
      await syncApplicationStatus(PRE_OFFER, offer.application.status, "offer");
    }
    // Email the candidate (best-effort).
    if (offer.application) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_WEB_URL || "http://localhost:3000";
      const companyName = process.env.NEXT_PUBLIC_COMPANY_NAME || "Our Company";
      emailService
        .sendOfferExtended({
          candidateFirstName: offer.application.firstName,
          candidateEmail: offer.application.email,
          jobTitle: offer.application.job?.title || "the position",
          companyName,
          siteUrl,
          compText: formatComp(offer.salaryAmount, offer.salaryCurrency, offer.salaryPeriod),
          startText: formatDate(offer.startDate),
          expiresText: offer.expiresAt ? `Respond by ${formatDate(offer.expiresAt)}` : undefined,
          terms: offer.terms || undefined,
        })
        .catch((err) => console.error("[offers] offer email failed:", err));
    }
  } else if (action === "accept") {
    void recordEvent("offer_accepted", "candidate");
    // Only advance from a pre-hire status — never regress a terminal (rejected/hired/
    // withdrawn) application. Atomic CAS guards against a concurrent transition.
    if (offer.application) {
      await syncApplicationStatus(PRE_HIRE, offer.application.status, "hired");
    }
  } else if (action === "decline") {
    // Decline does NOT auto-reject the application — recruiter triages (ADR-0008 decision).
    void recordEvent("offer_declined", "candidate");
  } else if (action === "rescind") {
    void recordEvent("offer_rescinded", "candidate");
  } else if (action === "submit_for_approval") {
    // Notify the tenant's approvers (manager+) that an offer needs sign-off.
    // No candidate identity in the body — respects Blind Hiring (recruiter surface).
    try {
      const members = await userRepo.findByTenant(session.tenantId);
      const approvers = members.filter((u) => APPROVE_ROLES.includes(u.role) && u.id !== session.userId);
      if (approvers.length > 0) {
        await notificationRepo.createMany(
          approvers.map((u) => ({
            tenantId: session.tenantId,
            recipientType: "user" as const,
            recipientId: u.id,
            type: "offer_approval_needed",
            title: "Offer needs approval",
            body: `An offer for ${offer.application?.job?.title ?? "a role"} is awaiting your approval.`,
            link: "/applications",
            applicationId: offer.applicationId,
          })),
        );
      }
    } catch (err) {
      console.error("[offers] approval notification failed:", err);
    }
  }
  // approve / request_changes are internal — audit only.

  return NextResponse.json({ success: true, status: target }, { headers: NO_STORE });
}
