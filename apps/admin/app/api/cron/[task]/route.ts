/*
 * Cron dispatcher (ADR-0021). One secret-guarded entrypoint for all scheduled work.
 *
 * GET /api/cron/[task] — runs the named task if the CRON_SECRET bearer is valid.
 *
 * A per-task KV mutex prevents a duplicate/overlapping invocation from double-running;
 * tasks are ALSO required to be DB-state-authoritative + idempotent, so the mutex is a
 * fast-path optimization, not the correctness boundary. Real tasks (retention-sweep,
 * offer-expiry, interview-reminders) register themselves here in their owning slices.
 */

import path from "path";
import { NextResponse } from "next/server";
import { assertCron } from "@/lib/cron";
import { getKV } from "@career-builder/shared/kv";
import { tenantRepo, dataRightsRepo } from "@career-builder/database";
import { parseRetention, cutoffFor } from "@career-builder/shared/retention";
import { createStorage } from "@career-builder/shared/storage";

const NO_STORE = { "Cache-Control": "no-store" } as const;
const LOCK_TTL_SECONDS = 290; // under Vercel's max function duration; auto-frees a crashed task

type CronTask = (now: Date) => Promise<{ processed: number; [k: string]: unknown }>;

/**
 * Data-retention sweep (ADR-0011, A3): per tenant with retention enabled, anonymize
 * TERMINAL applications past their window (reusing the §17 anonymizer) + best-effort
 * delete the résumé blobs. No-op for tenants that haven't opted in (default off).
 */
const retentionSweep: CronTask = async (now) => {
  const tenants = await tenantRepo.findAll();
  let processed = 0;
  for (const t of tenants) {
    // Isolate per-tenant failures — one tenant's DB error must NOT abort the sweep
    // for every other (alphabetically later) tenant.
    try {
      const policy = parseRetention((t as { settings?: unknown }).settings);
      if (!policy.enabled) continue;
      const { anonymized, resumeKeys } = await dataRightsRepo.retentionSweepForTenant(
        t.id,
        { rejectedBefore: cutoffFor("rejected", policy, now), hiredBefore: cutoffFor("hired", policy, now) },
        now,
      );
      processed += anonymized;
      if (resumeKeys.length > 0) {
        const storage = createStorage({ localDir: path.join(process.cwd(), "data", "resumes"), localPublicPrefix: "/data/resumes", keyPrefix: "resumes", tenantId: t.id });
        await Promise.allSettled(resumeKeys.map((k) => storage.delete(k)));
      }
    } catch (err) {
      console.error(`[cron:retention-sweep] tenant ${t.id} failed (continuing):`, err);
    }
  }
  return { processed };
};

/** Task registry. Slices add their task here (e.g. "offer-expiry": expireOffers). */
const TASKS: Record<string, CronTask> = {
  // Trivial liveness task — proves the cron wiring end-to-end.
  health: async () => ({ processed: 0, ok: true }),
  "retention-sweep": retentionSweep,
};

export async function GET(req: Request, { params }: { params: Promise<{ task: string }> }) {
  if (!assertCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  }

  const { task } = await params;
  const fn = TASKS[task];
  if (!fn) {
    return NextResponse.json({ error: "Unknown task" }, { status: 404, headers: NO_STORE });
  }

  const now = new Date();

  // Mutex: only one invocation of a task runs at a time. incr returns the new count;
  // >1 means another invocation holds the lock → skip. Fail-open (KV down → run anyway,
  // since tasks are idempotent).
  const lockKey = `cron:${task}:lock`;
  const holders = await getKV().incr(lockKey, LOCK_TTL_SECONDS).catch(() => 1);
  if (holders > 1) {
    return NextResponse.json({ task, skipped: true, reason: "already running" }, { headers: NO_STORE });
  }

  try {
    const result = await fn(now);
    return NextResponse.json({ task, ...result }, { headers: NO_STORE });
  } catch (err) {
    console.error(`[cron:${task}] failed:`, err);
    return NextResponse.json({ task, error: "Task failed" }, { status: 500, headers: NO_STORE });
  } finally {
    // Release so the NEXT scheduled run isn't blocked by the TTL.
    await getKV().del(lockKey).catch(() => {});
  }
}
