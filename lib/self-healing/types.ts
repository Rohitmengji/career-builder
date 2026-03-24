/**
 * Self-Healing System — Core Types
 *
 * Shared type definitions across the self-healing pipeline.
 * These types define the contract between detectors, analyzers, fixers, and reporters.
 */

/* ================================================================== */
/*  Severity & Status                                                  */
/* ================================================================== */

export type IssueSeverity = "critical" | "major" | "minor" | "info";
export type FixStatus = "suggested" | "applied" | "verified" | "failed" | "skipped" | "rolled-back";
export type FixMode = "suggestion" | "auto-fix";

/* ================================================================== */
/*  Issue Detection                                                    */
/* ================================================================== */

export type IssueCategory =
  | "layout"
  | "image"
  | "component-crash"
  | "accessibility"
  | "api-failure"
  | "performance"
  | "console-error"
  | "security";

export interface DetectedIssue {
  /** Unique issue identifier */
  id: string;
  /** Timestamp of detection */
  timestamp: string;
  /** Issue category for routing to the correct analyzer */
  category: IssueCategory;
  /** Human-readable issue type (e.g. "overflow", "broken-image") */
  type: string;
  /** Severity level */
  severity: IssueSeverity;
  /** Human-readable description */
  message: string;
  /** Where the issue was found */
  source: IssueSource;
  /** CSS selector or component path if applicable */
  selector?: string;
  /** Additional structured data about the issue */
  details?: Record<string, unknown>;
  /** Raw evidence (DOM snippet, error stack, etc.) */
  evidence?: string;
  /** Screenshot path if available */
  screenshot?: string;
}

export interface IssueSource {
  /** Which input source detected this */
  detector: string;
  /** Route where issue was found */
  route?: string;
  /** Device/viewport where issue was found */
  device?: string;
  /** File path if applicable */
  file?: string;
  /** Line number if applicable */
  line?: number;
}

/* ================================================================== */
/*  Root Cause Analysis                                                */
/* ================================================================== */

export interface RootCause {
  /** Reference to the detected issue */
  issueId: string;
  /** The identified root cause category */
  causeType: string;
  /** Detailed explanation of the root cause */
  explanation: string;
  /** Confidence in the root cause analysis (0-100) */
  confidence: number;
  /** The file most likely containing the problem */
  file?: string;
  /** Line number in the file */
  line?: number;
  /** Related code context */
  codeContext?: string;
}

/* ================================================================== */
/*  Fix Suggestion                                                     */
/* ================================================================== */

export interface FixSuggestion {
  /** Unique fix identifier */
  id: string;
  /** Reference to the issue being fixed */
  issueId: string;
  /** Reference to the root cause */
  rootCauseId?: string;
  /** Human-readable description of the fix */
  description: string;
  /** Confidence score (0-100). >= 80 is auto-applicable */
  confidence: number;
  /** Impact level */
  impact: "low" | "medium" | "high";
  /** Current status */
  status: FixStatus;
  /** The patch to apply */
  patch: FixPatch;
  /** Verification result after applying */
  verification?: FixVerification;
  /** Metadata for reporting */
  metadata: FixMetadata;
}

export interface FixPatch {
  /** File to modify */
  file: string;
  /** Exact string to search for */
  search?: string;
  /** Replacement string */
  replace?: string;
  /** CSS/Tailwind class changes */
  classChange?: {
    selector: string;
    remove: string[];
    add: string[];
  };
  /** Full diff in unified format */
  diff?: string;
}

export interface FixVerification {
  /** Did the fix resolve the issue? */
  resolved: boolean;
  /** Verification message */
  message: string;
  /** Screenshot after fix */
  screenshotAfter?: string;
  /** Remaining issues count */
  remainingIssues?: number;
  /** Timestamp of verification */
  timestamp: string;
}

export interface FixMetadata {
  /** Issue category */
  category: IssueCategory;
  /** Issue type */
  issueType: string;
  /** Severity of original issue */
  severity: IssueSeverity;
  /** Route where issue was found */
  route?: string;
  /** Device where issue was found */
  device?: string;
  /** Screenshot before fix */
  screenshotBefore?: string;
}

/* ================================================================== */
/*  Learning System                                                    */
/* ================================================================== */

export interface FixHistoryEntry {
  /** Fix ID reference */
  fixId: string;
  /** Timestamp */
  timestamp: string;
  /** Action taken */
  action: "applied" | "verified" | "failed" | "rolled-back" | "skipped";
  /** Outcome */
  result: "success" | "failure";
  /** Issue type for pattern matching */
  issueType: string;
  /** File that was modified */
  file: string;
  /** Confidence at time of application */
  confidence: number;
  /** Description for reporting */
  description: string;
  /** Time to fix in ms */
  fixDuration?: number;
}

export interface LearningData {
  /** Total fixes attempted */
  totalAttempts: number;
  /** Success rate by issue type */
  successRates: Record<string, { attempts: number; successes: number; rate: number }>;
  /** Average confidence adjustment by type */
  confidenceAdjustments: Record<string, number>;
  /** Most common root causes */
  topRootCauses: Array<{ cause: string; count: number }>;
  /** Fix patterns that consistently work */
  reliablePatterns: Array<{ pattern: string; successRate: number; count: number }>;
  /** Last updated */
  lastUpdated: string;
}

/* ================================================================== */
/*  Pipeline Report                                                    */
/* ================================================================== */

export interface HealingReport {
  /** Report generation timestamp */
  timestamp: string;
  /** Pipeline duration in ms */
  duration: number;
  /** Mode the pipeline ran in */
  mode: FixMode;
  /** Input sources used */
  inputSources: string[];
  /** All detected issues */
  issues: DetectedIssue[];
  /** Root cause analyses */
  rootCauses: RootCause[];
  /** Fix suggestions */
  fixes: FixSuggestion[];
  /** Summary statistics */
  summary: {
    totalIssues: number;
    totalFixes: number;
    applied: number;
    verified: number;
    failed: number;
    skipped: number;
    byCategory: Record<IssueCategory, number>;
    bySeverity: Record<IssueSeverity, number>;
  };
  /** Learning insights */
  learningInsights?: LearningData;
}

/* ================================================================== */
/*  Detector Interface                                                 */
/* ================================================================== */

/** All detectors must implement this interface */
export interface IssueDetector {
  /** Unique name of the detector */
  name: string;
  /** Category of issues this detector finds */
  category: IssueCategory;
  /** Run detection and return issues */
  detect(context: DetectionContext): Promise<DetectedIssue[]>;
}

export interface DetectionContext {
  /** Playwright audit report (if available) */
  auditReport?: unknown;
  /** Console errors collected */
  consoleErrors?: ConsoleError[];
  /** API failure logs */
  apiFailures?: ApiFailure[];
  /** Observability logs */
  observabilityLogs?: ObservabilityLog[];
  /** DOM snapshots directory */
  snapshotsDir?: string;
  /** Screenshots directory */
  screenshotsDir?: string;
}

export interface ConsoleError {
  timestamp: string;
  level: "error" | "warning";
  message: string;
  source?: string;
  url?: string;
  line?: number;
  column?: number;
  stack?: string;
}

export interface ApiFailure {
  timestamp: string;
  method: string;
  url: string;
  statusCode: number;
  duration: number;
  error?: string;
  requestBody?: string;
  responseBody?: string;
}

export interface ObservabilityLog {
  timestamp: string;
  level: string;
  event: string;
  message?: string;
  context?: Record<string, unknown>;
}
