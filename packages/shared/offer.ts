/*
 * @career-builder/shared/offer — pure offer state-machine + helpers (ADR-0008).
 *
 * The transition table is the single source of truth for the offer lifecycle.
 * Approval is mandatory: no edge reaches `sent` without first passing `approved`,
 * so "send without approval" is structurally unrepresentable. RBAC (who may drive
 * which action) lives in the API route, NOT here. Pure + framework-agnostic so the
 * rules are unit-testable and shared by both apps. No DB, no I/O, no PII.
 */

export type OfferStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "sent"
  | "accepted"
  | "declined"
  | "expired"
  | "rescinded";

export const OFFER_STATUSES: readonly OfferStatus[] = [
  "draft",
  "pending_approval",
  "approved",
  "sent",
  "accepted",
  "declined",
  "expired",
  "rescinded",
] as const;

/** Statuses with no outbound transitions. */
const TERMINAL: ReadonlySet<OfferStatus> = new Set<OfferStatus>([
  "accepted",
  "declined",
  "expired",
  "rescinded",
]);

/** Adjacency list — the canonical state machine. */
const TRANSITIONS: Record<OfferStatus, readonly OfferStatus[]> = {
  draft: ["pending_approval", "rescinded"],
  pending_approval: ["approved", "draft", "rescinded"], // approve, send-back, or kill
  approved: ["sent", "draft", "rescinded"], // send, pull-back-to-edit, or kill
  sent: ["accepted", "declined", "expired", "rescinded"],
  accepted: [],
  declined: [],
  expired: [],
  rescinded: [],
};

export function isOfferStatus(v: unknown): v is OfferStatus {
  return typeof v === "string" && (OFFER_STATUSES as readonly string[]).includes(v);
}

export function isTerminal(s: OfferStatus): boolean {
  return TERMINAL.has(s);
}

export function canTransition(from: OfferStatus, to: OfferStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextStates(from: OfferStatus): readonly OfferStatus[] {
  return TRANSITIONS[from] ?? [];
}

/** Recruiter/candidate-driven actions and the status each one targets. */
export type OfferAction =
  | "submit_for_approval"
  | "approve"
  | "request_changes"
  | "send"
  | "accept"
  | "decline"
  | "expire"
  | "rescind";

export const ACTION_TARGET: Record<OfferAction, OfferStatus> = {
  submit_for_approval: "pending_approval",
  request_changes: "draft",
  approve: "approved",
  send: "sent",
  accept: "accepted",
  decline: "declined",
  expire: "expired",
  rescind: "rescinded",
};

export const MONEY_PERIODS = ["yearly", "monthly", "hourly"] as const;
export type MoneyPeriod = (typeof MONEY_PERIODS)[number];

export interface OfferLike {
  status: OfferStatus | string;
  expiresAt: Date | string | null;
}

/**
 * True only for a SENT offer whose deadline has STRICTLY passed. An offer is still
 * acceptable AT the exact `expiresAt` instant (favor the candidate). A null
 * `expiresAt` never expires; any non-`sent` status is never "expired" by time.
 */
export function isExpired(offer: OfferLike, now: Date): boolean {
  if (offer.status !== "sent" || offer.expiresAt == null) return false;
  const exp = offer.expiresAt instanceof Date ? offer.expiresAt : new Date(offer.expiresAt);
  if (Number.isNaN(exp.getTime())) return false;
  return now.getTime() > exp.getTime();
}

/** Display status: collapses an un-swept past-expiry `sent` offer to `expired`. */
export function effectiveStatus(offer: OfferLike, now: Date): OfferStatus {
  if (isExpired(offer, now)) return "expired";
  return (isOfferStatus(offer.status) ? offer.status : "draft") as OfferStatus;
}

/** Compensation must be present + valid before an offer can be submitted/approved/sent. */
export function isReadyForApproval(o: {
  salaryAmount: number | null;
  salaryCurrency: string;
  salaryPeriod: string;
}): boolean {
  return (
    typeof o.salaryAmount === "number" &&
    Number.isFinite(o.salaryAmount) &&
    o.salaryAmount > 0 &&
    /^[A-Z]{3}$/.test(o.salaryCurrency) &&
    (MONEY_PERIODS as readonly string[]).includes(o.salaryPeriod)
  );
}

const STATUS_LABELS: Record<OfferStatus, string> = {
  draft: "Draft",
  pending_approval: "Pending approval",
  approved: "Approved",
  sent: "Sent",
  accepted: "Accepted",
  declined: "Declined",
  expired: "Expired",
  rescinded: "Rescinded",
};

export function offerStatusLabel(s: OfferStatus): string {
  return STATUS_LABELS[s] ?? s;
}
