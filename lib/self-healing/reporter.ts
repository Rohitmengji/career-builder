/**
 * Self-Healing System — Report Generator
 *
 * Produces structured JSON reports and human-readable Markdown reports
 * from the healing pipeline results.
 */

import * as fs from "fs";
import * as path from "path";
import type {
  DetectedIssue,
  RootCause,
  FixSuggestion,
  HealingReport,
  FixMode,
  IssueCategory,
  IssueSeverity,
  LearningData,
} from "./types";
import { analyzeLearningData } from "./learning";

const ROOT = path.resolve(__dirname, "../..");
const REPORTS_DIR = path.join(ROOT, "ui-audit", "reports");

function ensureDir(d: string): void {
  fs.mkdirSync(d, { recursive: true });
}

/* ================================================================== */
/*  Report Building                                                    */
/* ================================================================== */

/**
 * Build a complete HealingReport from pipeline results.
 */
export function buildReport(
  issues: DetectedIssue[],
  rootCauses: RootCause[],
  fixes: FixSuggestion[],
  mode: FixMode,
  duration: number,
  inputSources: string[],
): HealingReport {
  // Category counts
  const byCategory: Record<IssueCategory, number> = {
    layout: 0,
    image: 0,
    "component-crash": 0,
    accessibility: 0,
    "api-failure": 0,
    performance: 0,
    "console-error": 0,
    security: 0,
  };
  for (const issue of issues) {
    byCategory[issue.category] = (byCategory[issue.category] ?? 0) + 1;
  }

  // Severity counts
  const bySeverity: Record<IssueSeverity, number> = {
    critical: 0,
    major: 0,
    minor: 0,
    info: 0,
  };
  for (const issue of issues) {
    bySeverity[issue.severity] = (bySeverity[issue.severity] ?? 0) + 1;
  }

  let learningInsights: LearningData | undefined;
  try {
    learningInsights = analyzeLearningData();
  } catch {
    // Learning data may not exist yet — that's fine
  }

  return {
    timestamp: new Date().toISOString(),
    duration,
    mode,
    inputSources,
    issues,
    rootCauses,
    fixes,
    summary: {
      totalIssues: issues.length,
      totalFixes: fixes.length,
      applied: fixes.filter((f) => f.status === "applied").length,
      verified: fixes.filter((f) => f.status === "verified").length,
      failed: fixes.filter((f) => f.status === "failed").length,
      skipped: fixes.filter((f) => f.status === "skipped" || f.status === "suggested").length,
      byCategory,
      bySeverity,
    },
    learningInsights,
  };
}

/* ================================================================== */
/*  Report Persistence                                                 */
/* ================================================================== */

/**
 * Save the healing report as JSON and Markdown.
 */
export function saveReport(report: HealingReport): void {
  ensureDir(REPORTS_DIR);

  // JSON report
  fs.writeFileSync(
    path.join(REPORTS_DIR, "self-healing-report.json"),
    JSON.stringify(report, null, 2),
  );

  // Markdown report
  fs.writeFileSync(
    path.join(REPORTS_DIR, "self-healing-report.md"),
    buildMarkdown(report),
  );

  // Also save fixes.json for backward compatibility with existing ui-audit
  const fixesReport = {
    timestamp: report.timestamp,
    totalIssues: report.summary.totalIssues,
    totalFixes: report.summary.totalFixes,
    applied: report.summary.applied,
    verified: report.summary.verified,
    failed: report.summary.failed,
    skipped: report.summary.skipped,
    fixes: report.fixes.map((f) => ({
      id: f.id,
      issueId: f.issueId,
      route: f.metadata.route ?? "",
      device: f.metadata.device ?? "",
      issueType: f.metadata.issueType,
      severity: f.metadata.severity,
      rootCause: f.description,
      description: f.description,
      confidence: f.confidence,
      impact: f.impact,
      file: f.patch.file,
      search: f.patch.search,
      replace: f.patch.replace,
      classChange: f.patch.classChange,
      status: f.status,
      verified: f.verification?.resolved,
      verifyResult: f.verification?.message,
    })),
  };
  fs.writeFileSync(
    path.join(REPORTS_DIR, "fixes.json"),
    JSON.stringify(fixesReport, null, 2),
  );
}

/* ================================================================== */
/*  Markdown Generation                                                */
/* ================================================================== */

function buildMarkdown(report: HealingReport): string {
  const L: string[] = [];

  L.push("# 🩺 Self-Healing System Report\n");
  L.push(`**Generated:** ${report.timestamp}  `);
  L.push(`**Duration:** ${report.duration}ms  `);
  L.push(`**Mode:** ${report.mode}  `);
  L.push(`**Input Sources:** ${report.inputSources.join(", ") || "none"}\n`);

  // Summary
  L.push("## 📊 Summary\n");
  L.push("| Metric | Count |");
  L.push("|--------|-------|");
  L.push(`| Total Issues Detected | ${report.summary.totalIssues} |`);
  L.push(`| Fix Candidates | ${report.summary.totalFixes} |`);
  L.push(`| ✅ Applied | ${report.summary.applied} |`);
  L.push(`| ✔️  Verified | ${report.summary.verified} |`);
  L.push(`| ❌ Failed | ${report.summary.failed} |`);
  L.push(`| ⏭️  Skipped/Suggested | ${report.summary.skipped} |`);
  L.push("");

  // By Severity
  L.push("### Issues by Severity\n");
  L.push("| Severity | Count |");
  L.push("|----------|-------|");
  L.push(`| 🔴 Critical | ${report.summary.bySeverity.critical} |`);
  L.push(`| 🟠 Major | ${report.summary.bySeverity.major} |`);
  L.push(`| 🟡 Minor | ${report.summary.bySeverity.minor} |`);
  L.push(`| 🔵 Info | ${report.summary.bySeverity.info} |`);
  L.push("");

  // By Category
  L.push("### Issues by Category\n");
  L.push("| Category | Count |");
  L.push("|----------|-------|");
  for (const [cat, count] of Object.entries(report.summary.byCategory)) {
    if (count > 0) {
      L.push(`| ${cat} | ${count} |`);
    }
  }
  L.push("");

  // Detected Issues
  if (report.issues.length > 0) {
    L.push("## 🔍 Detected Issues\n");
    for (const issue of report.issues.slice(0, 50)) {
      const icon = issue.severity === "critical" ? "🔴" : issue.severity === "major" ? "🟠" : issue.severity === "minor" ? "🟡" : "🔵";
      L.push(`- ${icon} **[${issue.category}]** ${issue.message}`);
      if (issue.source.route) L.push(`  - Route: \`${issue.source.route}\` @ ${issue.source.device ?? "unknown"}`);
      if (issue.selector) L.push(`  - Selector: \`${issue.selector}\``);
    }
    if (report.issues.length > 50) {
      L.push(`\n_...and ${report.issues.length - 50} more issues._\n`);
    }
    L.push("");
  }

  // Root Causes
  if (report.rootCauses.length > 0) {
    L.push("## 🧠 Root Cause Analysis\n");
    for (const cause of report.rootCauses.slice(0, 30)) {
      const confBar = "█".repeat(Math.floor(cause.confidence / 10)) + "░".repeat(10 - Math.floor(cause.confidence / 10));
      L.push(`### ${cause.causeType} (${confBar} ${cause.confidence}%)`);
      L.push(`> ${cause.explanation}`);
      if (cause.file) L.push(`> File: \`${cause.file}\`${cause.line ? `:${cause.line}` : ""}`);
      L.push("");
    }
  }

  // Fix Details
  if (report.fixes.length > 0) {
    L.push("## 🔧 Fix Suggestions\n");
    for (const fix of report.fixes) {
      const icon = fix.status === "verified" ? "✅" : fix.status === "applied" ? "🔄" : fix.status === "failed" ? "❌" : fix.status === "rolled-back" ? "🔙" : fix.status === "skipped" ? "⏭️" : "💡";
      const confBar = "█".repeat(Math.floor(fix.confidence / 10)) + "░".repeat(10 - Math.floor(fix.confidence / 10));

      L.push(`### ${icon} ${fix.id} — ${fix.metadata.issueType}\n`);
      L.push("| Property | Value |");
      L.push("|----------|-------|");
      L.push(`| Status | ${fix.status} |`);
      L.push(`| Confidence | ${confBar} ${fix.confidence}% |`);
      L.push(`| Impact | ${fix.impact} |`);
      L.push(`| File | \`${fix.patch.file}\` |`);
      if (fix.metadata.route) L.push(`| Route | \`${fix.metadata.route}\` @ ${fix.metadata.device ?? ""} |`);
      L.push("");
      L.push(`**Fix:** ${fix.description}`);

      if (fix.patch.classChange) {
        L.push("\n```");
        L.push(`Selector: ${fix.patch.classChange.selector}`);
        if (fix.patch.classChange.remove.length) L.push(`Remove: ${fix.patch.classChange.remove.join(", ")}`);
        if (fix.patch.classChange.add.length) L.push(`Add:    ${fix.patch.classChange.add.join(", ")}`);
        L.push("```");
      }

      if (fix.patch.search && fix.patch.replace) {
        L.push("\n```diff");
        L.push(`- ${fix.patch.search}`);
        L.push(`+ ${fix.patch.replace}`);
        L.push("```");
      }

      if (fix.verification) {
        L.push(`\n**Verification:** ${fix.verification.message}`);
      }

      L.push("\n---\n");
    }
  }

  // Learning Insights
  if (report.learningInsights && report.learningInsights.totalAttempts > 0) {
    L.push("## 🧠 Learning Insights\n");
    L.push(`Total historical fix attempts: ${report.learningInsights.totalAttempts}\n`);

    if (report.learningInsights.reliablePatterns.length > 0) {
      L.push("**Reliable patterns:**");
      for (const p of report.learningInsights.reliablePatterns) {
        L.push(`- ✅ ${p.pattern} — ${p.successRate}% success (${p.count} attempts)`);
      }
      L.push("");
    }
  }

  return L.join("\n");
}
