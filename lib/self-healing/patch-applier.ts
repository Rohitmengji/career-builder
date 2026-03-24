/**
 * Self-Healing System — Patch Generator & Safe Apply
 *
 * Generates minimal diffs, applies patches safely with backups,
 * and provides rollback capabilities.
 *
 * Safety guarantees:
 *   - Every file is backed up before modification
 *   - Only first occurrence of search string is replaced
 *   - Auto-apply requires confidence >= 80 + search/replace pattern
 *   - Rollback restores from latest backup
 *   - Never auto-commits — changes stay as uncommitted diffs
 */

import * as fs from "fs";
import * as path from "path";
import type { FixSuggestion, FixHistoryEntry, FixMode } from "./types";

const ROOT = path.resolve(__dirname, "../..");
const BACKUPS_DIR = path.join(ROOT, "ui-audit", "backups");
const PATCHES_DIR = path.join(ROOT, "ui-audit", "patches");
const REPORTS_DIR = path.join(ROOT, "ui-audit", "reports");
const HISTORY_PATH = path.join(REPORTS_DIR, "fix-history.json");

/** Minimum confidence to auto-apply a fix */
const AUTO_APPLY_THRESHOLD = 80;

function ensureDir(d: string): void {
  fs.mkdirSync(d, { recursive: true });
}

/* ================================================================== */
/*  Backup & Restore                                                   */
/* ================================================================== */

/**
 * Create a timestamped backup of a file before patching.
 */
export function backupFile(filePath: string): string {
  ensureDir(BACKUPS_DIR);
  const abs = path.resolve(ROOT, filePath);
  if (!fs.existsSync(abs)) {
    throw new Error(`File not found: ${abs}`);
  }
  const backupName = filePath.replace(/\//g, "__") + `.${Date.now()}.bak`;
  const backupPath = path.join(BACKUPS_DIR, backupName);
  fs.copyFileSync(abs, backupPath);
  return backupPath;
}

/**
 * Restore the latest backup for a given file.
 */
export function restoreLatestBackup(filePath: string): boolean {
  const prefix = filePath.replace(/\//g, "__") + ".";
  if (!fs.existsSync(BACKUPS_DIR)) return false;

  const backups = fs
    .readdirSync(BACKUPS_DIR)
    .filter((f) => f.startsWith(prefix) && f.endsWith(".bak"))
    .sort()
    .reverse();

  if (backups.length === 0) return false;
  const abs = path.resolve(ROOT, filePath);
  fs.copyFileSync(path.join(BACKUPS_DIR, backups[0]), abs);
  return true;
}

/**
 * Rollback all applied patches by restoring from backups.
 */
export function rollbackAll(fixes: FixSuggestion[]): {
  restored: string[];
  failed: string[];
} {
  const restored: string[] = [];
  const failed: string[] = [];

  // Get unique files that were applied
  const appliedFiles = new Set(
    fixes.filter((f) => f.status === "applied").map((f) => f.patch.file),
  );

  for (const file of appliedFiles) {
    if (restoreLatestBackup(file)) {
      restored.push(file);
    } else {
      failed.push(file);
    }
  }

  // Update fix statuses
  for (const fix of fixes) {
    if (fix.status === "applied") {
      fix.status = "rolled-back";
    }
  }

  return { restored, failed };
}

/* ================================================================== */
/*  Patch Application                                                  */
/* ================================================================== */

/**
 * Apply a single text patch (search → replace) to a file.
 * Only replaces the FIRST occurrence for safety.
 */
function applyTextPatch(fix: FixSuggestion): boolean {
  const { search, replace } = fix.patch;
  if (!search || !replace) return false;

  const abs = path.resolve(ROOT, fix.patch.file);
  if (!fs.existsSync(abs)) {
    fix.status = "failed";
    return false;
  }

  const content = fs.readFileSync(abs, "utf-8");
  if (!content.includes(search)) {
    fix.status = "skipped";
    return false;
  }

  // Only replace FIRST occurrence for safety
  const updated = content.replace(search, replace);
  fs.writeFileSync(abs, updated);
  fix.status = "applied";
  return true;
}

/**
 * Generate a unified diff string for a fix (for reporting).
 */
export function generateDiff(fix: FixSuggestion): string {
  const lines: string[] = [];
  lines.push(`--- a/${fix.patch.file}`);
  lines.push(`+++ b/${fix.patch.file}`);

  if (fix.patch.search && fix.patch.replace) {
    lines.push(`@@ -1,1 +1,1 @@`);
    lines.push(`-${fix.patch.search}`);
    lines.push(`+${fix.patch.replace}`);
  } else if (fix.patch.classChange) {
    const cc = fix.patch.classChange;
    lines.push(`@@ Selector: ${cc.selector} @@`);
    if (cc.remove.length) lines.push(`- classes: ${cc.remove.join(" ")}`);
    if (cc.add.length) lines.push(`+ classes: ${cc.add.join(" ")}`);
  } else if (fix.patch.diff) {
    lines.push(fix.patch.diff);
  }

  return lines.join("\n");
}

/**
 * Save a patch file for a fix (for review).
 */
export function savePatchFile(fix: FixSuggestion): string {
  ensureDir(PATCHES_DIR);
  const patchName = `${fix.id}.patch`;
  const patchPath = path.join(PATCHES_DIR, patchName);
  fs.writeFileSync(patchPath, generateDiff(fix));
  return patchPath;
}

/* ================================================================== */
/*  Safe Apply System                                                  */
/* ================================================================== */

export interface ApplyResult {
  applied: FixSuggestion[];
  skipped: FixSuggestion[];
  failed: FixSuggestion[];
  history: FixHistoryEntry[];
}

/**
 * Apply fixes based on the specified mode.
 *
 * Modes:
 *   - "suggestion" — Generate patch files only, don't modify source
 *   - "auto-fix" — Apply fixes with confidence >= 80 that have search/replace
 */
export function applyFixes(
  fixes: FixSuggestion[],
  mode: FixMode = "suggestion",
): ApplyResult {
  const result: ApplyResult = {
    applied: [],
    skipped: [],
    failed: [],
    history: [],
  };

  // Always generate patch files for all fixes
  for (const fix of fixes) {
    savePatchFile(fix);
  }

  if (mode === "suggestion") {
    // In suggestion mode, just mark everything as suggested
    result.skipped = fixes;
    return result;
  }

  // Auto-fix mode: apply fixes that meet the threshold
  const candidates = fixes.filter(
    (f) =>
      f.status === "suggested" &&
      f.confidence >= AUTO_APPLY_THRESHOLD &&
      f.patch.search &&
      f.patch.replace,
  );

  // Group by file for efficient backup
  const byFile = new Map<string, FixSuggestion[]>();
  for (const fix of candidates) {
    const file = fix.patch.file;
    if (!byFile.has(file)) byFile.set(file, []);
    byFile.get(file)!.push(fix);
  }

  for (const [file, fileFixes] of byFile) {
    // Backup before patching
    try {
      backupFile(file);
    } catch (err) {
      console.error(`[self-healing] Cannot backup ${file}:`, err);
      for (const fix of fileFixes) {
        fix.status = "failed";
        result.failed.push(fix);
        result.history.push(buildHistoryEntry(fix, "failed", "failure"));
      }
      continue;
    }

    // Apply each fix
    for (const fix of fileFixes) {
      const startTime = Date.now();
      const applied = applyTextPatch(fix);
      const duration = Date.now() - startTime;

      if (applied) {
        result.applied.push(fix);
        result.history.push(buildHistoryEntry(fix, "applied", "success", duration));
      } else if (fix.status === "skipped") {
        result.skipped.push(fix);
        result.history.push(buildHistoryEntry(fix, "skipped", "failure", duration));
      } else {
        result.failed.push(fix);
        result.history.push(buildHistoryEntry(fix, "failed", "failure", duration));
      }
    }
  }

  // Non-candidate fixes are skipped
  const nonCandidates = fixes.filter(
    (f) => !candidates.includes(f) && f.status === "suggested",
  );
  result.skipped.push(...nonCandidates);

  // Save history
  appendHistory(result.history);

  return result;
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
  // Keep last 1000 entries
  const merged = [...existing, ...newEntries].slice(-1000);
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(merged, null, 2));
}

function buildHistoryEntry(
  fix: FixSuggestion,
  action: FixHistoryEntry["action"],
  result: FixHistoryEntry["result"],
  duration?: number,
): FixHistoryEntry {
  return {
    fixId: fix.id,
    timestamp: new Date().toISOString(),
    action,
    result,
    issueType: fix.metadata.issueType,
    file: fix.patch.file,
    confidence: fix.confidence,
    description: fix.description,
    fixDuration: duration,
  };
}
