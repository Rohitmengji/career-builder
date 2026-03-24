/**
 * UI Audit — Device & Route Configuration
 *
 * Single source of truth for what we test and where.
 */

export interface DeviceProfile {
  name: string;
  width: number;
  height: number;
  /** Viewport category used in reports */
  category: "mobile" | "tablet" | "laptop" | "desktop";
}

export const DEVICES: DeviceProfile[] = [
  { name: "iphone-se", width: 375, height: 667, category: "mobile" },
  { name: "iphone-14", width: 390, height: 844, category: "mobile" },
  { name: "tablet", width: 768, height: 1024, category: "tablet" },
  { name: "laptop", width: 1024, height: 768, category: "laptop" },
  { name: "desktop", width: 1440, height: 900, category: "desktop" },
];

/** Routes to audit. Add new pages here as the site grows. */
export const ROUTES = [
  { path: "/", label: "homepage", needsAdmin: false },
  { path: "/careers", label: "careers-slug", needsAdmin: true },
  { path: "/jobs", label: "jobs", needsAdmin: false },
];

/** Severity levels for detected issues */
export type Severity = "critical" | "major" | "minor" | "info";

/** A single detected UI issue */
export interface UIIssue {
  id: string;
  route: string;
  device: string;
  category: string;
  type: "overflow" | "spacing" | "image" | "layout" | "a11y" | "performance";
  severity: Severity;
  message: string;
  selector?: string;
  details?: Record<string, unknown>;
  suggestedFix?: string;
  screenshot?: string;
}

/** Full audit report structure */
export interface AuditReport {
  timestamp: string;
  duration: number;
  routes: string[];
  devices: string[];
  totalIssues: number;
  critical: number;
  major: number;
  minor: number;
  info: number;
  issues: UIIssue[];
  accessibility: A11yViolation[];
  performance: PerfMetrics[];
  screenshots: string[];
}

export interface A11yViolation {
  route: string;
  device: string;
  id: string;
  impact: string;
  description: string;
  helpUrl: string;
  nodes: number;
  selectors: string[];
}

export interface PerfMetrics {
  route: string;
  device: string;
  cls: number;
  loadTime: number;
  domContentLoaded: number;
}

/* ================================================================== */
/*  Self-Healing / Fix Types                                           */
/* ================================================================== */

export type FixStatus = "suggested" | "applied" | "verified" | "failed" | "skipped" | "rolled-back";

export interface FixSuggestion {
  id: string;
  issueId: string;
  route: string;
  device: string;
  issueType: string;
  severity: string;
  /** Confidence score 0-100 (≥80 = auto-applicable) */
  confidence: number;
  /** Impact level of the fix */
  impact: "low" | "medium" | "high";
  /** The file to patch */
  file: string;
  /** Root cause analysis */
  rootCause: string;
  /** Human-readable description of the fix */
  description: string;
  /** Search string in the file (for apply) */
  search?: string;
  /** Replacement string (for apply) */
  replace?: string;
  /** The exact CSS/Tailwind class change */
  classChange?: { selector: string; remove: string[]; add: string[] };
  /** Status of the fix */
  status: FixStatus;
  /** Verification result message */
  verifyResult?: string;
  /** Screenshot before fix */
  screenshotBefore?: string;
  /** Screenshot after fix (if verified) */
  screenshotAfter?: string;
  /** Did the verification pass? */
  verified?: boolean;
}

export interface FixReport {
  timestamp: string;
  totalIssues: number;
  totalFixes: number;
  applied: number;
  verified: number;
  failed: number;
  skipped: number;
  fixes: FixSuggestion[];
}

/** An entry in the fix history log (learning system) */
export interface FixHistoryEntry {
  id: string;
  timestamp: string;
  action: "applied" | "verified" | "failed" | "rolled-back" | "skipped";
  file: string;
  result: "success" | "failure";
  issueType: string;
  confidence: number;
  description: string;
}
