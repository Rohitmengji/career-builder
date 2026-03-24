/*
 * Admin app — Observability initialization
 *
 * Wire up database-backed alert persistence and any other app-level
 * observability hooks. This runs once when the module is first imported.
 */

import { alertManager } from "@career-builder/observability/alerts";
import { DatabaseAlertChannel } from "@career-builder/observability/alerts";
import { prisma } from "@career-builder/database";

// Register background job handlers at startup
import { handlersRegistered, schedulePeriodicCleanup } from "./jobs/handlers";
void handlersRegistered; // ensure import is not tree-shaken
schedulePeriodicCleanup();

/* ================================================================== */
/*  Database alert persistence                                         */
/* ================================================================== */

const dbChannel = new DatabaseAlertChannel(async (alert) => {
  await prisma.auditLog.create({
    data: {
      action: `alert:${alert.severity}`,
      entity: "system",
      entityId: alert.id,
      details: JSON.stringify({
        title: alert.title,
        description: alert.description,
        context: alert.context,
        source: alert.source,
      }),
      tenantId: "default",
    },
  });
});

alertManager.addChannel(dbChannel);

export const observabilityInitialized = true;
