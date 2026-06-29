/*
 * @career-builder/shared/ghosting-risk — proactive "don't ghost" nudge.
 *
 * The Trust Layer already MEASURES ghosting after the fact (the public responsiveness
 * badge ADR-0003, the cross-tenant trust index ADR-0029). This closes the loop: it
 * flags the applications a recruiter is ABOUT to ghost — still awaiting a first response
 * and approaching (or past) the same SLA the badge judges them by — so they can act
 * BEFORE the promise is broken. Operationalizes the "we don't ghost" wedge.
 *
 * Uses the EXACT responsiveness definitions (apples-to-apples with the badge): an
 * application "awaiting response" is still in the initial "applied" state; once a human
 * moves it on (screening/interview/offer/hired/rejected) the candidate has been answered.
 * Pure + deterministic; `now` is passed in (no clock) so it is unit-testable.
 */

import { GHOST_SLA_DAYS } from "./responsiveness";

/** Within this many days of the SLA, a still-unanswered application is "at risk". */
export const GHOST_WARN_DAYS = 4;

const DAY_MS = 24 * 60 * 60 * 1000;

export type GhostingRisk = "ok" | "at_risk" | "overdue";

export interface PendingApplicationDatum {
  id: string;
  status: string;
  submittedAt: Date | string | number;
}

export interface GhostingRiskItem {
  id: string;
  risk: GhostingRisk;
  /** Whole days since the application was submitted. */
  daysWaiting: number;
  /** Days until the SLA breaches (0 or negative once overdue). */
  daysUntilSla: number;
}

export interface GhostingRiskSummary {
  /** Still-unanswered applications within GHOST_WARN_DAYS of the SLA. */
  atRisk: number;
  /** Still-unanswered applications already past the SLA (ghosted unless actioned now). */
  overdue: number;
  /** Only the actionable (at_risk + overdue) items, most-overdue first. */
  items: GhostingRiskItem[];
}

function toMs(d: Date | string | number): number {
  if (d instanceof Date) return d.getTime();
  if (typeof d === "number") return d;
  const t = Date.parse(d);
  return Number.isNaN(t) ? NaN : t;
}

/** Classify one application's ghosting risk. Answered (status past "applied") → ok. */
export function classifyGhostingRisk(status: string, daysWaiting: number): GhostingRisk {
  if (status !== "applied") return "ok"; // a human already responded
  if (daysWaiting >= GHOST_SLA_DAYS) return "overdue";
  if (daysWaiting >= GHOST_SLA_DAYS - GHOST_WARN_DAYS) return "at_risk";
  return "ok"; // still pending but plenty of time
}

/**
 * Compute the actionable ghosting-risk list + counts from pending applications.
 * `now` is supplied by the caller. Items are sorted most-overdue (longest-waiting) first.
 */
export function computeGhostingRisk(apps: PendingApplicationDatum[], now: Date): GhostingRiskSummary {
  const nowMs = now.getTime();
  const items: GhostingRiskItem[] = [];
  for (const a of apps) {
    const submittedMs = toMs(a.submittedAt);
    if (Number.isNaN(submittedMs)) continue; // unparseable date → skip (fail-safe)
    const daysWaiting = Math.floor((nowMs - submittedMs) / DAY_MS);
    const risk = classifyGhostingRisk(a.status, daysWaiting);
    if (risk === "ok") continue;
    items.push({ id: a.id, risk, daysWaiting, daysUntilSla: GHOST_SLA_DAYS - daysWaiting });
  }
  items.sort((x, y) => y.daysWaiting - x.daysWaiting);
  return {
    atRisk: items.filter((i) => i.risk === "at_risk").length,
    overdue: items.filter((i) => i.risk === "overdue").length,
    items,
  };
}
