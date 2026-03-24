/**
 * Self-Healing System — Learning System
 *
 * Tracks fix outcomes over time to improve future suggestions.
 *
 * Features:
 *   - Success rate tracking by issue type
 *   - Confidence adjustment recommendations
 *   - Pattern recognition for reliable fix patterns
 *   - Analytics for reporting
 */

import * as fs from "fs";
import * as path from "path";
import type { FixHistoryEntry, LearningData } from "./types";

const ROOT = path.resolve(__dirname, "../..");
const REPORTS_DIR = path.join(ROOT, "ui-audit", "reports");
const HISTORY_PATH = path.join(REPORTS_DIR, "fix-history.json");
const LEARNING_PATH = path.join(REPORTS_DIR, "learning-data.json");

function ensureDir(d: string): void {
  fs.mkdirSync(d, { recursive: true });
}

/* ================================================================== */
/*  Data Loading                                                       */
/* ================================================================== */

function loadHistory(): FixHistoryEntry[] {
  if (!fs.existsSync(HISTORY_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(HISTORY_PATH, "utf-8"));
  } catch {
    return [];
  }
}

/* ================================================================== */
/*  Learning Analysis                                                  */
/* ================================================================== */

/**
 * Analyze fix history and produce learning insights.
 */
export function analyzeLearningData(): LearningData {
  const history = loadHistory();

  // Success rates by issue type
  const successRates: LearningData["successRates"] = {};
  const typeGroups = new Map<string, FixHistoryEntry[]>();

  for (const entry of history) {
    if (!typeGroups.has(entry.issueType)) {
      typeGroups.set(entry.issueType, []);
    }
    typeGroups.get(entry.issueType)!.push(entry);
  }

  for (const [type, entries] of typeGroups) {
    const attempts = entries.length;
    const successes = entries.filter((e) => e.result === "success").length;
    successRates[type] = {
      attempts,
      successes,
      rate: attempts > 0 ? Math.round((successes / attempts) * 100) : 0,
    };
  }

  // Confidence adjustments
  const confidenceAdjustments: Record<string, number> = {};
  for (const [type, stats] of Object.entries(successRates)) {
    if (stats.attempts < 3) continue; // Not enough data
    const rate = stats.rate / 100;
    confidenceAdjustments[type] =
      rate >= 0.8 ? 15 : rate <= 0.2 ? -20 : Math.round((rate - 0.5) * 20);
  }

  // Top root causes
  const causeCounts = new Map<string, number>();
  for (const entry of history) {
    const current = causeCounts.get(entry.issueType) ?? 0;
    causeCounts.set(entry.issueType, current + 1);
  }
  const topRootCauses = Array.from(causeCounts.entries())
    .map(([cause, count]) => ({ cause, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Reliable patterns
  const reliablePatterns: LearningData["reliablePatterns"] = [];
  for (const [type, stats] of Object.entries(successRates)) {
    if (stats.attempts >= 3 && stats.rate >= 80) {
      reliablePatterns.push({
        pattern: type,
        successRate: stats.rate,
        count: stats.attempts,
      });
    }
  }
  reliablePatterns.sort((a, b) => b.successRate - a.successRate);

  const data: LearningData = {
    totalAttempts: history.length,
    successRates,
    confidenceAdjustments,
    topRootCauses,
    reliablePatterns,
    lastUpdated: new Date().toISOString(),
  };

  // Persist
  ensureDir(REPORTS_DIR);
  fs.writeFileSync(LEARNING_PATH, JSON.stringify(data, null, 2));

  return data;
}

/**
 * Get a human-readable learning report.
 */
export function getLearningReport(): string {
  const data = analyzeLearningData();
  const lines: string[] = [];

  lines.push("# 🧠 Self-Healing Learning Report\n");
  lines.push(`**Last Updated:** ${data.lastUpdated}`);
  lines.push(`**Total Fix Attempts:** ${data.totalAttempts}\n`);

  // Success Rates
  lines.push("## Success Rates by Issue Type\n");
  lines.push("| Issue Type | Attempts | Successes | Rate | Confidence Adj |");
  lines.push("|------------|----------|-----------|------|----------------|");
  for (const [type, stats] of Object.entries(data.successRates)) {
    const adj = data.confidenceAdjustments[type];
    const adjStr = adj !== undefined ? (adj >= 0 ? `+${adj}` : `${adj}`) : "N/A";
    const bar = "█".repeat(Math.floor(stats.rate / 10)) + "░".repeat(10 - Math.floor(stats.rate / 10));
    lines.push(`| ${type} | ${stats.attempts} | ${stats.successes} | ${bar} ${stats.rate}% | ${adjStr} |`);
  }
  lines.push("");

  // Reliable Patterns
  if (data.reliablePatterns.length > 0) {
    lines.push("## ✅ Reliable Fix Patterns (≥80% success, ≥3 attempts)\n");
    for (const p of data.reliablePatterns) {
      lines.push(`- **${p.pattern}** — ${p.successRate}% success rate (${p.count} attempts)`);
    }
    lines.push("");
  }

  // Top Root Causes
  if (data.topRootCauses.length > 0) {
    lines.push("## 🔝 Most Common Issue Types\n");
    for (const c of data.topRootCauses.slice(0, 5)) {
      lines.push(`- **${c.cause}** — ${c.count} occurrences`);
    }
    lines.push("");
  }

  // Recommendations
  lines.push("## 💡 Recommendations\n");
  const lowSuccess = Object.entries(data.successRates)
    .filter(([, s]) => s.rate < 50 && s.attempts >= 3);
  if (lowSuccess.length > 0) {
    lines.push("**Fix patterns with low success rates (consider manual review):**\n");
    for (const [type, stats] of lowSuccess) {
      lines.push(`- ⚠️ **${type}** — only ${stats.rate}% success (${stats.attempts} attempts)`);
    }
  } else {
    lines.push("All fix patterns are performing well. No action needed.\n");
  }

  return lines.join("\n");
}
