/**
 * Self-Healing System — Integration Bridge
 *
 * Connects the self-healing system with:
 *   - @career-builder/observability (error logs, metrics)
 *   - Playwright audit (UI issues, screenshots)
 *   - AI system (validation pipeline)
 *
 * This module provides hooks for existing systems to feed data
 * into the self-healing pipeline automatically.
 */

import * as fs from "fs";
import * as path from "path";
import {
  saveConsoleErrors,
  saveApiFailures,
  saveObservabilityLogs,
} from "./input-collector";
import type { ConsoleError, ApiFailure, ObservabilityLog } from "./types";

const ROOT = path.resolve(__dirname, "../..");
const LOGS_DIR = path.join(ROOT, "ui-audit", "logs");

function ensureDir(d: string): void {
  fs.mkdirSync(d, { recursive: true });
}

/* ================================================================== */
/*  Observability Integration                                          */
/* ================================================================== */

/**
 * Hook into the observability logger to capture error-level logs
 * for the self-healing system.
 *
 * Usage in middleware or API routes:
 *   import { captureObservabilityError } from "@/lib/self-healing/integrations";
 *   logger.error("...", context);
 *   captureObservabilityError({ timestamp, level: "error", event, message, context });
 */
export function captureObservabilityError(log: ObservabilityLog): void {
  try {
    saveObservabilityLogs([log]);
  } catch {
    // Never let self-healing telemetry break the app
  }
}

/**
 * Batch capture of observability logs (e.g., from a request logger flush).
 */
export function captureObservabilityBatch(logs: ObservabilityLog[]): void {
  try {
    const errorLogs = logs.filter((l) => l.level === "error" || l.level === "fatal");
    if (errorLogs.length > 0) {
      saveObservabilityLogs(errorLogs);
    }
  } catch {
    // Silent
  }
}

/* ================================================================== */
/*  Playwright Integration                                             */
/* ================================================================== */

/**
 * Capture console errors during Playwright test runs.
 * Call this from the Playwright test to feed console errors to self-healing.
 *
 * Usage in ui-audit.spec.ts:
 *   import { capturePlaywrightConsoleErrors } from "@/lib/self-healing/integrations";
 *   page.on("console", (msg) => { ... });
 *   capturePlaywrightConsoleErrors(collectedErrors);
 */
export function capturePlaywrightConsoleErrors(errors: Array<{
  level: string;
  message: string;
  url?: string;
  line?: number;
  column?: number;
}>): void {
  try {
    const mapped: ConsoleError[] = errors.map((e) => ({
      timestamp: new Date().toISOString(),
      level: e.level === "error" ? "error" : "warning",
      message: e.message,
      url: e.url,
      line: e.line,
      column: e.column,
    }));
    saveConsoleErrors(mapped);
  } catch {
    // Silent
  }
}

/**
 * Capture API failures during Playwright test runs.
 */
export function capturePlaywrightApiFailures(failures: Array<{
  method: string;
  url: string;
  statusCode: number;
  duration: number;
  error?: string;
}>): void {
  try {
    const mapped: ApiFailure[] = failures.map((f) => ({
      timestamp: new Date().toISOString(),
      method: f.method,
      url: f.url,
      statusCode: f.statusCode,
      duration: f.duration,
      error: f.error,
    }));
    saveApiFailures(mapped);
  } catch {
    // Silent
  }
}

/* ================================================================== */
/*  AI Validation Integration                                          */
/* ================================================================== */

/**
 * Capture AI validation failures for self-healing analysis.
 * These help identify when AI output consistently fails for specific block types.
 */
export function captureAiValidationFailure(failure: {
  blockType: string;
  validationErrors: string[];
  rawOutput?: string;
}): void {
  try {
    ensureDir(LOGS_DIR);
    const logPath = path.join(LOGS_DIR, "ai-validation-failures.json");
    const existing = fs.existsSync(logPath)
      ? JSON.parse(fs.readFileSync(logPath, "utf-8"))
      : [];

    existing.push({
      timestamp: new Date().toISOString(),
      ...failure,
    });

    // Keep last 200 entries
    const trimmed = existing.slice(-200);
    fs.writeFileSync(logPath, JSON.stringify(trimmed, null, 2));
  } catch {
    // Silent
  }
}

/* ================================================================== */
/*  Health Check Endpoint Helper                                       */
/* ================================================================== */

/**
 * Get self-healing system status for the health check API endpoint.
 * Returns a summary suitable for /api/health or /api/observability.
 */
export function getSelfHealingStatus(): {
  active: boolean;
  lastRun?: string;
  issues?: number;
  fixes?: number;
  healthScore?: number;
} {
  try {
    const reportPath = path.join(ROOT, "ui-audit", "reports", "self-healing-report.json");
    if (!fs.existsSync(reportPath)) {
      return { active: true };
    }

    const report = JSON.parse(fs.readFileSync(reportPath, "utf-8"));
    return {
      active: true,
      lastRun: report.timestamp,
      issues: report.summary?.totalIssues,
      fixes: report.summary?.totalFixes,
      healthScore: report.summary ? Math.max(
        0,
        100 - (report.summary.bySeverity?.critical ?? 0) * 25 -
              (report.summary.bySeverity?.major ?? 0) * 10,
      ) : undefined,
    };
  } catch {
    return { active: true };
  }
}
