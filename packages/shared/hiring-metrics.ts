/*
 * @career-builder/shared/hiring-metrics — pure hiring-velocity metrics (ADR-0017).
 *
 * Computed from the ApplicationEvent spine (status_change events, ADR-0005) anchored
 * at each application's submittedAt ("applied"). Medians (robust to outliers) for
 * time-to-first-response, time-to-hire, and time-to-decision, with sample sizes so
 * the UI can suppress thin data. Pure + framework-agnostic; the repo provides the
 * per-application timelines.
 */

export interface AppTimeline {
  submittedAt: Date | string;
  /** status_change events for this application, any order. */
  events: { toStatus: string; at: Date | string }[];
}

export interface HiringMetrics {
  /** Median days from apply to the first status change (recruiter first acted). */
  timeToFirstResponseDays: number | null;
  /** Median days from apply to "hired". */
  timeToHireDays: number | null;
  /** Median days from apply to a terminal decision (hired OR rejected). */
  timeToDecisionDays: number | null;
  /** Sample sizes behind each median (for thin-data suppression). */
  samples: { firstResponse: number; hire: number; decision: number };
  /** Total applications considered. */
  total: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const TERMINAL = new Set(["hired", "rejected"]);

function ms(d: Date | string): number {
  return (d instanceof Date ? d : new Date(d)).getTime();
}

/** Median of a numeric array (null if empty). Rounded to 1 decimal. */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  const m = s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  return Math.round((m + Number.EPSILON) * 10) / 10;
}

export function computeHiringMetrics(apps: AppTimeline[]): HiringMetrics {
  const firstResponse: number[] = [];
  const hire: number[] = [];
  const decision: number[] = [];

  for (const app of apps) {
    const start = ms(app.submittedAt);
    if (!Number.isFinite(start)) continue;
    const evs = app.events
      .map((e) => ({ toStatus: e.toStatus, at: ms(e.at) }))
      .filter((e) => Number.isFinite(e.at) && e.at >= start) // ignore clock-skew/pre-apply noise
      .sort((a, b) => a.at - b.at);
    if (evs.length === 0) continue;

    // First recruiter action (any status change after apply).
    firstResponse.push((evs[0].at - start) / DAY_MS);

    const hired = evs.find((e) => e.toStatus === "hired");
    if (hired) hire.push((hired.at - start) / DAY_MS);

    const term = evs.find((e) => TERMINAL.has(e.toStatus));
    if (term) decision.push((term.at - start) / DAY_MS);
  }

  return {
    timeToFirstResponseDays: median(firstResponse),
    timeToHireDays: median(hire),
    timeToDecisionDays: median(decision),
    samples: { firstResponse: firstResponse.length, hire: hire.length, decision: decision.length },
    total: apps.length,
  };
}
