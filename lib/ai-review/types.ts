/**
 * AI Code Reviewer — Types
 *
 * Type definitions for the PR review system.
 */

/* ================================================================== */
/*  Severity                                                           */
/* ================================================================== */

export type ReviewSeverity = "critical" | "warning" | "suggestion";

/* ================================================================== */
/*  Review Comment                                                     */
/* ================================================================== */

export interface ReviewComment {
  /** Unique comment identifier */
  id: string;
  /** File path relative to repo root */
  file: string;
  /** Line number (1-based) */
  line?: number;
  /** Severity level */
  severity: ReviewSeverity;
  /** Rule that triggered this comment */
  rule: string;
  /** Short title */
  title: string;
  /** Detailed explanation of the issue */
  issue: string;
  /** Impact of not fixing */
  impact: string;
  /** Suggested fix */
  suggestion: string;
}

/* ================================================================== */
/*  Rule Definition                                                    */
/* ================================================================== */

export interface ReviewRule {
  /** Unique rule identifier */
  id: string;
  /** Rule category */
  category: ReviewCategory;
  /** Human-readable name */
  name: string;
  /** Severity when triggered */
  severity: ReviewSeverity;
  /** File patterns this rule applies to (glob-like) */
  filePatterns?: string[];
  /** Check function — returns comments if rule is violated */
  check: (context: FileChangeContext) => ReviewComment[];
}

export type ReviewCategory =
  | "architecture"
  | "state-management"
  | "ai-safety"
  | "security"
  | "performance"
  | "error-handling"
  | "multi-tenant"
  | "api-contract"
  | "best-practices";

/* ================================================================== */
/*  File Change Context                                                */
/* ================================================================== */

export interface FileChangeContext {
  /** File path relative to repo root */
  file: string;
  /** Lines added (with line numbers) */
  additions: DiffLine[];
  /** Lines removed (with line numbers) */
  deletions: DiffLine[];
  /** Full new content of the file (if available) */
  newContent?: string;
  /** Full old content of the file (if available) */
  oldContent?: string;
}

export interface DiffLine {
  /** Line number in the new file (for additions) or old file (for deletions) */
  lineNumber: number;
  /** Line content */
  content: string;
}

/* ================================================================== */
/*  PR Review Report                                                   */
/* ================================================================== */

export interface PRReviewReport {
  /** Timestamp of review */
  timestamp: string;
  /** PR/commit reference */
  ref?: string;
  /** Number of files reviewed */
  filesReviewed: number;
  /** All review comments */
  comments: ReviewComment[];
  /** Summary */
  summary: {
    total: number;
    critical: number;
    warnings: number;
    suggestions: number;
    /** Whether the PR should be blocked */
    shouldBlock: boolean;
    /** Overall health score (0-100) */
    healthScore: number;
  };
  /** Files that were skipped */
  skippedFiles: string[];
  /** Duration of review in ms */
  duration: number;
}
