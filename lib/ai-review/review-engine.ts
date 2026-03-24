/**
 * AI Code Reviewer — Review Engine
 *
 * Orchestrates the code review process:
 *   1. Parse git diff
 *   2. Filter relevant files
 *   3. Run rules against each file
 *   4. Aggregate and deduplicate comments
 *   5. Generate report with severity scoring
 */

import type { PRReviewReport, FileChangeContext, ReviewComment } from "./types";
import { getFileChanges, getChangedFiles } from "./diff-parser";
import { reviewFileChange, resetCommentCounter } from "./rules";

/* ================================================================== */
/*  File Filters                                                       */
/* ================================================================== */

/** Files to skip during review (generated, config, etc.) */
const SKIP_PATTERNS = [
  /node_modules\//,
  /\.next\//,
  /dist\//,
  /\.git\//,
  /package-lock\.json/,
  /\.png$|\.jpg$|\.jpeg$|\.gif$|\.svg$|\.ico$/,
  /\.woff$|\.woff2$|\.ttf$|\.eot$/,
  /tsconfig\.tsbuildinfo$/,
  /\.env\.\w+/,
  /playwright-results\.json/,
  /ui-audit\/reports\//,
  /ui-audit\/screenshots\//,
];

function shouldSkipFile(file: string): boolean {
  return SKIP_PATTERNS.some((pattern) => pattern.test(file));
}

/* ================================================================== */
/*  Review Engine                                                      */
/* ================================================================== */

/**
 * Run a full code review on the current diff.
 *
 * @param base - Base branch to compare against (default: "main")
 * @param head - Head commit/branch (default: "HEAD")
 */
export function runReview(
  base: string = "main",
  head: string = "HEAD",
): PRReviewReport {
  resetCommentCounter();
  const startTime = Date.now();

  // Get file changes
  const changes = getFileChanges(base, head);
  const skippedFiles: string[] = [];
  const allComments: ReviewComment[] = [];

  // Review each file
  for (const change of changes) {
    if (shouldSkipFile(change.file)) {
      skippedFiles.push(change.file);
      continue;
    }

    // Skip files with no additions (deletions only)
    if (change.additions.length === 0) continue;

    const comments = reviewFileChange(change);
    allComments.push(...comments);
  }

  // Deduplicate comments (same rule + same file + same line)
  const uniqueComments = deduplicateComments(allComments);

  // Sort by severity
  const severityOrder: Record<string, number> = {
    critical: 0,
    warning: 1,
    suggestion: 2,
  };
  uniqueComments.sort(
    (a, b) => (severityOrder[a.severity] ?? 2) - (severityOrder[b.severity] ?? 2),
  );

  const critical = uniqueComments.filter((c) => c.severity === "critical").length;
  const warnings = uniqueComments.filter((c) => c.severity === "warning").length;
  const suggestions = uniqueComments.filter((c) => c.severity === "suggestion").length;

  // Health score: start at 100, subtract per issue
  const healthScore = Math.max(
    0,
    100 - critical * 25 - warnings * 10 - suggestions * 2,
  );

  return {
    timestamp: new Date().toISOString(),
    ref: `${base}...${head}`,
    filesReviewed: changes.length - skippedFiles.length,
    comments: uniqueComments,
    summary: {
      total: uniqueComments.length,
      critical,
      warnings,
      suggestions,
      shouldBlock: critical > 0,
      healthScore,
    },
    skippedFiles,
    duration: Date.now() - startTime,
  };
}

/* ================================================================== */
/*  Deduplication                                                      */
/* ================================================================== */

function deduplicateComments(comments: ReviewComment[]): ReviewComment[] {
  const seen = new Set<string>();
  const result: ReviewComment[] = [];

  for (const comment of comments) {
    const key = `${comment.rule}:${comment.file}:${comment.line ?? "file"}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(comment);
    }
  }

  return result;
}
