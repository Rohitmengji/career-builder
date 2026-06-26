/*
 * @career-builder/shared/requisition — pure requisition state machine (ADR-0020, B6a).
 *
 * A requisition authorizes a job to be posted: a job may be published only once its
 * requisition is `approved`. The transition table is the single source of truth for
 * the lifecycle; approval is mandatory (no edge reaches `approved` except via
 * `pending_approval`). RBAC (who may drive which action) lives in the API route, NOT
 * here. Mirrors shared/offer.ts. Pure + framework-agnostic, unit-testable, no I/O/PII.
 */

export type RequisitionStatus = "draft" | "pending_approval" | "approved" | "rejected";

export const REQUISITION_STATUSES: readonly RequisitionStatus[] = [
  "draft",
  "pending_approval",
  "approved",
  "rejected",
] as const;

/** Statuses with no outbound transitions. (`approved` is effectively final for the
 *  publish gate; `rejected` can be reworked back to draft.) */
const TERMINAL: ReadonlySet<RequisitionStatus> = new Set<RequisitionStatus>(["approved"]);

/** Adjacency list — the canonical state machine. */
const TRANSITIONS: Record<RequisitionStatus, readonly RequisitionStatus[]> = {
  draft: ["pending_approval"],
  pending_approval: ["approved", "rejected", "draft"], // approve, reject, or send back to edit
  rejected: ["draft"], // rework a rejected req
  approved: [], // final — gates job publish
};

export function isRequisitionStatus(v: unknown): v is RequisitionStatus {
  return typeof v === "string" && (REQUISITION_STATUSES as readonly string[]).includes(v);
}

export function isTerminal(s: RequisitionStatus): boolean {
  return TERMINAL.has(s);
}

export function canTransition(from: RequisitionStatus, to: RequisitionStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextStates(from: RequisitionStatus): readonly RequisitionStatus[] {
  return TRANSITIONS[from] ?? [];
}

/** Recruiter/approver actions and the status each one targets. */
export type RequisitionAction = "submit" | "approve" | "reject" | "reopen";

const ACTION_TARGET: Record<RequisitionAction, RequisitionStatus> = {
  submit: "pending_approval",
  approve: "approved",
  reject: "rejected",
  reopen: "draft",
};

export function targetFor(action: RequisitionAction): RequisitionStatus {
  return ACTION_TARGET[action];
}

/** Whether a job with this requisition status may be published (the publish gate).
 *  Accepts a raw string (the DB stores status as a plain column) — only the exact
 *  "approved" value opens the gate, so any other/unknown value is default-deny. */
export function allowsPublish(status: string | null | undefined): boolean {
  return status === "approved";
}
