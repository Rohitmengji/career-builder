/**
 * AI Code Reviewer — PR Review CLI
 *
 * Run this script to review code changes:
 *   npx tsx scripts/review-pr.ts                    — Review uncommitted changes
 *   npx tsx scripts/review-pr.ts main feature/xyz   — Review branch diff
 *   npx tsx scripts/review-pr.ts --ci               — CI mode (exit 1 on critical)
 *   npx tsx scripts/review-pr.ts --github           — Post as GitHub PR comment
 *
 * Exit codes:
 *   0 — No critical issues (or no changes)
 *   1 — Critical issues found (blocks merge in CI)
 */

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { runReview } from "../lib/ai-review/review-engine";
import { saveReviewReport, formatGitHubSummary, formatGitHubComment } from "../lib/ai-review/reporter";
import type { PRReviewReport } from "../lib/ai-review/types";

const ROOT = path.resolve(__dirname, "..");

/* ================================================================== */
/*  CLI Arguments                                                      */
/* ================================================================== */

const args = process.argv.slice(2);
const isCI = args.includes("--ci");
const isGitHub = args.includes("--github");
const nonFlagArgs = args.filter((a) => !a.startsWith("--"));

const base = nonFlagArgs[0] || "main";
const head = nonFlagArgs[1] || "HEAD";

/* ================================================================== */
/*  Main                                                               */
/* ================================================================== */

async function main(): Promise<void> {
  console.log("\n🔍 AI Code Reviewer\n");
  console.log(`   Base: ${base}`);
  console.log(`   Head: ${head}`);
  console.log(`   Mode: ${isCI ? "CI" : isGitHub ? "GitHub" : "Local"}\n`);

  // Run review
  const report = runReview(base, head);

  // Save report
  saveReviewReport(report);

  // Print results
  printReport(report);

  // GitHub integration
  if (isGitHub) {
    await postGitHubComments(report);
  }

  // CI exit code
  if (isCI && report.summary.shouldBlock) {
    console.log("\n⛔ MERGE BLOCKED — Critical issues found.\n");
    process.exit(1);
  }

  console.log(`\n📄 Full report: ui-audit/reports/code-review.md\n`);
}

/* ================================================================== */
/*  Console Report                                                     */
/* ================================================================== */

function printReport(report: PRReviewReport): void {
  const scoreIcon = report.summary.healthScore >= 80 ? "🟢" : report.summary.healthScore >= 50 ? "🟡" : "🔴";

  console.log(`${scoreIcon} Health Score: ${report.summary.healthScore}/100\n`);
  console.log(`   📁 Files reviewed: ${report.filesReviewed}`);
  console.log(`   ⏱️  Duration: ${report.duration}ms`);
  console.log(`   📝 Comments: ${report.summary.total}`);
  console.log(`      🔴 Critical: ${report.summary.critical}`);
  console.log(`      🟡 Warning:  ${report.summary.warnings}`);
  console.log(`      🔵 Suggestion: ${report.summary.suggestions}`);

  if (report.comments.length === 0) {
    console.log("\n   ✅ No issues found. Code looks good!\n");
    return;
  }

  // Print critical issues
  const criticals = report.comments.filter((c) => c.severity === "critical");
  if (criticals.length > 0) {
    console.log("\n   🔴 CRITICAL ISSUES:\n");
    for (const c of criticals) {
      console.log(`      ❗ ${c.title}`);
      console.log(`         File: ${c.file}${c.line ? `:${c.line}` : ""}`);
      console.log(`         Fix:  ${c.suggestion.slice(0, 100)}`);
      console.log("");
    }
  }

  // Print warnings
  const warnings = report.comments.filter((c) => c.severity === "warning");
  if (warnings.length > 0) {
    console.log("   🟡 WARNINGS:\n");
    for (const c of warnings.slice(0, 5)) {
      console.log(`      ⚠️  ${c.title}`);
      console.log(`         File: ${c.file}${c.line ? `:${c.line}` : ""}`);
    }
    if (warnings.length > 5) {
      console.log(`\n      ...and ${warnings.length - 5} more warnings.`);
    }
    console.log("");
  }

  // Print suggestions (summary only)
  const suggestions = report.comments.filter((c) => c.severity === "suggestion");
  if (suggestions.length > 0) {
    console.log(`   🔵 ${suggestions.length} suggestion(s) — see full report for details.`);
  }
}

/* ================================================================== */
/*  GitHub Integration                                                 */
/* ================================================================== */

async function postGitHubComments(report: PRReviewReport): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  const prNumber = process.env.GITHUB_PR_NUMBER || process.env.PR_NUMBER;

  if (!token || !repo || !prNumber) {
    console.log("\n   ⚠️  GitHub integration requires GITHUB_TOKEN, GITHUB_REPOSITORY, and GITHUB_PR_NUMBER/PR_NUMBER env vars.");
    console.log("   📄 Saving GitHub comment to file instead...");

    // Save as file for manual posting
    const summary = formatGitHubSummary(report);
    const outputPath = path.join(ROOT, "ui-audit", "reports", "github-comment.md");
    fs.writeFileSync(outputPath, summary);
    console.log(`   📄 Saved to: ${outputPath}\n`);
    return;
  }

  console.log(`\n   📤 Posting to GitHub PR #${prNumber}...`);

  try {
    // Post summary comment
    const summary = formatGitHubSummary(report);
    const response = await fetch(
      `https://api.github.com/repos/${repo}/issues/${prNumber}/comments`,
      {
        method: "POST",
        headers: {
          Authorization: `token ${token}`,
          "Content-Type": "application/json",
          Accept: "application/vnd.github.v3+json",
        },
        body: JSON.stringify({ body: summary }),
      },
    );

    if (response.ok) {
      console.log("   ✅ Summary comment posted.");
    } else {
      console.error(`   ❌ Failed to post comment: ${response.status} ${response.statusText}`);
    }

    // Post individual file comments (critical only, to avoid noise)
    const criticals = report.comments.filter((c) => c.severity === "critical" && c.line);
    if (criticals.length > 0) {
      // Get PR commit SHA
      let commitSha: string | undefined;
      try {
        const prResponse = await fetch(
          `https://api.github.com/repos/${repo}/pulls/${prNumber}`,
          {
            headers: {
              Authorization: `token ${token}`,
              Accept: "application/vnd.github.v3+json",
            },
          },
        );
        if (prResponse.ok) {
          const prData = await prResponse.json() as any;
          commitSha = prData.head?.sha;
        }
      } catch {
        // Fallback — skip inline comments
      }

      if (commitSha) {
        for (const comment of criticals.slice(0, 10)) {
          try {
            const body = formatGitHubComment(comment);
            await fetch(
              `https://api.github.com/repos/${repo}/pulls/${prNumber}/comments`,
              {
                method: "POST",
                headers: {
                  Authorization: `token ${token}`,
                  "Content-Type": "application/json",
                  Accept: "application/vnd.github.v3+json",
                },
                body: JSON.stringify({
                  body,
                  commit_id: commitSha,
                  path: comment.file,
                  line: comment.line,
                  side: "RIGHT",
                }),
              },
            );
          } catch (err) {
            console.error(`   ⚠️  Failed to post inline comment on ${comment.file}:`, err);
          }
        }
        console.log(`   ✅ Posted ${Math.min(criticals.length, 10)} inline comment(s).`);
      }
    }
  } catch (err) {
    console.error("   ❌ GitHub API error:", err);
  }
}

/* ================================================================== */
/*  Entry Point                                                        */
/* ================================================================== */

main().catch((err) => {
  console.error("\n❌ Review failed:", err);
  process.exit(1);
});
