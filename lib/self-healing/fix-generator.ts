/**
 * Self-Healing System — Fix Generation Engine
 *
 * Generates safe, minimal fixes for detected issues based on root cause analysis.
 * Each fix rule produces:
 *   - A FixPatch (search/replace or class change)
 *   - A confidence score (0-100)
 *   - Only fixes with confidence >= 80 are auto-applicable
 *
 * The engine uses the learning system to adjust confidence based on
 * historical success/failure rates for each issue type.
 */

import * as fs from "fs";
import * as path from "path";
import type {
  DetectedIssue,
  RootCause,
  FixSuggestion,
  FixPatch,
  FixHistoryEntry,
  IssueSeverity,
  IssueCategory,
} from "./types";

const ROOT = path.resolve(__dirname, "../..");
const REPORTS_DIR = path.join(ROOT, "ui-audit", "reports");
const HISTORY_PATH = path.join(REPORTS_DIR, "fix-history.json");
const SNAPSHOTS_DIR = path.join(ROOT, "ui-audit", "snapshots");

/* ================================================================== */
/*  Learning System Integration                                        */
/* ================================================================== */

function loadHistory(): FixHistoryEntry[] {
  if (!fs.existsSync(HISTORY_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(HISTORY_PATH, "utf-8"));
  } catch {
    return [];
  }
}

/**
 * Adjust confidence based on past fix history for the same issue type.
 * Boosts confidence if similar fixes have worked before, penalizes if they've failed.
 */
function adjustConfidence(base: number, issueType: string, history: FixHistoryEntry[]): number {
  const past = history.filter((h) => h.issueType === issueType);
  if (past.length === 0) return base;

  const successes = past.filter((h) => h.result === "success").length;
  const ratio = successes / past.length;

  // Boost up to +15 if all past fixes succeeded, penalize up to -20 if they failed
  const delta = ratio >= 0.8 ? 15 : ratio <= 0.2 ? -20 : Math.round((ratio - 0.5) * 20);
  return Math.max(0, Math.min(100, base + delta));
}

/* ================================================================== */
/*  DOM Snapshot Helpers                                                */
/* ================================================================== */

function loadSnapshot(route?: string, device?: string): any | null {
  if (!route || !device) return null;
  const slug = route === "/" ? "homepage" : route.replace(/\//g, "-").replace(/^-/, "");
  const p = path.join(SNAPSHOTS_DIR, slug, `${device}.json`);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    return null;
  }
}

function extractClasses(snapshot: any, selector?: string): string[] {
  if (!snapshot?.sections) return [];
  for (const sec of snapshot.sections) {
    if (selector && !(sec.classes ?? "").includes(selector) && !(sec.ariaLabel ?? "").includes(selector)) {
      continue;
    }
    return (sec.classes ?? "").split(/\s+/).filter(Boolean);
  }
  return [];
}

/* ================================================================== */
/*  Fix Generation Rules                                               */
/* ================================================================== */

interface FixRule {
  name: string;
  /** Which root cause types this rule handles */
  causeTypes: string[];
  /** Generate a fix suggestion */
  generate: (
    issue: DetectedIssue,
    cause: RootCause,
    classes: string[],
    history: FixHistoryEntry[],
  ) => Omit<FixSuggestion, "id" | "status" | "verification"> | null;
}

const FIX_RULES: FixRule[] = [
  /* ── Fixed width causing overflow ────────────────────────────── */
  {
    name: "fix-overflow-fixed-width",
    causeTypes: ["fixed-width-class"],
    generate: (issue, cause, classes, history) => {
      const fixedWidth = classes.find((c) => /^w-\[/.test(c) || (/^w-\d+$/.test(c) && !c.includes("full")));
      if (!fixedWidth) return null;

      return {
        issueId: issue.id,
        rootCauseId: cause.issueId,
        description: `Replace fixed width "${fixedWidth}" with "w-full max-w-full" on ${issue.selector ?? "element"}.`,
        confidence: adjustConfidence(85, "overflow-fixed-width", history),
        impact: "medium",
        patch: {
          file: cause.file ?? "apps/web/lib/renderer.tsx",
          search: fixedWidth,
          replace: "w-full max-w-full",
          classChange: {
            selector: issue.selector ?? "unknown",
            remove: [fixedWidth],
            add: ["w-full", "max-w-full"],
          },
        },
        metadata: {
          category: issue.category,
          issueType: "overflow-fixed-width",
          severity: issue.severity,
          route: issue.source.route,
          device: issue.source.device,
          screenshotBefore: issue.screenshot,
        },
      };
    },
  },

  /* ── Overflow — add overflow-hidden to root ──────────────────── */
  {
    name: "fix-overflow-page",
    causeTypes: ["overflow-unknown", "negative-margin"],
    generate: (issue, cause, _classes, history) => ({
      issueId: issue.id,
      rootCauseId: cause.issueId,
      description: "Add overflow-x-hidden to root layout body to prevent horizontal scroll.",
      confidence: adjustConfidence(65, "overflow-page", history),
      impact: "high",
      patch: {
        file: "apps/web/app/layout.tsx",
        classChange: {
          selector: "body",
          remove: [],
          add: ["overflow-x-hidden"],
        },
      },
      metadata: {
        category: issue.category,
        issueType: "overflow-page",
        severity: issue.severity,
        route: issue.source.route,
        device: issue.source.device,
      },
    }),
  },

  /* ── Stretched image — add object-cover ──────────────────────── */
  {
    name: "fix-stretched-image",
    causeTypes: ["missing-object-fit"],
    generate: (issue, cause, _classes, history) => ({
      issueId: issue.id,
      rootCauseId: cause.issueId,
      description: `Add "object-cover" to ${issue.selector ?? "img"} to preserve aspect ratio.`,
      confidence: adjustConfidence(88, "stretched-image", history),
      impact: "low",
      patch: {
        file: cause.file ?? "apps/web/lib/renderer.tsx",
        classChange: {
          selector: issue.selector ?? "img",
          remove: [],
          add: ["object-cover"],
        },
      },
      metadata: {
        category: issue.category,
        issueType: "stretched-image",
        severity: issue.severity,
        route: issue.source.route,
        device: issue.source.device,
      },
    }),
  },

  /* ── Broken image — add fallback ─────────────────────────────── */
  {
    name: "fix-broken-image",
    causeTypes: ["invalid-image-url"],
    generate: (issue, cause, _classes, history) => ({
      issueId: issue.id,
      rootCauseId: cause.issueId,
      description: "Add fallback placeholder for broken images. Verify image URL is correct.",
      confidence: adjustConfidence(35, "broken-image", history),
      impact: "medium",
      patch: {
        file: cause.file ?? "apps/web/lib/renderer.tsx",
        diff: `- <img src={url} />\n+ <img src={url || "/images/placeholder.svg"} alt="..." onError={(e) => { e.currentTarget.src = "/images/placeholder.svg"; }} />`,
      },
      metadata: {
        category: issue.category,
        issueType: "broken-image",
        severity: issue.severity,
        route: issue.source.route,
        device: issue.source.device,
      },
    }),
  },

  /* ── Excessive padding ───────────────────────────────────────── */
  {
    name: "fix-excessive-padding",
    causeTypes: ["excessive-padding"],
    generate: (issue, cause, classes, history) => {
      const bigPadding = classes.find((c) => /^py-(2[0-9]|3[0-9]|[4-9][0-9])$/.test(c));
      if (!bigPadding) return null;

      return {
        issueId: issue.id,
        rootCauseId: cause.issueId,
        description: `Replace "${bigPadding}" with responsive padding "py-10 sm:py-14 md:py-20".`,
        confidence: adjustConfidence(78, "excessive-padding", history),
        impact: "low",
        patch: {
          file: cause.file ?? "apps/web/lib/renderer.tsx",
          search: bigPadding,
          replace: "py-10 sm:py-14 md:py-20",
          classChange: {
            selector: issue.selector ?? "section",
            remove: [bigPadding],
            add: ["py-10", "sm:py-14", "md:py-20"],
          },
        },
        metadata: {
          category: issue.category,
          issueType: "excessive-padding",
          severity: issue.severity,
          route: issue.source.route,
          device: issue.source.device,
        },
      };
    },
  },

  /* ── Missing form label ──────────────────────────────────────── */
  {
    name: "fix-missing-form-label",
    causeTypes: ["missing-form-label"],
    generate: (issue, cause, _classes, history) => ({
      issueId: issue.id,
      rootCauseId: cause.issueId,
      description: `Add aria-label or associated <label> element to form input at ${issue.selector ?? "unknown"}.`,
      confidence: adjustConfidence(80, "missing-form-label", history),
      impact: "medium",
      patch: {
        file: cause.file ?? "apps/web/lib/renderer.tsx",
        classChange: {
          selector: issue.selector ?? "input",
          remove: [],
          add: [],
        },
        diff: `- <select ...>\n+ <select aria-label="Select option" ...>`,
      },
      metadata: {
        category: issue.category,
        issueType: "missing-form-label",
        severity: issue.severity,
        route: issue.source.route,
        device: issue.source.device,
      },
    }),
  },

  /* ── Component crash: undefined prop ─────────────────────────── */
  {
    name: "fix-undefined-prop",
    causeTypes: ["missing-prop"],
    generate: (issue, cause, _classes, history) => {
      const propMatch = issue.message.match(/(?:property|properties) '(\w+)'/i);
      const propName = propMatch?.[1] ?? "unknownProp";

      return {
        issueId: issue.id,
        rootCauseId: cause.issueId,
        description: `Add null check / default value for "${propName}" in the component. Example: {data?.${propName} ?? "Default"}`,
        confidence: adjustConfidence(60, "undefined-prop", history),
        impact: "high",
        patch: {
          file: cause.file ?? "apps/web/lib/renderer.tsx",
          diff: `- {data.${propName}}\n+ {data?.${propName} ?? ""}`,
        },
        metadata: {
          category: issue.category,
          issueType: "undefined-prop",
          severity: issue.severity,
        },
      };
    },
  },

  /* ── Infinite render loop ────────────────────────────────────── */
  {
    name: "fix-infinite-loop",
    causeTypes: ["state-update-in-render"],
    generate: (issue, cause, _classes, history) => ({
      issueId: issue.id,
      rootCauseId: cause.issueId,
      description: "Fix infinite re-render loop. Add proper dependency array to useEffect, or move state update out of render cycle.",
      confidence: adjustConfidence(40, "infinite-loop", history),
      impact: "high",
      patch: {
        file: cause.file ?? "unknown",
        diff: "- useEffect(() => { setState(newVal); }); // missing deps\n+ useEffect(() => { setState(newVal); }, [dependency]); // proper deps",
      },
      metadata: {
        category: issue.category,
        issueType: "infinite-loop",
        severity: issue.severity,
      },
    }),
  },
];

/* ================================================================== */
/*  Fix Generator Entry Point                                          */
/* ================================================================== */

let fixCounter = 0;

/**
 * Generate fix suggestions for all detected issues with their root causes.
 */
export function generateFixes(
  issues: DetectedIssue[],
  rootCauses: RootCause[],
): FixSuggestion[] {
  fixCounter = 0;
  const history = loadHistory();
  const fixes: FixSuggestion[] = [];

  // Build a map of issueId → rootCause for fast lookup
  const causeMap = new Map<string, RootCause>();
  for (const cause of rootCauses) {
    causeMap.set(cause.issueId, cause);
  }

  for (const issue of issues) {
    const cause = causeMap.get(issue.id);
    if (!cause) continue;

    // Find the matching fix rule
    for (const rule of FIX_RULES) {
      if (!rule.causeTypes.includes(cause.causeType)) continue;

      try {
        const snapshot = loadSnapshot(issue.source.route, issue.source.device);
        const classes = extractClasses(snapshot, issue.selector);

        const result = rule.generate(issue, cause, classes, history);
        if (result) {
          fixes.push({
            ...result,
            id: `sh-fix-${++fixCounter}`,
            status: "suggested",
          });
        }
      } catch (err) {
        console.error(`[self-healing] Fix rule "${rule.name}" failed for issue ${issue.id}:`, err);
      }
      break; // First matching rule wins
    }
  }

  return fixes;
}
