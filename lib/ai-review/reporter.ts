/**
 * AI Code Reviewer — Report Generator
 *
 * Generates structured reports in JSON and Markdown formats,
 * and provides GitHub-compatible comment formatting.
 */

import * as fs from "fs";
import * as path from "path";
import type { PRReviewReport, ReviewComment } from "./types";

const ROOT = path.resolve(__dirname, "../..");
const REPORTS_DIR = path.join(ROOT, "ui-audit", "reports");

function ensureDir(d: string): void {
  fs.mkdirSync(d, { recursive: true });
}

/* ================================================================== */
/*  Report Persistence                                                 */
/* ================================================================== */

/**
 * Save review report as JSON and Markdown.
 */
export function saveReviewReport(report: PRReviewReport): void {
  ensureDir(REPORTS_DIR);

  fs.writeFileSync(
    path.join(REPORTS_DIR, "code-review.json"),
    JSON.stringify(report, null, 2),
  );

  fs.writeFileSync(
    path.join(REPORTS_DIR, "code-review.md"),
    buildMarkdown(report),
  );
}

/* ================================================================== */
/*  Markdown Report                                                    */
/* ================================================================== */

function buildMarkdown(report: PRReviewReport): string {
  const L: string[] = [];

  L.push("# 🔍 AI Code Review Report\n");
  L.push(`**Generated:** ${report.timestamp}  `);
  L.push(`**Ref:** \`${report.ref ?? "working tree"}\`  `);
  L.push(`**Files Reviewed:** ${report.filesReviewed}  `);
  L.push(`**Duration:** ${report.duration}ms\n`);

  // Health score badge
  const scoreIcon = report.summary.healthScore >= 80 ? "🟢" : report.summary.healthScore >= 50 ? "🟡" : "🔴";
  L.push(`## ${scoreIcon} Health Score: ${report.summary.healthScore}/100\n`);

  // Summary
  L.push("## 📊 Summary\n");
  L.push("| Level | Count |");
  L.push("|-------|-------|");
  L.push(`| 🔴 Critical (must fix) | ${report.summary.critical} |`);
  L.push(`| 🟡 Warning | ${report.summary.warnings} |`);
  L.push(`| 🔵 Suggestion | ${report.summary.suggestions} |`);
  L.push(`| **Total** | **${report.summary.total}** |`);
  L.push("");

  if (report.summary.shouldBlock) {
    L.push("> ⛔ **MERGE BLOCKED** — Critical issues found. Fix before merging.\n");
  } else if (report.summary.warnings > 0) {
    L.push("> ⚠️ **Warnings found** — Review before merging.\n");
  } else {
    L.push("> ✅ **All clear** — No critical issues found.\n");
  }

  // Comments by file
  if (report.comments.length > 0) {
    L.push("## 📝 Review Comments\n");

    // Group by file
    const byFile = new Map<string, ReviewComment[]>();
    for (const comment of report.comments) {
      if (!byFile.has(comment.file)) byFile.set(comment.file, []);
      byFile.get(comment.file)!.push(comment);
    }

    for (const [file, comments] of byFile) {
      L.push(`### \`${file}\`\n`);

      for (const comment of comments) {
        const icon = comment.severity === "critical" ? "🔴" : comment.severity === "warning" ? "🟡" : "🔵";
        const lineRef = comment.line ? ` (line ${comment.line})` : "";

        L.push(`#### ${icon} ${comment.title}${lineRef}\n`);
        L.push(`**Rule:** \`${comment.rule}\`\n`);
        L.push(`**Issue:** ${comment.issue}\n`);
        L.push(`**Impact:** ${comment.impact}\n`);
        L.push(`**Fix:** ${comment.suggestion}\n`);
        L.push("---\n");
      }
    }
  }

  // Skipped files
  if (report.skippedFiles.length > 0) {
    L.push("<details>");
    L.push(`<summary>📦 Skipped Files (${report.skippedFiles.length})</summary>\n`);
    for (const f of report.skippedFiles) {
      L.push(`- ${f}`);
    }
    L.push("\n</details>\n");
  }

  return L.join("\n");
}

/* ================================================================== */
/*  GitHub Comment Formatting                                          */
/* ================================================================== */

/**
 * Format a review comment as a GitHub PR review comment.
 */
export function formatGitHubComment(comment: ReviewComment): string {
  const icon = comment.severity === "critical" ? "❗" : comment.severity === "warning" ? "⚠️" : "💡";
  const lines: string[] = [];

  lines.push(`${icon} **${comment.title}**`);
  lines.push("");
  lines.push(`> ${comment.issue}`);
  lines.push("");
  lines.push(`**Impact:** ${comment.impact}`);
  lines.push("");
  lines.push(`**Suggestion:** ${comment.suggestion}`);
  lines.push("");
  lines.push(`_Rule: \`${comment.rule}\` | Severity: ${comment.severity}_`);

  return lines.join("\n");
}

/**
 * Format the full review as a GitHub PR summary comment.
 */
export function formatGitHubSummary(report: PRReviewReport): string {
  const L: string[] = [];
  const scoreIcon = report.summary.healthScore >= 80 ? "🟢" : report.summary.healthScore >= 50 ? "🟡" : "🔴";

  L.push(`## ${scoreIcon} AI Code Review — Health Score: ${report.summary.healthScore}/100\n`);

  if (report.summary.shouldBlock) {
    L.push("⛔ **Critical issues found. Fix before merging.**\n");
  }

  L.push(`| 🔴 Critical | 🟡 Warning | 🔵 Suggestion |`);
  L.push(`|:-----------:|:----------:|:-------------:|`);
  L.push(`| ${report.summary.critical} | ${report.summary.warnings} | ${report.summary.suggestions} |\n`);

  // Top issues
  const criticals = report.comments.filter((c) => c.severity === "critical");
  if (criticals.length > 0) {
    L.push("### Critical Issues\n");
    for (const c of criticals) {
      L.push(`- ❗ **${c.title}** in \`${c.file}\`${c.line ? `:${c.line}` : ""}`);
      L.push(`  > ${c.suggestion}`);
    }
    L.push("");
  }

  const warns = report.comments.filter((c) => c.severity === "warning");
  if (warns.length > 0) {
    L.push("### Warnings\n");
    for (const c of warns.slice(0, 5)) {
      L.push(`- ⚠️ **${c.title}** in \`${c.file}\`${c.line ? `:${c.line}` : ""}`);
    }
    if (warns.length > 5) L.push(`\n_...and ${warns.length - 5} more warnings._`);
    L.push("");
  }

  L.push(`\n_Reviewed ${report.filesReviewed} file(s) in ${report.duration}ms._`);

  return L.join("\n");
}
