/*
 * @career-builder/shared/retention — pure data-retention policy logic (ADR-0011, A3).
 *
 * A tenant may auto-purge stale TERMINAL applications after a configurable window
 * (GDPR storage-limitation). Retention duration is a controller decision, so it's
 * per-tenant (stored in Tenant.settings.retention JSON) with conservative defaults
 * and OFF by default. The actual "forget" is the same anonymize-in-place engine as
 * §17 erasure (dataRightsRepo). Pure + framework-agnostic; unit-tested like offer.ts.
 */

export interface RetentionPolicy {
  enabled: boolean;
  /** Days after a rejection before the application is anonymized. */
  rejectedDays: number;
  /** Days after hire before the application is anonymized (usually longer). */
  hiredDays: number;
}

/** Conservative defaults — OFF, ~1yr rejected / ~7yr hired (EEOC-friendly minimums). */
export const DEFAULT_RETENTION: RetentionPolicy = { enabled: false, rejectedDays: 365, hiredDays: 2555 };

const MAX_DAYS = 36_500; // 100yr cap — guards against absurd config

function clampDays(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.min(MAX_DAYS, Math.floor(n));
}

/** Parse a tenant's retention config (JSON string or object) → a normalized policy. Never throws. */
export function parseRetention(raw: unknown): RetentionPolicy {
  let value = raw;
  if (typeof raw === "string") {
    try { value = JSON.parse(raw); } catch { return { ...DEFAULT_RETENTION }; }
  }
  // Allow the config to live under settings.retention or be the object itself.
  const r = (value && typeof value === "object" ? (value as Record<string, unknown>) : {}) as Record<string, unknown>;
  const node = (r.retention && typeof r.retention === "object" ? (r.retention as Record<string, unknown>) : r) as Record<string, unknown>;
  return {
    enabled: node.enabled === true,
    rejectedDays: clampDays(node.rejectedDays, DEFAULT_RETENTION.rejectedDays),
    hiredDays: clampDays(node.hiredDays, DEFAULT_RETENTION.hiredDays),
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The instant before which a TERMINAL application of `status` is due for purge,
 * or null when retention doesn't apply (disabled, or a non-terminal status).
 */
export function cutoffFor(status: string, policy: RetentionPolicy, now: Date): Date | null {
  if (!policy.enabled) return null;
  if (status === "rejected") return new Date(now.getTime() - policy.rejectedDays * DAY_MS);
  if (status === "hired") return new Date(now.getTime() - policy.hiredDays * DAY_MS);
  return null; // only terminal statuses are ever purged
}

/**
 * True when an application decided at `decidedAt` is due for purge. Boundary: due
 * STRICTLY after the window (decidedAt < cutoff), so an app exactly at the edge is
 * kept one more tick.
 */
export function isDueForPurge(decidedAt: Date, status: string, policy: RetentionPolicy, now: Date): boolean {
  const cutoff = cutoffFor(status, policy, now);
  if (!cutoff) return false;
  return decidedAt.getTime() < cutoff.getTime();
}
