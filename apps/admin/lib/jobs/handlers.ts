/*
 * Background Job Handlers — wire up job types to their handlers.
 *
 * Import this from layout.tsx or observability-init to auto-register
 * all background job handlers at app startup.
 *
 * Job types:
 *   - "audit-log"     → flush audit log entries (non-blocking)
 *   - "webhook-retry" → retry failed webhook deliveries
 *   - "cleanup"       → periodic cleanup of expired data
 */

import { jobQueue } from "./queue";
import { prisma } from "@career-builder/database";

/* ================================================================== */
/*  Audit log handler — non-blocking audit log writes                  */
/* ================================================================== */

interface AuditLogPayload {
  action: string;
  entity?: string;
  entityId?: string;
  details?: Record<string, unknown>;
  userId?: string;
  tenantId: string;
}

jobQueue.register<AuditLogPayload>("audit-log", async (payload) => {
  await prisma.auditLog.create({
    data: {
      action: payload.action,
      entity: payload.entity || undefined,
      entityId: payload.entityId || undefined,
      details: payload.details ? JSON.stringify(payload.details) : undefined,
      userId: payload.userId || undefined,
      tenantId: payload.tenantId,
    },
  });
});

/* ================================================================== */
/*  Webhook retry handler — retry failed outgoing webhooks             */
/* ================================================================== */

interface WebhookRetryPayload {
  url: string;
  body: string;
  headers: Record<string, string>;
  webhookId?: string;
}

jobQueue.register<WebhookRetryPayload>("webhook-retry", async (payload) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000); // 10s timeout

  try {
    const res = await fetch(payload.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...payload.headers,
      },
      body: payload.body,
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Webhook delivery failed: ${res.status} ${res.statusText}`);
    }

    console.log(`[jobs] Webhook delivered to ${payload.url} (${res.status})`);
  } finally {
    clearTimeout(timeout);
  }
});

/* ================================================================== */
/*  Cleanup handler — periodic maintenance tasks                       */
/* ================================================================== */

interface CleanupPayload {
  task: "expired-sessions" | "old-audit-logs" | "stale-analytics";
}

jobQueue.register<CleanupPayload>("cleanup", async (payload) => {
  const now = new Date();

  switch (payload.task) {
    case "old-audit-logs": {
      // Delete audit logs older than 90 days
      const cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      const result = await prisma.auditLog.deleteMany({
        where: { createdAt: { lt: cutoff } },
      });
      if (result.count > 0) {
        console.log(`[jobs] Cleaned up ${result.count} old audit log entries`);
      }
      break;
    }

    case "stale-analytics": {
      // Delete analytics events older than 180 days
      const cutoff = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
      try {
        const result = await prisma.analyticsEvent.deleteMany({
          where: { createdAt: { lt: cutoff } },
        });
        if (result.count > 0) {
          console.log(`[jobs] Cleaned up ${result.count} stale analytics events`);
        }
      } catch {
        // analyticsEvent table may not exist yet
      }
      break;
    }

    default:
      console.warn(`[jobs] Unknown cleanup task: ${payload.task}`);
  }
});

/* ================================================================== */
/*  Schedule periodic cleanup (once per day)                           */
/* ================================================================== */

// Schedule daily cleanup — runs 1 hour after startup, then every 24h
const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24h
const CLEANUP_INITIAL_DELAY = 60 * 60 * 1000; // 1h after startup

let cleanupScheduled = false;

export function schedulePeriodicCleanup(): void {
  if (cleanupScheduled) return;
  cleanupScheduled = true;

  setTimeout(() => {
    // Run first cleanup
    jobQueue.enqueue("cleanup", { task: "old-audit-logs" });
    jobQueue.enqueue("cleanup", { task: "stale-analytics" });

    // Then schedule recurring
    const interval = setInterval(() => {
      jobQueue.enqueue("cleanup", { task: "old-audit-logs" });
      jobQueue.enqueue("cleanup", { task: "stale-analytics" });
    }, CLEANUP_INTERVAL);

    if (typeof interval === "object" && interval && "unref" in interval) {
      (interval as NodeJS.Timeout).unref();
    }
  }, CLEANUP_INITIAL_DELAY);
}

export const handlersRegistered = true;
