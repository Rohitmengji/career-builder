/**
 * Self-Healing System — Verification Loop
 *
 * After fixes are applied, this module:
 *   1. Re-runs Playwright audit on affected routes
 *   2. Compares results against the original issues
 *   3. Marks fixes as verified (issue resolved) or failed (issue persists)
 *   4. Auto-rolls back failed fixes
 *   5. Records results in the learning system
 *
 * Max retry attempts: 2 (to prevent infinite loops)
 */

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import type {
  FixSuggestion,
  FixHistoryEntry,
  FixVerification,
} from "./types";
import { restoreLatestBackup } from "./patch-applier";

const ROOT = path.resolve(__dirname, "../..");
const REPORTS_DIR = path.join(ROOT, "ui-audit", "reports");
const HISTORY_PATH = path.join(REPORTS_DIR, "fix-history.json");

const MAX_VERIFY_ATTEMPTS = 2;

function ensureDir(d: string): void {
  fs.mkdirSync(d, { recursive: true });
}

/* ================================================================== */
/*  Playwright Audit Runner                                            */
/* ================================================================== */

/**
 * Re-run the Playwright audit suite.
 * Returns the fresh audit report or null if the audit fails catastrophically.
 */
function runAudit(): any | null {
  console.log("  📸 Re-running Playwright audit...");
  try {
    execSync(
      "npx playwright test --config=playwright.config.ts --project=desktop --project=mobile-se",
      { cwd: ROOT, stdio: "pipe", timeout: 120_000 },
    );
    console.log("  ✅ Audit completed cleanly.");
  } catch {
    console.log("  ⚠️  Audit completed with findings (expected during verification).");
  }

  const reportPath = path.join(REPORTS_DIR, "ui-audit.json");
  if (!fs.existsSync(reportPath)) {
    console.error("  ❌ No audit report generated after re-run.");
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(reportPath, "utf-8"));
  } catch (err) {
    console.error("  ❌ Failed to parse audit report:", err);
    return null;
  }
}

/* ================================================================== */
/*  Verification Logic                                                 */
/* ================================================================== */

export interface VerificationResult {
  verified: FixSuggestion[];
  failed: FixSuggestion[];
  rolledBack: FixSuggestion[];
  history: FixHistoryEntry[];
}

/**
 * Verify applied fixes by re-running the audit and checking if issues persist.
 */
export function verifyFixes(
  fixes: FixSuggestion[],
  attempt: number = 1,
): VerificationResult {
  const result: VerificationResult = {
    verified: [],
    failed: [],
    rolledBack: [],
    history: [],
  };

  const applied = fixes.filter((f) => f.status === "applied");
  if (applied.length === 0) {
    console.log("  ⏭️  No applied fixes to verify.");
    return result;
  }

  console.log(`\n  🔍 Verifying ${applied.length} applied fix(es) (attempt ${attempt}/${MAX_VERIFY_ATTEMPTS})...\n`);

  // Re-run the audit
  const newReport = runAudit();
  if (!newReport) {
    // Cannot verify — mark all as failed and rollback
    for (const fix of applied) {
      fix.status = "failed";
      fix.verification = {
        resolved: false,
        message: "Verification audit failed to produce a report",
        timestamp: new Date().toISOString(),
      };
      result.failed.push(fix);

      // Rollback
      if (restoreLatestBackup(fix.patch.file)) {
        fix.status = "rolled-back";
        result.rolledBack.push(fix);
      }

      result.history.push({
        fixId: fix.id,
        timestamp: new Date().toISOString(),
        action: "rolled-back",
        result: "failure",
        issueType: fix.metadata.issueType,
        file: fix.patch.file,
        confidence: fix.confidence,
        description: `Verification failed (no report) — rolled back`,
      });
    }
    return result;
  }

  // Check each applied fix
  for (const fix of applied) {
    const issueResolved = !issueStillExists(fix, newReport);

    if (issueResolved) {
      fix.status = "verified";
      fix.verification = {
        resolved: true,
        message: "Issue resolved after fix",
        timestamp: new Date().toISOString(),
      };
      result.verified.push(fix);

      result.history.push({
        fixId: fix.id,
        timestamp: new Date().toISOString(),
        action: "verified",
        result: "success",
        issueType: fix.metadata.issueType,
        file: fix.patch.file,
        confidence: fix.confidence,
        description: `Verified: ${fix.description.slice(0, 80)}`,
      });

      console.log(`  ✅ [${fix.id}] Verified — issue resolved`);
    } else {
      fix.status = "failed";
      fix.verification = {
        resolved: false,
        message: `Issue still present after fix (attempt ${attempt})`,
        remainingIssues: countRemainingIssues(fix, newReport),
        timestamp: new Date().toISOString(),
      };
      result.failed.push(fix);

      console.log(`  ❌ [${fix.id}] Failed — issue still present`);

      // Auto-rollback failed fixes
      if (restoreLatestBackup(fix.patch.file)) {
        fix.status = "rolled-back";
        result.rolledBack.push(fix);
        console.log(`  🔄 [${fix.id}] Rolled back`);
      }

      result.history.push({
        fixId: fix.id,
        timestamp: new Date().toISOString(),
        action: "rolled-back",
        result: "failure",
        issueType: fix.metadata.issueType,
        file: fix.patch.file,
        confidence: fix.confidence,
        description: `Failed verification attempt ${attempt} — rolled back`,
      });
    }
  }

  // Persist history
  appendHistory(result.history);

  return result;
}

/* ================================================================== */
/*  Issue Comparison                                                   */
/* ================================================================== */

/**
 * Check if the original issue type still exists in the new report
 * for the same route and device.
 */
function issueStillExists(fix: FixSuggestion, report: any): boolean {
  const issues: any[] = report.issues ?? [];
  const baseType = fix.metadata.issueType.split("-")[0]; // e.g. "overflow" from "overflow-fixed-width"

  return issues.some(
    (i: any) =>
      i.route === fix.metadata.route &&
      i.device === fix.metadata.device &&
      i.type === baseType,
  );
}

/**
 * Count how many issues of the same type remain.
 */
function countRemainingIssues(fix: FixSuggestion, report: any): number {
  const issues: any[] = report.issues ?? [];
  const baseType = fix.metadata.issueType.split("-")[0];

  return issues.filter(
    (i: any) =>
      i.route === fix.metadata.route &&
      i.device === fix.metadata.device &&
      i.type === baseType,
  ).length;
}

/* ================================================================== */
/*  History Persistence                                                */
/* ================================================================== */

function loadHistory(): FixHistoryEntry[] {
  if (!fs.existsSync(HISTORY_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(HISTORY_PATH, "utf-8"));
  } catch {
    return [];
  }
}

function appendHistory(newEntries: FixHistoryEntry[]): void {
  if (newEntries.length === 0) return;
  ensureDir(REPORTS_DIR);
  const existing = loadHistory();
  const merged = [...existing, ...newEntries].slice(-1000);
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(merged, null, 2));
}
