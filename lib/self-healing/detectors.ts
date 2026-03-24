/**
 * Self-Healing System — Modular Issue Detectors
 *
 * Each detector is a self-contained module that analyzes a specific category
 * of issues. They all implement the IssueDetector interface and are registered
 * in the detector registry for the pipeline to invoke.
 *
 * Detectors:
 *   1. LayoutDetector — overflow, broken grid, missing spacing
 *   2. ImageDetector — broken URLs, missing alt text, stretched images
 *   3. ComponentCrashDetector — runtime errors, undefined props
 *   4. AccessibilityDetector — missing labels, poor contrast
 *   5. ApiFailureDetector — failed responses, timeout issues
 *   6. ConsoleErrorDetector — browser console errors/warnings
 */

import type {
  IssueDetector,
  DetectedIssue,
  DetectionContext,
  IssueSeverity,
  IssueSource,
} from "./types";

let issueCounter = 0;
function nextId(): string {
  return `sh-issue-${++issueCounter}`;
}

/** Reset counter between runs */
export function resetDetectorCounters(): void {
  issueCounter = 0;
}

/* ================================================================== */
/*  1. Layout Detector                                                 */
/* ================================================================== */

export class LayoutDetector implements IssueDetector {
  name = "layout-detector";
  category = "layout" as const;

  async detect(context: DetectionContext): Promise<DetectedIssue[]> {
    const issues: DetectedIssue[] = [];
    const report = context.auditReport as any;
    if (!report?.issues) return issues;

    for (const raw of report.issues) {
      if (raw.type === "overflow") {
        issues.push({
          id: nextId(),
          timestamp: new Date().toISOString(),
          category: "layout",
          type: "overflow",
          severity: raw.severity as IssueSeverity,
          message: raw.message,
          source: this.buildSource(raw),
          selector: raw.selector,
          details: raw.details,
          evidence: raw.suggestedFix,
          screenshot: raw.screenshot,
        });
      }

      if (raw.type === "layout" && raw.message?.includes("collapsed")) {
        issues.push({
          id: nextId(),
          timestamp: new Date().toISOString(),
          category: "layout",
          type: "collapsed-section",
          severity: raw.severity as IssueSeverity,
          message: raw.message,
          source: this.buildSource(raw),
          selector: raw.selector,
          details: raw.details,
        });
      }

      if (raw.type === "spacing") {
        issues.push({
          id: nextId(),
          timestamp: new Date().toISOString(),
          category: "layout",
          type: "excessive-whitespace",
          severity: raw.severity as IssueSeverity,
          message: raw.message,
          source: this.buildSource(raw),
          selector: raw.selector,
          details: raw.details,
        });
      }
    }

    return issues;
  }

  private buildSource(raw: any): IssueSource {
    return {
      detector: this.name,
      route: raw.route,
      device: raw.device,
    };
  }
}

/* ================================================================== */
/*  2. Image Detector                                                  */
/* ================================================================== */

export class ImageDetector implements IssueDetector {
  name = "image-detector";
  category = "image" as const;

  async detect(context: DetectionContext): Promise<DetectedIssue[]> {
    const issues: DetectedIssue[] = [];
    const report = context.auditReport as any;
    if (!report?.issues) return issues;

    for (const raw of report.issues) {
      if (raw.type !== "image") continue;

      const isBroken = raw.message?.includes("Broken");
      const isStretched = raw.message?.includes("stretched");
      const isMissingAlt = raw.message?.includes("alt");

      issues.push({
        id: nextId(),
        timestamp: new Date().toISOString(),
        category: "image",
        type: isBroken ? "broken-image" : isStretched ? "stretched-image" : isMissingAlt ? "missing-alt" : "image-issue",
        severity: raw.severity as IssueSeverity,
        message: raw.message,
        source: {
          detector: this.name,
          route: raw.route,
          device: raw.device,
        },
        selector: raw.selector,
        details: raw.details,
      });
    }

    return issues;
  }
}

/* ================================================================== */
/*  3. Component Crash Detector                                        */
/* ================================================================== */

export class ComponentCrashDetector implements IssueDetector {
  name = "component-crash-detector";
  category = "component-crash" as const;

  async detect(context: DetectionContext): Promise<DetectedIssue[]> {
    const issues: DetectedIssue[] = [];

    // Detect from console errors
    const consoleErrors = context.consoleErrors ?? [];
    for (const err of consoleErrors) {
      if (err.level !== "error") continue;

      const isRuntimeError = this.isComponentError(err.message);
      if (!isRuntimeError) continue;

      issues.push({
        id: nextId(),
        timestamp: err.timestamp,
        category: "component-crash",
        type: this.classifyError(err.message),
        severity: "critical",
        message: `Component error: ${err.message.slice(0, 200)}`,
        source: {
          detector: this.name,
          file: err.source,
          line: err.line,
        },
        evidence: err.stack?.slice(0, 500),
      });
    }

    // Detect from observability logs
    const obsLogs = context.observabilityLogs ?? [];
    for (const log of obsLogs) {
      if (log.level !== "error" && log.level !== "fatal") continue;
      if (!log.event?.includes("render") && !log.event?.includes("component")) continue;

      issues.push({
        id: nextId(),
        timestamp: log.timestamp,
        category: "component-crash",
        type: "render-error",
        severity: "critical",
        message: `Render error: ${log.message?.slice(0, 200) ?? log.event}`,
        source: {
          detector: this.name,
          route: log.context?.route as string | undefined,
        },
        details: log.context,
      });
    }

    return issues;
  }

  private isComponentError(message: string): boolean {
    const patterns = [
      /cannot read propert/i,
      /is not a function/i,
      /undefined is not an object/i,
      /null is not an object/i,
      /is not defined/i,
      /invariant violation/i,
      /maximum update depth/i,
      /too many re-renders/i,
      /each child in a list should have a unique/i,
      /cannot update a component/i,
      /hydration/i,
      /unhandled runtime error/i,
    ];
    return patterns.some((p) => p.test(message));
  }

  private classifyError(message: string): string {
    if (/cannot read propert|undefined is not|null is not/i.test(message)) return "undefined-prop";
    if (/is not a function/i.test(message)) return "missing-function";
    if (/maximum update depth|too many re-renders/i.test(message)) return "infinite-loop";
    if (/hydration/i.test(message)) return "hydration-mismatch";
    if (/each child in a list/i.test(message)) return "missing-key";
    return "runtime-error";
  }
}

/* ================================================================== */
/*  4. Accessibility Detector                                          */
/* ================================================================== */

export class AccessibilityDetector implements IssueDetector {
  name = "accessibility-detector";
  category = "accessibility" as const;

  async detect(context: DetectionContext): Promise<DetectedIssue[]> {
    const issues: DetectedIssue[] = [];
    const report = context.auditReport as any;
    if (!report?.accessibility) return issues;

    for (const violation of report.accessibility) {
      const severity = this.mapImpactToSeverity(violation.impact);

      issues.push({
        id: nextId(),
        timestamp: new Date().toISOString(),
        category: "accessibility",
        type: violation.id,
        severity,
        message: `A11y: ${violation.description}`,
        source: {
          detector: this.name,
          route: violation.route,
          device: violation.device,
        },
        selector: violation.selectors?.[0],
        details: {
          helpUrl: violation.helpUrl,
          nodes: violation.nodes,
          selectors: violation.selectors,
        },
      });
    }

    return issues;
  }

  private mapImpactToSeverity(impact: string): IssueSeverity {
    switch (impact) {
      case "critical": return "critical";
      case "serious": return "major";
      case "moderate": return "minor";
      default: return "info";
    }
  }
}

/* ================================================================== */
/*  5. API Failure Detector                                            */
/* ================================================================== */

export class ApiFailureDetector implements IssueDetector {
  name = "api-failure-detector";
  category = "api-failure" as const;

  async detect(context: DetectionContext): Promise<DetectedIssue[]> {
    const issues: DetectedIssue[] = [];
    const failures = context.apiFailures ?? [];

    for (const failure of failures) {
      const isTimeout = failure.duration > 15000;
      const isServerError = failure.statusCode >= 500;
      const isClientError = failure.statusCode >= 400 && failure.statusCode < 500;

      issues.push({
        id: nextId(),
        timestamp: failure.timestamp,
        category: "api-failure",
        type: isTimeout ? "api-timeout" : isServerError ? "api-server-error" : "api-client-error",
        severity: isServerError || isTimeout ? "critical" : isClientError ? "major" : "minor",
        message: `API ${failure.method} ${failure.url} → ${failure.statusCode} (${failure.duration}ms)${isTimeout ? " [TIMEOUT]" : ""}`,
        source: {
          detector: this.name,
          route: this.extractRoute(failure.url),
        },
        details: {
          method: failure.method,
          url: failure.url,
          statusCode: failure.statusCode,
          duration: failure.duration,
          error: failure.error,
        },
      });
    }

    // Also check observability logs for API errors
    const obsLogs = context.observabilityLogs ?? [];
    for (const log of obsLogs) {
      if (log.level !== "error") continue;
      if (!log.event?.includes("api") && !log.event?.includes("request")) continue;

      const statusCode = log.context?.statusCode as number | undefined;
      if (!statusCode || statusCode < 400) continue;

      issues.push({
        id: nextId(),
        timestamp: log.timestamp,
        category: "api-failure",
        type: statusCode >= 500 ? "api-server-error" : "api-client-error",
        severity: statusCode >= 500 ? "critical" : "major",
        message: `API error: ${log.message ?? log.event} (${statusCode})`,
        source: {
          detector: this.name,
          route: log.context?.route as string | undefined,
        },
        details: log.context,
      });
    }

    return issues;
  }

  private extractRoute(url: string): string | undefined {
    try {
      const parsed = new URL(url, "http://localhost");
      return parsed.pathname;
    } catch {
      return undefined;
    }
  }
}

/* ================================================================== */
/*  6. Console Error Detector                                          */
/* ================================================================== */

export class ConsoleErrorDetector implements IssueDetector {
  name = "console-error-detector";
  category = "console-error" as const;

  async detect(context: DetectionContext): Promise<DetectedIssue[]> {
    const issues: DetectedIssue[] = [];
    const errors = context.consoleErrors ?? [];

    for (const err of errors) {
      // Skip component-crash errors — handled by ComponentCrashDetector
      if (err.level === "error" && this.isComponentError(err.message)) continue;

      issues.push({
        id: nextId(),
        timestamp: err.timestamp,
        category: "console-error",
        type: err.level === "error" ? "console-error" : "console-warning",
        severity: err.level === "error" ? "major" : "minor",
        message: `Console ${err.level}: ${err.message.slice(0, 200)}`,
        source: {
          detector: this.name,
          file: err.source,
          line: err.line,
        },
        evidence: err.stack?.slice(0, 500),
      });
    }

    return issues;
  }

  private isComponentError(message: string): boolean {
    const patterns = [
      /cannot read propert/i,
      /is not a function/i,
      /undefined is not an object/i,
      /null is not an object/i,
      /invariant violation/i,
      /maximum update depth/i,
      /too many re-renders/i,
      /hydration/i,
    ];
    return patterns.some((p) => p.test(message));
  }
}

/* ================================================================== */
/*  Detector Registry                                                  */
/* ================================================================== */

/** All registered detectors — add new detectors here */
export const DETECTOR_REGISTRY: IssueDetector[] = [
  new LayoutDetector(),
  new ImageDetector(),
  new ComponentCrashDetector(),
  new AccessibilityDetector(),
  new ApiFailureDetector(),
  new ConsoleErrorDetector(),
];

/**
 * Run all detectors against the given context.
 * Returns aggregated issues from all detectors.
 */
export async function runAllDetectors(
  context: DetectionContext,
): Promise<DetectedIssue[]> {
  resetDetectorCounters();
  const allIssues: DetectedIssue[] = [];

  for (const detector of DETECTOR_REGISTRY) {
    try {
      const issues = await detector.detect(context);
      allIssues.push(...issues);
    } catch (err) {
      console.error(`[self-healing] Detector "${detector.name}" failed:`, err);
      // Continue with other detectors — never let one failure block the pipeline
    }
  }

  // Sort by severity: critical → major → minor → info
  const severityOrder: Record<string, number> = { critical: 0, major: 1, minor: 2, info: 3 };
  allIssues.sort(
    (a, b) => (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3),
  );

  return allIssues;
}
