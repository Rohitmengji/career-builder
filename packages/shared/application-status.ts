/*
 * @career-builder/shared/application-status — candidate-facing status helpers.
 *
 * A candidate may WITHDRAW an application only while it is still in play and BEFORE an
 * offer is on the table — once an offer exists they use accept/decline (ADR-0008), and a
 * terminal application (hired/rejected/withdrawn) can't be withdrawn. "withdrawn" is a
 * candidate-initiated terminal status; the responsiveness (ADR-0003) + ghosting (ADR-0033)
 * engines correctly treat it as neither responded nor ghosted (the candidate left of their
 * own accord). Pure constants/helpers — no DB.
 */

/** Statuses from which a candidate may withdraw their own application. */
export const WITHDRAWABLE_STATUSES = ["applied", "screening", "interview"] as const;

/** True when a candidate may withdraw an application currently in `status`. */
export function isWithdrawable(status: string): boolean {
  return (WITHDRAWABLE_STATUSES as readonly string[]).includes(status);
}

/**
 * Statuses a recruiter must NOT mutate via the admin status controls. "withdrawn" is a
 * candidate-OWNED terminal decision — reversing it would silently undo the candidate's
 * choice and (for hired/rejected) fire a status email + seal a Decision Ledger over a
 * sequence the candidate never consented to re-enter. (hired/rejected remain
 * recruiter-editable as before — only the new candidate-owned status is locked.)
 */
export const RECRUITER_LOCKED_STATUSES = ["withdrawn"] as const;

/** True when a recruiter status/stage change must be refused for an app in `status`. */
export function isRecruiterLocked(status: string): boolean {
  return (RECRUITER_LOCKED_STATUSES as readonly string[]).includes(status);
}
