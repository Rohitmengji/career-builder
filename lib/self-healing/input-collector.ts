/**
 * Self-Healing System — Input Collector
 *
 * Aggregates data from all input sources into a unified DetectionContext.
 * Sources: Playwright reports, DOM snapshots, console errors, API logs, observability.
 *
 * This is the first stage of the self-healing pipeline.
 */

import * as fs from "fs";
import * as path from "path";
import type {
  DetectionContext,
  ConsoleError,
  ApiFailure,
  ObservabilityLog,
} from "./types";

const ROOT = path.resolve(__dirname, "../..");
const REPORTS_DIR = path.join(ROOT, "ui-audit", "reports");
const SNAPSHOTS_DIR = path.join(ROOT, "ui-audit", "snapshots");
const SCREENSHOTS_DIR = path.join(ROOT, "ui-audit", "screenshots");
const LOGS_DIR = path.join(ROOT, "ui-audit", "logs");

/**
 * Collect all available input sources into a DetectionContext.
 * Gracefully handles missing sources — never throws on missing data.
 */
export function collectInputSources(): DetectionContext {
  const context: DetectionContext = {
    snapshotsDir: SNAPSHOTS_DIR,
    screenshotsDir: SCREENSHOTS_DIR,
  };

  // 1. Playwright audit report
  const auditPath = path.join(REPORTS_DIR, "ui-audit.json");
  if (fs.existsSync(auditPath)) {
    try {
      context.auditReport = JSON.parse(fs.readFileSync(auditPath, "utf-8"));
    } catch (err) {
      console.error("[self-healing] Failed to parse audit report:", err);
    }
  } else {
    console.warn("[self-healing] No audit report found at", auditPath);
  }

  // 2. Console errors (collected during Playwright runs)
  context.consoleErrors = loadJsonSafe<ConsoleError[]>(
    path.join(LOGS_DIR, "console-errors.json"),
    [],
  );

  // 3. API failures
  context.apiFailures = loadJsonSafe<ApiFailure[]>(
    path.join(LOGS_DIR, "api-failures.json"),
    [],
  );

  // 4. Observability logs (recent errors from the logger)
  context.observabilityLogs = loadJsonSafe<ObservabilityLog[]>(
    path.join(LOGS_DIR, "observability-errors.json"),
    [],
  );

  return context;
}

/**
 * List available input sources for reporting.
 */
export function listAvailableSources(): string[] {
  const sources: string[] = [];

  if (fs.existsSync(path.join(REPORTS_DIR, "ui-audit.json"))) {
    sources.push("playwright-audit");
  }
  if (fs.existsSync(path.join(REPORTS_DIR, "playwright-results.json"))) {
    sources.push("playwright-results");
  }
  if (fs.existsSync(SNAPSHOTS_DIR) && fs.readdirSync(SNAPSHOTS_DIR).length > 0) {
    sources.push("dom-snapshots");
  }
  if (fs.existsSync(SCREENSHOTS_DIR) && fs.readdirSync(SCREENSHOTS_DIR).length > 0) {
    sources.push("screenshots");
  }
  if (fs.existsSync(path.join(LOGS_DIR, "console-errors.json"))) {
    sources.push("console-errors");
  }
  if (fs.existsSync(path.join(LOGS_DIR, "api-failures.json"))) {
    sources.push("api-failures");
  }
  if (fs.existsSync(path.join(LOGS_DIR, "observability-errors.json"))) {
    sources.push("observability-logs");
  }

  return sources;
}

/**
 * Save console errors collected during a test run.
 */
export function saveConsoleErrors(errors: ConsoleError[]): void {
  ensureDir(LOGS_DIR);
  const existing = loadJsonSafe<ConsoleError[]>(
    path.join(LOGS_DIR, "console-errors.json"),
    [],
  );
  // Append new errors, keep last 500
  const merged = [...existing, ...errors].slice(-500);
  fs.writeFileSync(
    path.join(LOGS_DIR, "console-errors.json"),
    JSON.stringify(merged, null, 2),
  );
}

/**
 * Save API failures collected during a test run.
 */
export function saveApiFailures(failures: ApiFailure[]): void {
  ensureDir(LOGS_DIR);
  const existing = loadJsonSafe<ApiFailure[]>(
    path.join(LOGS_DIR, "api-failures.json"),
    [],
  );
  const merged = [...existing, ...failures].slice(-500);
  fs.writeFileSync(
    path.join(LOGS_DIR, "api-failures.json"),
    JSON.stringify(merged, null, 2),
  );
}

/**
 * Save observability error logs.
 */
export function saveObservabilityLogs(logs: ObservabilityLog[]): void {
  ensureDir(LOGS_DIR);
  const existing = loadJsonSafe<ObservabilityLog[]>(
    path.join(LOGS_DIR, "observability-errors.json"),
    [],
  );
  const merged = [...existing, ...logs].slice(-1000);
  fs.writeFileSync(
    path.join(LOGS_DIR, "observability-errors.json"),
    JSON.stringify(merged, null, 2),
  );
}

/* ================================================================== */
/*  Helpers                                                            */
/* ================================================================== */

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function loadJsonSafe<T>(filePath: string, fallback: T): T {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
  } catch (err) {
    console.error(`[self-healing] Failed to parse ${filePath}:`, err);
    return fallback;
  }
}
