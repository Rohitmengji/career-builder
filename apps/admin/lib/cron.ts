/*
 * Cron auth guard (ADR-0021). Vercel Cron sends `Authorization: Bearer $CRON_SECRET`
 * when the CRON_SECRET env var is set. We verify it with a length check + a
 * constant-time compare so a scheduled job can run but nothing else can.
 */

import { timingSafeEqual } from "crypto";

/** True only for a request bearing the configured CRON_SECRET. Denies if unset. */
export function assertCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // not configured → deny (fail closed)
  const provided = req.headers.get("authorization") || "";
  const expected = `Bearer ${secret}`;
  // timingSafeEqual throws on length mismatch — guard first (length isn't secret).
  if (provided.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  } catch {
    return false;
  }
}
