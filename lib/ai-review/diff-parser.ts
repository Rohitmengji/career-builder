/**
 * AI Code Reviewer — Diff Parser
 *
 * Parses `git diff` output into structured FileChangeContext objects
 * for the review rules to analyze.
 */

import { execSync } from "child_process";
import * as path from "path";
import type { FileChangeContext, DiffLine } from "./types";

const ROOT = path.resolve(__dirname, "../..");

/* ================================================================== */
/*  Git Diff Extraction                                                */
/* ================================================================== */

/**
 * Get the diff for a PR or branch comparison.
 * @param base - Base branch (default: "main")
 * @param head - Head branch/commit (default: "HEAD")
 */
export function getGitDiff(base: string = "main", head: string = "HEAD"): string {
  try {
    return execSync(`git diff ${base}...${head}`, {
      cwd: ROOT,
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024, // 10MB
    });
  } catch {
    // Fallback to uncommitted changes
    try {
      return execSync("git diff --cached", {
        cwd: ROOT,
        encoding: "utf-8",
        maxBuffer: 10 * 1024 * 1024,
      });
    } catch {
      return execSync("git diff", {
        cwd: ROOT,
        encoding: "utf-8",
        maxBuffer: 10 * 1024 * 1024,
      });
    }
  }
}

/**
 * Get list of changed files.
 */
export function getChangedFiles(base: string = "main", head: string = "HEAD"): string[] {
  try {
    const output = execSync(`git diff --name-only ${base}...${head}`, {
      cwd: ROOT,
      encoding: "utf-8",
    });
    return output.trim().split("\n").filter(Boolean);
  } catch {
    try {
      const output = execSync("git diff --name-only --cached", {
        cwd: ROOT,
        encoding: "utf-8",
      });
      return output.trim().split("\n").filter(Boolean);
    } catch {
      const output = execSync("git diff --name-only", {
        cwd: ROOT,
        encoding: "utf-8",
      });
      return output.trim().split("\n").filter(Boolean);
    }
  }
}

/* ================================================================== */
/*  Diff Parser                                                        */
/* ================================================================== */

/**
 * Parse unified diff output into structured file changes.
 */
export function parseDiff(diffText: string): FileChangeContext[] {
  const files: FileChangeContext[] = [];
  if (!diffText.trim()) return files;

  const fileChunks = diffText.split(/^diff --git /m).filter(Boolean);

  for (const chunk of fileChunks) {
    const lines = chunk.split("\n");

    // Extract file path from "a/path b/path"
    const headerMatch = lines[0]?.match(/a\/(.+?) b\/(.+)/);
    if (!headerMatch) continue;

    const filePath = headerMatch[2];
    const additions: DiffLine[] = [];
    const deletions: DiffLine[] = [];

    let currentNewLine = 0;
    let currentOldLine = 0;

    for (const line of lines) {
      // Parse hunk header: @@ -oldStart,oldCount +newStart,newCount @@
      const hunkMatch = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (hunkMatch) {
        currentOldLine = parseInt(hunkMatch[1], 10);
        currentNewLine = parseInt(hunkMatch[2], 10);
        continue;
      }

      if (line.startsWith("+") && !line.startsWith("+++")) {
        additions.push({ lineNumber: currentNewLine, content: line.slice(1) });
        currentNewLine++;
      } else if (line.startsWith("-") && !line.startsWith("---")) {
        deletions.push({ lineNumber: currentOldLine, content: line.slice(1) });
        currentOldLine++;
      } else if (!line.startsWith("\\")) {
        // Context line
        currentNewLine++;
        currentOldLine++;
      }
    }

    files.push({ file: filePath, additions, deletions });
  }

  return files;
}

/**
 * Get file changes with full content (when available).
 */
export function getFileChanges(
  base: string = "main",
  head: string = "HEAD",
): FileChangeContext[] {
  const diff = getGitDiff(base, head);
  const changes = parseDiff(diff);

  // Try to load full file content for each changed file
  for (const change of changes) {
    const abs = path.resolve(ROOT, change.file);
    try {
      const fs = require("fs");
      if (fs.existsSync(abs)) {
        change.newContent = fs.readFileSync(abs, "utf-8");
      }
    } catch {
      // File may be deleted — that's fine
    }
  }

  return changes;
}

/* ================================================================== */
/*  Helpers                                                            */
/* ================================================================== */

/** Check if a file path matches a glob-like pattern */
export function matchesPattern(file: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    if (pattern.startsWith("**/")) {
      const suffix = pattern.slice(3);
      if (file.endsWith(suffix) || file.includes(suffix)) return true;
    } else if (pattern.endsWith("/**")) {
      const prefix = pattern.slice(0, -3);
      if (file.startsWith(prefix)) return true;
    } else if (pattern.includes("*")) {
      const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
      if (regex.test(file)) return true;
    } else {
      if (file === pattern || file.includes(pattern)) return true;
    }
  }
  return false;
}
