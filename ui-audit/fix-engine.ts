/**
 * UI Audit — Production Self-Healing Fix Engine
 *
 * Architecture:
 *   1. Load audit report + DOM snapshots
 *   2. Classify each issue → root cause via pattern rules
 *   3. Generate minimal Tailwind fix with confidence score (0-100)
 *   4. [apply]  Backup file → apply patch → mark applied
 *   5. [verify] Re-run Playwright on affected route → accept or rollback
 *   6. [rollback] Undo all applied patches from backups
 *   7. [status] Show pipeline state + fix history
 *
 * CLI:
 *   npx tsx ui-audit/fix-engine.ts suggest   — analyze + generate fixes
 *   npx tsx ui-audit/fix-engine.ts apply     — apply safe fixes (confidence ≥ 80)
 *   npx tsx ui-audit/fix-engine.ts verify    — re-audit, accept or rollback
 *   npx tsx ui-audit/fix-engine.ts rollback  — undo all applied patches
 *   npx tsx ui-audit/fix-engine.ts status    — show pipeline summary + history
 */

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import type {
  AuditReport,
  UIIssue,
  FixSuggestion,
  FixReport,
  FixHistoryEntry,
} from "./config";

/* ================================================================== */
/*  Paths                                                              */
/* ================================================================== */

const ROOT = path.resolve(__dirname, "..");
const REPORTS_DIR = path.join(ROOT, "ui-audit", "reports");
const SNAPSHOTS_DIR = path.join(ROOT, "ui-audit", "snapshots");
const PATCHES_DIR = path.join(ROOT, "ui-audit", "patches");
const BACKUPS_DIR = path.join(ROOT, "ui-audit", "backups");
const HISTORY_PATH = path.join(REPORTS_DIR, "fix-history.json");

function ensureDir(d: string) {
  fs.mkdirSync(d, { recursive: true });
}

/* ================================================================== */
/*  DOM Snapshot Helpers                                                */
/* ================================================================== */

/**
 * Extract Tailwind class context from a DOM snapshot for smarter analysis.
 */
function extractTailwindContext(
  snapshot: any,
  selector?: string,
): { classes: string[]; computed: Record<string, string>; html: string } | null {
  if (!snapshot?.sections) return null;
  for (const sec of snapshot.sections) {
    if (
      selector &&
      !(sec.classes || "").includes(selector) &&
      !(sec.ariaLabel || "").includes(selector)
    )
      continue;
    return {
      classes: (sec.classes || "").split(/\s+/).filter(Boolean),
      computed: sec.computed || {},
      html: (sec.html || "").slice(0, 500),
    };
  }
  return null;
}

/* ================================================================== */
/*  Fix Rules — Pattern-Based Root Cause + Confidence Scoring          */
/* ================================================================== */

interface FixRule {
  name: string;
  matches: (issue: UIIssue) => boolean;
  analyze: (
    issue: UIIssue,
    ctx: ReturnType<typeof extractTailwindContext>,
    history: FixHistoryEntry[],
  ) => Omit<FixSuggestion, "id" | "status" | "screenshotBefore" | "screenshotAfter" | "verified" | "verifyResult"> | null;
}

/**
 * Boost or penalize confidence based on past fix history for the same issue type.
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

const FIX_RULES: FixRule[] = [
  /* ── Critical: Page-Level Horizontal Overflow ──────────────── */
  {
    name: "overflow-page",
    matches: (i) => i.type === "overflow" && i.severity === "critical",
    analyze: (issue, _ctx, history) => ({
      issueId: issue.id,
      route: issue.route,
      device: issue.device,
      issueType: "overflow-page",
      severity: issue.severity,
      rootCause:
        "Page body scrollWidth exceeds viewport width. An element has fixed width or negative margins causing horizontal scroll.",
      description:
        "Add overflow-x-hidden to root layout body to prevent horizontal scroll.",
      confidence: adjustConfidence(70, "overflow-page", history),
      impact: "high" as const,
      file: "apps/web/app/layout.tsx",
      classChange: { selector: "body", remove: [], add: ["overflow-x-hidden"] },
    }),
  },

  /* ── Major: Element Overflow ───────────────────────────────── */
  {
    name: "overflow-element",
    matches: (i) => i.type === "overflow" && i.severity === "major",
    analyze: (issue, ctx, history) => {
      const classes = ctx?.classes || [];
      const fixedWidth = classes.find(
        (c) => /^w-\[/.test(c) || (/^w-\d+$/.test(c) && !c.includes("full")),
      );

      if (fixedWidth) {
        return {
          issueId: issue.id,
          route: issue.route,
          device: issue.device,
          issueType: "overflow-fixed-width",
          severity: issue.severity,
          rootCause: `Element has fixed width class "${fixedWidth}" which exceeds viewport on small screens.`,
          description: `Replace "${fixedWidth}" with "w-full max-w-full" on ${issue.selector}.`,
          confidence: adjustConfidence(85, "overflow-fixed-width", history),
          impact: "medium" as const,
          file: "apps/web/lib/renderer.tsx",
          search: fixedWidth,
          replace: "w-full max-w-full",
          classChange: {
            selector: issue.selector || "unknown",
            remove: [fixedWidth],
            add: ["w-full", "max-w-full"],
          },
        };
      }

      return {
        issueId: issue.id,
        route: issue.route,
        device: issue.device,
        issueType: "overflow-element",
        severity: issue.severity,
        rootCause: `Element ${issue.selector} extends beyond viewport. May need overflow-hidden or max-w constraint.`,
        description: `Add overflow-hidden to the container of ${issue.selector}.`,
        confidence: adjustConfidence(55, "overflow-element", history),
        impact: "medium" as const,
        file: "apps/web/lib/renderer.tsx",
        classChange: {
          selector: issue.selector || "unknown",
          remove: [],
          add: ["overflow-hidden", "max-w-full"],
        },
      };
    },
  },

  /* ── Broken Image ──────────────────────────────────────────── */
  {
    name: "broken-image",
    matches: (i) => i.type === "image" && i.message.includes("Broken"),
    analyze: (issue, _ctx, history) => ({
      issueId: issue.id,
      route: issue.route,
      device: issue.device,
      issueType: "broken-image",
      severity: issue.severity,
      rootCause: "Image failed to load — src may be invalid or server unreachable.",
      description:
        "Verify image URL. Add fallback placeholder in the LazyImage component.",
      confidence: adjustConfidence(35, "broken-image", history),
      impact: "medium" as const,
      file: "apps/web/lib/renderer.tsx",
    }),
  },

  /* ── Stretched Image ───────────────────────────────────────── */
  {
    name: "stretched-image",
    matches: (i) => i.type === "image" && i.message.includes("stretched"),
    analyze: (issue, ctx, history) => {
      const hasObjectFit = (ctx?.classes || []).some((c) => c.startsWith("object-"));
      return {
        issueId: issue.id,
        route: issue.route,
        device: issue.device,
        issueType: "stretched-image",
        severity: issue.severity,
        rootCause: "Image display ratio doesn't match natural ratio. Missing object-fit.",
        description: `Add "object-cover" to ${issue.selector} to preserve aspect ratio.`,
        confidence: adjustConfidence(hasObjectFit ? 25 : 90, "stretched-image", history),
        impact: "low" as const,
        file: "apps/web/lib/renderer.tsx",
        classChange: {
          selector: issue.selector || "img",
          remove: [],
          add: ["object-cover"],
        },
      };
    },
  },

  /* ── Collapsed Section ─────────────────────────────────────── */
  {
    name: "collapsed-section",
    matches: (i) => i.type === "layout" && i.message.includes("collapsed"),
    analyze: (issue, _ctx, history) => ({
      issueId: issue.id,
      route: issue.route,
      device: issue.device,
      issueType: "collapsed-section",
      severity: issue.severity,
      rootCause: "Section has near-zero height. Content may be hidden or not rendering.",
      description: `Investigate ${issue.selector} — check if children have display:none or if data is empty.`,
      confidence: adjustConfidence(25, "collapsed-section", history),
      impact: "high" as const,
      file: "apps/web/lib/renderer.tsx",
    }),
  },

  /* ── Excessive Whitespace ──────────────────────────────────── */
  {
    name: "excessive-whitespace",
    matches: (i) => i.type === "spacing",
    analyze: (issue, ctx, history) => {
      const classes = ctx?.classes || [];
      const bigPadding = classes.find((c) =>
        /^py-(2[0-9]|3[0-9]|[4-9][0-9])$/.test(c),
      );

      if (bigPadding) {
        return {
          issueId: issue.id,
          route: issue.route,
          device: issue.device,
          issueType: "excessive-padding",
          severity: issue.severity,
          rootCause: `Section has large fixed padding "${bigPadding}" causing disproportionate whitespace.`,
          description: `Replace "${bigPadding}" with responsive padding "py-10 sm:py-14 md:py-20".`,
          confidence: adjustConfidence(78, "excessive-padding", history),
          impact: "low" as const,
          file: "apps/web/lib/renderer.tsx",
          search: bigPadding,
          replace: "py-10 sm:py-14 md:py-20",
          classChange: {
            selector: issue.selector || "section",
            remove: [bigPadding],
            add: ["py-10", "sm:py-14", "md:py-20"],
          },
        };
      }

      return {
        issueId: issue.id,
        route: issue.route,
        device: issue.device,
        issueType: "excessive-whitespace",
        severity: issue.severity,
        rootCause:
          "Section height is much larger than content height — likely excessive padding.",
        description: `Reduce vertical padding on ${issue.selector}.`,
        confidence: adjustConfidence(45, "excessive-whitespace", history),
        impact: "low" as const,
        file: "apps/web/lib/renderer.tsx",
      };
    },
  },

  /* ── Touch Target Too Small ────────────────────────────────── */
  {
    name: "touch-target",
    matches: (i) => i.type === "layout" && i.message.includes("Touch target"),
    analyze: (issue, _ctx, history) => {
      const match = issue.message.match(/(\d+)×(\d+)px/);
      const w = match ? parseInt(match[1]) : 0;
      const h = match ? parseInt(match[2]) : 0;
      return {
        issueId: issue.id,
        route: issue.route,
        device: issue.device,
        issueType: "touch-target",
        severity: issue.severity,
        rootCause: `Interactive element is ${w}×${h}px, below 44×44px WCAG minimum.`,
        description: `Increase size of ${issue.selector} with padding or min-width/height.`,
        confidence: adjustConfidence(62, "touch-target", history),
        impact: "low" as const,
        file: "apps/web/lib/renderer.tsx",
        classChange: {
          selector: issue.selector || "unknown",
          remove: [],
          add: [
            ...(h < 44 ? ["min-h-[44px]"] : []),
            ...(w < 44 ? ["min-w-[44px]"] : []),
            "py-2.5",
            "px-3",
          ],
        },
      };
    },
  },

  /* ── CLS Performance ───────────────────────────────────────── */
  {
    name: "cls",
    matches: (i) => (i.type as string) === "performance" && i.message.includes("CLS"),
    analyze: (issue, _ctx, history) => ({
      issueId: issue.id,
      route: issue.route,
      device: issue.device,
      issueType: "cls",
      severity: issue.severity,
      rootCause: "High Cumulative Layout Shift — elements shifting after initial paint.",
      description:
        "Add explicit dimensions to images/iframes. Avoid inserting content above the fold after load.",
      confidence: adjustConfidence(35, "cls", history),
      impact: "medium" as const,
      file: "apps/web/lib/renderer.tsx",
    }),
  },
];

/* ================================================================== */
/*  Persistence Helpers                                                */
/* ================================================================== */

function loadReport(): AuditReport | null {
  const p = path.join(REPORTS_DIR, "ui-audit.json");
  if (!fs.existsSync(p)) {
    console.error("❌ No audit report found. Run `npm run ui:audit` first.");
    return null;
  }
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

function loadSnapshot(route: string, device: string): any | null {
  const slug =
    route === "/" ? "homepage" : route.replace(/\//g, "-").replace(/^-/, "");
  const p = path.join(SNAPSHOTS_DIR, slug, `${device}.json`);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf-8")) : null;
}

function loadHistory(): FixHistoryEntry[] {
  return fs.existsSync(HISTORY_PATH)
    ? JSON.parse(fs.readFileSync(HISTORY_PATH, "utf-8"))
    : [];
}

function saveHistory(entries: FixHistoryEntry[]) {
  ensureDir(REPORTS_DIR);
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(entries, null, 2));
}

function loadFixes(): FixSuggestion[] | null {
  const p = path.join(REPORTS_DIR, "fixes.json");
  if (!fs.existsSync(p)) return null;
  const report: FixReport = JSON.parse(fs.readFileSync(p, "utf-8"));
  return report.fixes;
}

function saveFixes(fixes: FixSuggestion[]) {
  ensureDir(REPORTS_DIR);
  const report = buildReport(fixes);
  fs.writeFileSync(path.join(REPORTS_DIR, "fixes.json"), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(REPORTS_DIR, "fixes.md"), buildMarkdown(fixes));
}

/* ================================================================== */
/*  Analysis Engine                                                    */
/* ================================================================== */

function analyze(report: AuditReport): FixSuggestion[] {
  const fixes: FixSuggestion[] = [];
  let id = 0;
  const history = loadHistory();

  for (const issue of report.issues) {
    for (const rule of FIX_RULES) {
      if (rule.matches(issue)) {
        const snapshot = loadSnapshot(issue.route, issue.device);
        const ctx = extractTailwindContext(snapshot, issue.selector);
        const result = rule.analyze(issue, ctx, history);
        if (result) {
          fixes.push({
            ...result,
            id: `fix-${++id}`,
            status: "suggested",
            screenshotBefore: issue.screenshot,
          });
        }
        break; // first matching rule wins
      }
    }
  }

  // A11y violations → suggestions
  for (const v of report.accessibility) {
    fixes.push({
      id: `fix-${++id}`,
      issueId: `a11y-${v.id}`,
      route: v.route,
      device: v.device,
      issueType: `a11y-${v.id}`,
      severity: v.impact,
      rootCause: `Accessibility: ${v.id} (${v.impact}) — ${v.description}`,
      description: `Fix ${v.id}: ${v.description}. See ${v.helpUrl}`,
      confidence:
        v.id === "color-contrast"
          ? adjustConfidence(45, `a11y-${v.id}`, history)
          : v.id === "select-name"
            ? adjustConfidence(82, `a11y-${v.id}`, history)
            : adjustConfidence(40, `a11y-${v.id}`, history),
      impact: v.impact === "critical" ? "high" : v.impact === "serious" ? "medium" : "low",
      file: "apps/web/lib/renderer.tsx",
      classChange:
        v.selectors.length > 0
          ? { selector: v.selectors[0], remove: [], add: [] }
          : undefined,
      status: "suggested",
    });
  }

  return fixes;
}

/* ================================================================== */
/*  Safe Apply System (backup → patch → mark applied)                  */
/* ================================================================== */

function backupFile(filePath: string): string {
  ensureDir(BACKUPS_DIR);
  const abs = path.resolve(ROOT, filePath);
  if (!fs.existsSync(abs)) throw new Error(`File not found: ${abs}`);
  const backupName =
    filePath.replace(/\//g, "__") + `.${Date.now()}.bak`;
  const backupPath = path.join(BACKUPS_DIR, backupName);
  fs.copyFileSync(abs, backupPath);
  return backupPath;
}

function restoreLatestBackup(filePath: string): boolean {
  const prefix = filePath.replace(/\//g, "__") + ".";
  if (!fs.existsSync(BACKUPS_DIR)) return false;
  const backups = fs
    .readdirSync(BACKUPS_DIR)
    .filter((f) => f.startsWith(prefix) && f.endsWith(".bak"))
    .sort()
    .reverse();
  if (backups.length === 0) return false;
  const abs = path.resolve(ROOT, filePath);
  fs.copyFileSync(path.join(BACKUPS_DIR, backups[0]), abs);
  console.log(`  🔄 Restored: ${filePath} from backup`);
  return true;
}

function applyPatch(fix: FixSuggestion): boolean {
  if (!fix.search || !fix.replace) {
    fix.status = "skipped";
    return false;
  }
  const abs = path.resolve(ROOT, fix.file);
  if (!fs.existsSync(abs)) {
    fix.status = "failed";
    return false;
  }
  const content = fs.readFileSync(abs, "utf-8");
  if (!content.includes(fix.search)) {
    fix.status = "skipped";
    return false;
  }
  // Only replace FIRST occurrence for safety
  const updated = content.replace(fix.search, fix.replace);
  fs.writeFileSync(abs, updated);
  fix.status = "applied";
  return true;
}

/* ================================================================== */
/*  Report Generation                                                  */
/* ================================================================== */

function buildReport(fixes: FixSuggestion[]): FixReport {
  return {
    timestamp: new Date().toISOString(),
    totalIssues: fixes.length,
    totalFixes: fixes.length,
    applied: fixes.filter((f) => f.status === "applied").length,
    verified: fixes.filter((f) => f.status === "verified").length,
    failed: fixes.filter((f) => f.status === "failed").length,
    skipped: fixes.filter((f) => f.status === "skipped").length,
    fixes,
  };
}

function buildMarkdown(fixes: FixSuggestion[]): string {
  const L: string[] = [];
  L.push("# 🔧 Self-Healing Fix Report\n");
  L.push(`**Generated:** ${new Date().toISOString()}  `);
  L.push(`**Total Candidates:** ${fixes.length}\n`);

  // Pipeline summary
  const cnt = (s: string) => fixes.filter((f) => f.status === s).length;
  L.push("## Pipeline Status\n");
  L.push("| Status | Count |");
  L.push("|--------|-------|");
  L.push(`| 💡 Suggested | ${cnt("suggested")} |`);
  L.push(`| ✅ Applied | ${cnt("applied")} |`);
  L.push(`| ✔️ Verified | ${cnt("verified")} |`);
  L.push(`| ❌ Failed | ${cnt("failed")} |`);
  L.push(`| ⏭️ Skipped | ${cnt("skipped")} |`);
  L.push(`| 🔄 Rolled Back | ${cnt("rolled-back")} |`);
  L.push("");

  // Confidence distribution
  L.push("## Confidence Distribution\n");
  L.push("| Range | Count | Auto-applicable? |");
  L.push("|-------|-------|------------------|");
  L.push(
    `| 80-100 (High) | ${fixes.filter((f) => f.confidence >= 80).length} | ✅ Yes |`,
  );
  L.push(
    `| 60-79 (Medium) | ${fixes.filter((f) => f.confidence >= 60 && f.confidence < 80).length} | ⚠️ Review |`,
  );
  L.push(
    `| 0-59 (Low) | ${fixes.filter((f) => f.confidence < 60).length} | ❌ Manual |`,
  );
  L.push("");

  // Per-fix details
  L.push("## Fix Details\n");
  for (const f of fixes) {
    const icon =
      f.status === "verified"
        ? "✅"
        : f.status === "applied"
          ? "🔄"
          : f.status === "failed"
            ? "❌"
            : f.status === "skipped"
              ? "⏭️"
              : f.status === "rolled-back"
                ? "🔙"
                : "💡";
    const bar =
      "█".repeat(Math.floor(f.confidence / 10)) +
      "░".repeat(10 - Math.floor(f.confidence / 10));

    L.push(`### ${icon} ${f.id} — ${f.issueType}`);
    L.push("");
    L.push("| Property | Value |");
    L.push("|----------|-------|");
    L.push(`| Route | \`${f.route}\` @ ${f.device} |`);
    L.push(`| Severity | ${f.severity} |`);
    L.push(`| Confidence | ${bar} ${f.confidence}% |`);
    L.push(`| Impact | ${f.impact} |`);
    L.push(`| Status | ${f.status} |`);
    L.push(`| File | \`${f.file}\` |`);
    L.push("");
    L.push(`**Root Cause:** ${f.rootCause}`);
    L.push("");
    L.push(`**Fix:** ${f.description}`);
    if (f.classChange) {
      L.push("");
      L.push("```");
      L.push(`Selector: ${f.classChange.selector}`);
      if (f.classChange.remove.length)
        L.push(`Remove: ${f.classChange.remove.join(", ")}`);
      if (f.classChange.add.length)
        L.push(`Add:    ${f.classChange.add.join(", ")}`);
      L.push("```");
    }
    if (f.search && f.replace) {
      L.push("");
      L.push("```diff");
      L.push(`- ${f.search}`);
      L.push(`+ ${f.replace}`);
      L.push("```");
    }
    if (f.verifyResult) {
      L.push("");
      L.push(`**Verification:** ${f.verifyResult}`);
    }
    L.push("");
    L.push("---");
    L.push("");
  }

  return L.join("\n");
}

/* ================================================================== */
/*  CLI Commands                                                       */
/* ================================================================== */

/* ── suggest ──────────────────────────────────────────────────────── */

function cmdSuggest() {
  console.log("\n🤖 Self-Healing Engine — SUGGEST MODE\n");

  const report = loadReport();
  if (!report) process.exit(1);

  console.log(
    `📋 Audit: ${report.totalIssues} issues, ${report.accessibility.length} a11y violations\n`,
  );

  if (report.totalIssues === 0 && report.accessibility.length === 0) {
    console.log("✅ No issues found. UI is healthy!\n");
    return;
  }

  const fixes = analyze(report);
  console.log(`🔍 Generated ${fixes.length} fix candidates:\n`);

  for (const f of fixes) {
    const confIcon = f.confidence >= 80 ? "🟢" : f.confidence >= 60 ? "🟡" : "🔴";
    console.log(
      `  ${confIcon} [${f.id}] ${f.confidence}% — ${f.issueType} @ ${f.route}:${f.device}`,
    );
    console.log(`     ${f.description.slice(0, 100)}`);
  }

  const autoApplicable = fixes.filter(
    (f) => f.confidence >= 80 && f.search && f.replace,
  );
  console.log(
    `\n  📊 ${autoApplicable.length}/${fixes.length} fixes are auto-applicable (confidence ≥ 80 + has search/replace)`,
  );

  saveFixes(fixes);

  console.log(`\n📄 Reports:`);
  console.log(`   ui-audit/reports/fixes.json`);
  console.log(`   ui-audit/reports/fixes.md\n`);
}

/* ── apply ────────────────────────────────────────────────────────── */

function cmdApply() {
  console.log("\n🤖 Self-Healing Engine — APPLY MODE\n");

  const fixes = loadFixes();
  if (!fixes) {
    console.error("❌ No fixes.json. Run `npm run ui:fix` first.");
    return;
  }

  const history = loadHistory();

  // Filter: confidence ≥ 80, has search/replace, not already applied
  const candidates = fixes.filter(
    (f) =>
      f.status === "suggested" &&
      f.confidence >= 80 &&
      f.search &&
      f.replace,
  );

  if (candidates.length === 0) {
    console.log(
      "⏭️  No auto-applicable fixes (need confidence ≥ 80 + search/replace pattern).",
    );
    console.log("   Review ui-audit/reports/fixes.md for manual fixes.\n");
    return;
  }

  console.log(`🔧 Applying ${candidates.length} safe fixes:\n`);

  // Group by file for efficient backup
  const byFile = new Map<string, FixSuggestion[]>();
  for (const f of candidates) {
    if (!byFile.has(f.file)) byFile.set(f.file, []);
    byFile.get(f.file)!.push(f);
  }

  for (const [file, fileFixes] of byFile) {
    console.log(`\n  📁 ${file} (${fileFixes.length} fixes)`);

    // Backup before patching
    try {
      const bk = backupFile(file);
      console.log(`  💾 Backup: ${path.relative(ROOT, bk)}`);
    } catch (e) {
      console.log(`  ❌ Cannot backup ${file}: ${(e as Error).message}`);
      fileFixes.forEach((f) => (f.status = "failed"));
      continue;
    }

    for (const fix of fileFixes) {
      const applied = applyPatch(fix);
      console.log(
        applied
          ? `  ✅ [${fix.id}] Applied: "${fix.search}" → "${fix.replace}"`
          : `  ⏭️  [${fix.id}] Skipped (pattern not found)`,
      );

      history.push({
        id: fix.id,
        timestamp: new Date().toISOString(),
        action: applied ? "applied" : "skipped",
        file,
        result: applied ? "success" : "failure",
        issueType: fix.issueType,
        confidence: fix.confidence,
        description: fix.description,
      });
    }
  }

  saveHistory(history);
  saveFixes(fixes);

  const applied = fixes.filter((f) => f.status === "applied").length;
  const skipped = fixes.filter((f) => f.status === "skipped").length;
  console.log(`\n✅ Applied: ${applied} | Skipped: ${skipped}`);
  console.log(`\nNext: Run \`npm run ui:verify\` to validate the fixes.\n`);
}

/* ── verify ───────────────────────────────────────────────────────── */

function cmdVerify() {
  console.log("\n🤖 Self-Healing Engine — VERIFY MODE\n");

  const fixes = loadFixes();
  if (!fixes) {
    console.error("❌ No fixes.json. Run suggest → apply first.");
    return;
  }

  const applied = fixes.filter((f) => f.status === "applied");
  if (applied.length === 0) {
    console.log("⏭️  No applied fixes to verify.\n");
    return;
  }

  // Re-run full audit
  console.log("  📸 Re-running Playwright audit...");
  try {
    execSync(
      "npx playwright test --config=playwright.config.ts --project=desktop --project=mobile-se",
      { cwd: ROOT, stdio: "pipe", timeout: 120_000 },
    );
    console.log("  ✅ Audit completed.");
  } catch {
    console.log("  ⚠️  Audit completed with findings (expected).");
  }

  // Load fresh report
  const newReport = loadReport();
  if (!newReport) return;

  const history = loadHistory();
  let verified = 0;
  let failed = 0;

  for (const fix of applied) {
    // Check if the original issue type still exists for same route+device
    const baseType = fix.issueType.split("-")[0]; // e.g. "overflow" from "overflow-fixed-width"
    const stillExists = newReport.issues.some(
      (i) =>
        i.route === fix.route &&
        i.device === fix.device &&
        i.type === baseType,
    );

    if (!stillExists) {
      fix.status = "verified";
      fix.verified = true;
      fix.verifyResult = "Issue resolved after fix";
      verified++;
      console.log(`  ✅ [${fix.id}] Verified — issue resolved`);
    } else {
      fix.status = "failed";
      fix.verified = false;
      fix.verifyResult = "Issue still present — rolling back";
      failed++;
      console.log(`  ❌ [${fix.id}] Failed — rolling back`);

      // Auto-rollback
      if (restoreLatestBackup(fix.file)) {
        fix.status = "rolled-back";
      }
    }

    history.push({
      id: fix.id,
      timestamp: new Date().toISOString(),
      action: fix.status === "verified" ? "verified" : "rolled-back",
      file: fix.file,
      result: fix.status === "verified" ? "success" : "failure",
      issueType: fix.issueType,
      confidence: fix.confidence,
      description: fix.description,
    });
  }

  saveHistory(history);
  saveFixes(fixes);

  console.log(`\n📊 Results: ${verified} verified, ${failed} failed/rolled-back`);
  console.log(`📄 Updated: ui-audit/reports/fixes.md\n`);
}

/* ── rollback ─────────────────────────────────────────────────────── */

function cmdRollback() {
  console.log("\n🤖 Self-Healing Engine — ROLLBACK MODE\n");

  if (!fs.existsSync(BACKUPS_DIR)) {
    console.log("No backups found. Nothing to rollback.\n");
    return;
  }

  const backups = fs.readdirSync(BACKUPS_DIR).filter((f) => f.endsWith(".bak"));
  if (backups.length === 0) {
    console.log("No backups found.\n");
    return;
  }

  // Group by original file
  const byFile = new Map<string, string[]>();
  for (const b of backups) {
    const original = b.replace(/\.\d+\.bak$/, "").replace(/__/g, "/");
    if (!byFile.has(original)) byFile.set(original, []);
    byFile.get(original)!.push(b);
  }

  console.log(`🔄 Restoring ${byFile.size} file(s):\n`);
  for (const [file] of byFile) {
    const ok = restoreLatestBackup(file);
    console.log(ok ? `  ✅ ${file}` : `  ❌ ${file} — restore failed`);
  }

  // Update any applied fixes → rolled-back
  const fixes = loadFixes();
  if (fixes) {
    for (const f of fixes) {
      if (f.status === "applied") f.status = "rolled-back";
    }
    saveFixes(fixes);
  }

  console.log("\n✅ Rollback complete.\n");
}

/* ── status ───────────────────────────────────────────────────────── */

function cmdStatus() {
  console.log("\n🤖 Self-Healing Engine — STATUS\n");

  const fixes = loadFixes();
  if (fixes) {
    const cnt = (s: string) => fixes.filter((f) => f.status === s).length;
    console.log(`📄 Fix candidates: ${fixes.length}`);
    console.log(`   💡 Suggested:  ${cnt("suggested")}`);
    console.log(`   ✅ Applied:    ${cnt("applied")}`);
    console.log(`   ✔️  Verified:   ${cnt("verified")}`);
    console.log(`   ❌ Failed:     ${cnt("failed")}`);
    console.log(`   ⏭️  Skipped:    ${cnt("skipped")}`);
    console.log(`   🔄 Rolled-back: ${cnt("rolled-back")}`);

    // Confidence summary
    const high = fixes.filter((f) => f.confidence >= 80);
    const med = fixes.filter((f) => f.confidence >= 60 && f.confidence < 80);
    const low = fixes.filter((f) => f.confidence < 60);
    console.log(`\n📊 Confidence: ${high.length} high, ${med.length} medium, ${low.length} low`);
  } else {
    console.log("No fix report found. Run `npm run ui:fix` first.");
  }

  // History
  const history = loadHistory();
  if (history.length > 0) {
    console.log(`\n📜 Fix History (last 10):\n`);
    for (const h of history.slice(-10)) {
      const icon = h.result === "success" ? "✅" : "❌";
      console.log(
        `  ${icon} ${h.timestamp.slice(0, 16)} [${h.action}] ${h.id}: ${h.description.slice(0, 60)}`,
      );
    }
  }

  // Backups
  if (fs.existsSync(BACKUPS_DIR)) {
    const backups = fs.readdirSync(BACKUPS_DIR).filter((f) => f.endsWith(".bak"));
    if (backups.length > 0) console.log(`\n💾 Backups: ${backups.length} file(s)`);
  }

  console.log("");
}

/* ================================================================== */
/*  Main                                                               */
/* ================================================================== */

const cmd = process.argv[2] || "suggest";

switch (cmd) {
  case "suggest":
    cmdSuggest();
    break;
  case "apply":
    cmdApply();
    break;
  case "verify":
    cmdVerify();
    break;
  case "rollback":
    cmdRollback();
    break;
  case "status":
    cmdStatus();
    break;
  default:
    console.log(
      "Usage: npx tsx ui-audit/fix-engine.ts <suggest|apply|verify|rollback|status>",
    );
}

