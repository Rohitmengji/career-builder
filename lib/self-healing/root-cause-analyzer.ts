/**
 * Self-Healing System — Root Cause Analyzer
 *
 * Maps detected issues to their most likely root cause using pattern-based
 * rules and contextual analysis (DOM snapshots, Tailwind classes, etc.).
 *
 * Each rule provides:
 *   - A match condition (which issue types it handles)
 *   - An analysis function that returns a RootCause with confidence
 *
 * The analyzer uses DOM snapshots when available to boost confidence.
 */

import * as fs from "fs";
import * as path from "path";
import type { DetectedIssue, RootCause } from "./types";

const ROOT = path.resolve(__dirname, "../..");
const SNAPSHOTS_DIR = path.join(ROOT, "ui-audit", "snapshots");

/* ================================================================== */
/*  DOM Snapshot Context                                               */
/* ================================================================== */

interface SnapshotContext {
  classes: string[];
  computed: Record<string, string>;
  html: string;
}

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

function extractContext(snapshot: any, selector?: string): SnapshotContext | null {
  if (!snapshot?.sections) return null;
  for (const sec of snapshot.sections) {
    if (selector && !(sec.classes ?? "").includes(selector) && !(sec.ariaLabel ?? "").includes(selector)) {
      continue;
    }
    return {
      classes: (sec.classes ?? "").split(/\s+/).filter(Boolean),
      computed: sec.computed ?? {},
      html: (sec.html ?? "").slice(0, 500),
    };
  }
  return null;
}

/* ================================================================== */
/*  Root Cause Rules                                                   */
/* ================================================================== */

interface CauseRule {
  name: string;
  matches: (issue: DetectedIssue) => boolean;
  analyze: (issue: DetectedIssue, ctx: SnapshotContext | null) => RootCause | null;
}

const CAUSE_RULES: CauseRule[] = [
  /* ── Overflow caused by fixed width ──────────────────────────── */
  {
    name: "overflow-fixed-width",
    matches: (i) => i.type === "overflow",
    analyze: (issue, ctx) => {
      const classes = ctx?.classes ?? [];
      const fixedWidth = classes.find((c) => /^w-\[/.test(c) || (/^w-\d+$/.test(c) && !c.includes("full")));

      if (fixedWidth) {
        return {
          issueId: issue.id,
          causeType: "fixed-width-class",
          explanation: `Element has fixed width class "${fixedWidth}" which exceeds viewport on smaller screens. Responsive classes are needed.`,
          confidence: 85,
          file: "apps/web/lib/renderer.tsx",
          codeContext: `class="${classes.join(" ")}"`,
        };
      }

      // Check for negative margins
      const negMargin = classes.find((c) => /^-m[lrx]-/.test(c));
      if (negMargin) {
        return {
          issueId: issue.id,
          causeType: "negative-margin",
          explanation: `Element uses negative margin "${negMargin}" causing content to extend beyond viewport.`,
          confidence: 70,
          file: "apps/web/lib/renderer.tsx",
          codeContext: `class="${classes.join(" ")}"`,
        };
      }

      return {
        issueId: issue.id,
        causeType: "overflow-unknown",
        explanation: "Element extends beyond viewport. Fixed width, negative margins, or absolute positioning may be the cause.",
        confidence: 40,
      };
    },
  },

  /* ── Broken image — invalid URL ──────────────────────────────── */
  {
    name: "broken-image-url",
    matches: (i) => i.type === "broken-image",
    analyze: (issue) => ({
      issueId: issue.id,
      causeType: "invalid-image-url",
      explanation: "Image src attribute points to a resource that failed to load. URL may be incorrect, the server may be unreachable, or the image was deleted.",
      confidence: 60,
      file: "apps/web/lib/renderer.tsx",
    }),
  },

  /* ── Stretched image — missing object-fit ────────────────────── */
  {
    name: "stretched-image",
    matches: (i) => i.type === "stretched-image",
    analyze: (issue, ctx) => {
      const hasObjectFit = (ctx?.classes ?? []).some((c) => c.startsWith("object-"));
      return {
        issueId: issue.id,
        causeType: hasObjectFit ? "wrong-object-fit" : "missing-object-fit",
        explanation: hasObjectFit
          ? "Image has object-fit but the container dimensions force distortion."
          : "Image is missing object-fit property, causing aspect ratio distortion when container doesn't match natural dimensions.",
        confidence: hasObjectFit ? 40 : 85,
        file: "apps/web/lib/renderer.tsx",
      };
    },
  },

  /* ── Collapsed section — empty or hidden content ─────────────── */
  {
    name: "collapsed-section",
    matches: (i) => i.type === "collapsed-section",
    analyze: (issue, ctx) => {
      const html = ctx?.html ?? "";
      const isEmpty = html.trim().length < 50;

      return {
        issueId: issue.id,
        causeType: isEmpty ? "empty-section" : "hidden-content",
        explanation: isEmpty
          ? "Section has no meaningful content — block data may be missing or the block renders empty."
          : "Section has content but it appears hidden (display:none, visibility:hidden, or zero-height children).",
        confidence: isEmpty ? 75 : 50,
        file: "apps/web/lib/renderer.tsx",
      };
    },
  },

  /* ── Excessive whitespace — large padding ────────────────────── */
  {
    name: "excessive-whitespace",
    matches: (i) => i.type === "excessive-whitespace",
    analyze: (issue, ctx) => {
      const classes = ctx?.classes ?? [];
      const bigPadding = classes.find((c) => /^py-(2[0-9]|3[0-9]|[4-9][0-9])$/.test(c));

      if (bigPadding) {
        return {
          issueId: issue.id,
          causeType: "excessive-padding",
          explanation: `Section has large fixed padding "${bigPadding}" causing disproportionate whitespace relative to content.`,
          confidence: 78,
          file: "apps/web/lib/renderer.tsx",
          codeContext: `class="${classes.join(" ")}"`,
        };
      }

      return {
        issueId: issue.id,
        causeType: "excessive-whitespace-unknown",
        explanation: "Section height is much larger than content height. Likely excessive padding or empty space.",
        confidence: 45,
      };
    },
  },

  /* ── Undefined prop — component crash ────────────────────────── */
  {
    name: "undefined-prop",
    matches: (i) => i.type === "undefined-prop",
    analyze: (issue) => {
      // Try to extract the property name from the error message
      const propMatch = issue.message.match(/(?:property|properties) '(\w+)'/i);
      const propName = propMatch?.[1] ?? "unknown";

      return {
        issueId: issue.id,
        causeType: "missing-prop",
        explanation: `Component tried to access property "${propName}" on undefined/null. Block data may be missing the field, or the prop wasn't passed down from the renderer.`,
        confidence: 70,
        file: issue.source.file ?? "apps/web/lib/renderer.tsx",
        line: issue.source.line,
      };
    },
  },

  /* ── Hydration mismatch ──────────────────────────────────────── */
  {
    name: "hydration-mismatch",
    matches: (i) => i.type === "hydration-mismatch",
    analyze: (issue) => ({
      issueId: issue.id,
      causeType: "hydration-mismatch",
      explanation: "Server-rendered HTML doesn't match client-rendered HTML. Common causes: browser-only APIs used during render, Date/Math.random(), or conditional rendering based on window.",
      confidence: 60,
      file: issue.source.file,
    }),
  },

  /* ── Infinite render loop ────────────────────────────────────── */
  {
    name: "infinite-loop",
    matches: (i) => i.type === "infinite-loop",
    analyze: (issue) => ({
      issueId: issue.id,
      causeType: "state-update-in-render",
      explanation: "Component exceeded maximum re-renders. Likely caused by setState inside useEffect without proper dependency array, or unconditional state updates.",
      confidence: 80,
      file: issue.source.file,
    }),
  },

  /* ── API timeout ─────────────────────────────────────────────── */
  {
    name: "api-timeout",
    matches: (i) => i.type === "api-timeout",
    analyze: (issue) => ({
      issueId: issue.id,
      causeType: "api-timeout",
      explanation: `API call to ${(issue.details?.url as string) ?? "unknown"} exceeded timeout. Server may be overloaded, DB query may be slow, or network issue.`,
      confidence: 55,
    }),
  },

  /* ── API server error (5xx) ──────────────────────────────────── */
  {
    name: "api-server-error",
    matches: (i) => i.type === "api-server-error",
    analyze: (issue) => ({
      issueId: issue.id,
      causeType: "server-error",
      explanation: `Server returned ${(issue.details?.statusCode as number) ?? 500}. Check server logs for the specific error. Common causes: uncaught exceptions, DB connection failure, missing env vars.`,
      confidence: 50,
    }),
  },

  /* ── Accessibility: color contrast ───────────────────────────── */
  {
    name: "a11y-color-contrast",
    matches: (i) => i.category === "accessibility" && i.type === "color-contrast",
    analyze: (issue) => ({
      issueId: issue.id,
      causeType: "poor-color-contrast",
      explanation: "Text/background color combination doesn't meet WCAG AA contrast ratio (4.5:1 for normal text, 3:1 for large text).",
      confidence: 75,
      file: "apps/web/lib/renderer.tsx",
    }),
  },

  /* ── Accessibility: missing form labels ──────────────────────── */
  {
    name: "a11y-form-label",
    matches: (i) => i.category === "accessibility" && (i.type === "label" || i.type === "select-name"),
    analyze: (issue) => ({
      issueId: issue.id,
      causeType: "missing-form-label",
      explanation: "Form element is missing an associated label. Screen readers cannot identify the purpose of this input.",
      confidence: 85,
      file: "apps/web/lib/renderer.tsx",
    }),
  },

  /* ── Generic console error fallback ──────────────────────────── */
  {
    name: "console-error-generic",
    matches: (i) => i.category === "console-error",
    analyze: (issue) => ({
      issueId: issue.id,
      causeType: "unhandled-error",
      explanation: `Unhandled browser error: ${issue.message.slice(0, 100)}. Check the error stack for the source.`,
      confidence: 30,
      file: issue.source.file,
      line: issue.source.line,
    }),
  },
];

/* ================================================================== */
/*  Analyzer Entry Point                                               */
/* ================================================================== */

/**
 * Analyze all detected issues and produce root cause explanations.
 */
export function analyzeRootCauses(issues: DetectedIssue[]): RootCause[] {
  const rootCauses: RootCause[] = [];

  for (const issue of issues) {
    // Load DOM snapshot if we have route/device info
    const snapshot = loadSnapshot(issue.source.route, issue.source.device);
    const ctx = extractContext(snapshot, issue.selector);

    for (const rule of CAUSE_RULES) {
      if (rule.matches(issue)) {
        try {
          const cause = rule.analyze(issue, ctx);
          if (cause) {
            rootCauses.push(cause);
          }
        } catch (err) {
          console.error(`[self-healing] Root cause rule "${rule.name}" failed for issue ${issue.id}:`, err);
        }
        break; // First matching rule wins
      }
    }
  }

  return rootCauses;
}
