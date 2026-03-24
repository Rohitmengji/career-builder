/**
 * Self-Healing System — Pipeline Orchestrator
 *
 * The main entry point that ties all components together:
 *   1. Collect inputs (Playwright, console, API, observability)
 *   2. Run detectors
 *   3. Analyze root causes
 *   4. Generate fixes
 *   5. Apply fixes (if mode allows)
 *   6. Verify fixes
 *   7. Generate report
 *   8. Update learning data
 *
 * CLI:
 *   npx tsx lib/self-healing/pipeline.ts detect     — detect issues only
 *   npx tsx lib/self-healing/pipeline.ts suggest     — detect + analyze + suggest fixes
 *   npx tsx lib/self-healing/pipeline.ts apply       — detect + analyze + apply safe fixes
 *   npx tsx lib/self-healing/pipeline.ts verify      — verify previously applied fixes
 *   npx tsx lib/self-healing/pipeline.ts rollback    — rollback all applied fixes
 *   npx tsx lib/self-healing/pipeline.ts status      — show current status
 *   npx tsx lib/self-healing/pipeline.ts learn       — show learning insights
 *   npx tsx lib/self-healing/pipeline.ts heal        — full pipeline: detect → fix → verify
 */

import * as fs from "fs";
import * as path from "path";
import { collectInputSources, listAvailableSources } from "./input-collector";
import { runAllDetectors } from "./detectors";
import { analyzeRootCauses } from "./root-cause-analyzer";
import { generateFixes } from "./fix-generator";
import { applyFixes, rollbackAll, generateDiff } from "./patch-applier";
import { verifyFixes } from "./verification";
import { buildReport, saveReport } from "./reporter";
import { analyzeLearningData, getLearningReport } from "./learning";
import type { FixSuggestion, FixMode, HealingReport } from "./types";

const ROOT = path.resolve(__dirname, "../..");
const REPORTS_DIR = path.join(ROOT, "ui-audit", "reports");

function ensureDir(d: string): void {
  fs.mkdirSync(d, { recursive: true });
}

/* ================================================================== */
/*  Pipeline: Detect                                                   */
/* ================================================================== */

async function cmdDetect(): Promise<void> {
  console.log("\n🩺 Self-Healing System — DETECT MODE\n");

  const sources = listAvailableSources();
  console.log(`📥 Available input sources: ${sources.join(", ") || "none"}\n`);

  const context = collectInputSources();
  const startTime = Date.now();

  const issues = await runAllDetectors(context);
  const duration = Date.now() - startTime;

  console.log(`🔍 Detected ${issues.length} issue(s) in ${duration}ms:\n`);

  // Summary by severity
  const critical = issues.filter((i) => i.severity === "critical").length;
  const major = issues.filter((i) => i.severity === "major").length;
  const minor = issues.filter((i) => i.severity === "minor").length;
  const info = issues.filter((i) => i.severity === "info").length;

  console.log(`   🔴 Critical: ${critical}`);
  console.log(`   🟠 Major:    ${major}`);
  console.log(`   🟡 Minor:    ${minor}`);
  console.log(`   🔵 Info:     ${info}`);

  // Summary by category
  const categories = new Map<string, number>();
  for (const issue of issues) {
    categories.set(issue.category, (categories.get(issue.category) ?? 0) + 1);
  }
  console.log("\n   By category:");
  for (const [cat, count] of categories) {
    console.log(`     ${cat}: ${count}`);
  }

  // Top issues
  if (issues.length > 0) {
    console.log("\n   Top issues:");
    for (const issue of issues.slice(0, 10)) {
      const icon = issue.severity === "critical" ? "🔴" : issue.severity === "major" ? "🟠" : "🟡";
      console.log(`     ${icon} [${issue.category}] ${issue.message.slice(0, 100)}`);
    }
  }

  // Save as minimal report
  const report = buildReport(issues, [], [], "suggestion", duration, sources);
  saveReport(report);
  console.log(`\n📄 Report saved to ui-audit/reports/self-healing-report.md\n`);
}

/* ================================================================== */
/*  Pipeline: Suggest                                                  */
/* ================================================================== */

async function cmdSuggest(): Promise<void> {
  console.log("\n🩺 Self-Healing System — SUGGEST MODE\n");

  const sources = listAvailableSources();
  const context = collectInputSources();
  const startTime = Date.now();

  // Step 1: Detect
  console.log("  🔍 Step 1/4: Detecting issues...");
  const issues = await runAllDetectors(context);
  console.log(`     Found ${issues.length} issue(s)\n`);

  if (issues.length === 0) {
    console.log("  ✅ No issues found. System is healthy!\n");
    return;
  }

  // Step 2: Root cause analysis
  console.log("  🧠 Step 2/4: Analyzing root causes...");
  const rootCauses = analyzeRootCauses(issues);
  console.log(`     Identified ${rootCauses.length} root cause(s)\n`);

  // Step 3: Generate fixes
  console.log("  🔧 Step 3/4: Generating fix suggestions...");
  const fixes = generateFixes(issues, rootCauses);
  console.log(`     Generated ${fixes.length} fix candidate(s)\n`);

  // Step 4: Save report
  console.log("  📊 Step 4/4: Generating report...");
  const duration = Date.now() - startTime;
  const report = buildReport(issues, rootCauses, fixes, "suggestion", duration, sources);
  saveReport(report);

  // Print fix summary
  console.log("\n  📋 Fix Candidates:\n");
  for (const fix of fixes) {
    const confIcon = fix.confidence >= 80 ? "🟢" : fix.confidence >= 60 ? "🟡" : "🔴";
    console.log(`     ${confIcon} [${fix.id}] ${fix.confidence}% — ${fix.metadata.issueType}`);
    console.log(`        ${fix.description.slice(0, 100)}`);
  }

  const autoApplicable = fixes.filter((f) => f.confidence >= 80 && f.patch.search && f.patch.replace);
  console.log(`\n  📊 ${autoApplicable.length}/${fixes.length} fixes are auto-applicable (confidence ≥ 80 + search/replace)`);
  console.log(`\n  📄 Reports saved to:`);
  console.log(`     ui-audit/reports/self-healing-report.md`);
  console.log(`     ui-audit/reports/self-healing-report.json`);
  console.log(`     ui-audit/reports/fixes.json\n`);
}

/* ================================================================== */
/*  Pipeline: Apply                                                    */
/* ================================================================== */

async function cmdApply(): Promise<void> {
  console.log("\n🩺 Self-Healing System — APPLY MODE\n");

  const sources = listAvailableSources();
  const context = collectInputSources();
  const startTime = Date.now();

  // Detect → Analyze → Generate → Apply
  console.log("  🔍 Detecting issues...");
  const issues = await runAllDetectors(context);

  if (issues.length === 0) {
    console.log("  ✅ No issues found. System is healthy!\n");
    return;
  }

  console.log(`     Found ${issues.length} issue(s)`);
  console.log("  🧠 Analyzing root causes...");
  const rootCauses = analyzeRootCauses(issues);

  console.log("  🔧 Generating fixes...");
  const fixes = generateFixes(issues, rootCauses);

  console.log(`  🛡️  Applying safe fixes (confidence ≥ 80)...\n`);
  const result = applyFixes(fixes, "auto-fix");

  console.log(`     ✅ Applied: ${result.applied.length}`);
  console.log(`     ⏭️  Skipped: ${result.skipped.length}`);
  console.log(`     ❌ Failed: ${result.failed.length}`);

  if (result.applied.length > 0) {
    console.log("\n     Applied fixes:");
    for (const fix of result.applied) {
      console.log(`       ✅ [${fix.id}] ${fix.description.slice(0, 80)}`);
    }
  }

  const duration = Date.now() - startTime;
  const report = buildReport(issues, rootCauses, fixes, "auto-fix", duration, sources);
  saveReport(report);

  console.log(`\n  📄 Report saved. Next: run \`npm run self-heal:verify\` to validate.\n`);
}

/* ================================================================== */
/*  Pipeline: Verify                                                   */
/* ================================================================== */

async function cmdVerify(): Promise<void> {
  console.log("\n🩺 Self-Healing System — VERIFY MODE\n");

  // Load existing fixes
  const fixesPath = path.join(REPORTS_DIR, "self-healing-report.json");
  if (!fs.existsSync(fixesPath)) {
    console.error("  ❌ No healing report found. Run suggest/apply first.\n");
    return;
  }

  let report: HealingReport;
  try {
    report = JSON.parse(fs.readFileSync(fixesPath, "utf-8"));
  } catch (err) {
    console.error("  ❌ Failed to parse healing report:", err);
    return;
  }

  const result = verifyFixes(report.fixes);

  console.log(`\n  📊 Verification Results:`);
  console.log(`     ✅ Verified: ${result.verified.length}`);
  console.log(`     ❌ Failed:   ${result.failed.length}`);
  console.log(`     🔄 Rolled back: ${result.rolledBack.length}`);

  // Update the report
  report.summary.verified = result.verified.length;
  report.summary.failed = result.failed.length;
  saveReport(report);

  console.log(`\n  📄 Updated report saved.\n`);
}

/* ================================================================== */
/*  Pipeline: Rollback                                                 */
/* ================================================================== */

async function cmdRollback(): Promise<void> {
  console.log("\n🩺 Self-Healing System — ROLLBACK MODE\n");

  const fixesPath = path.join(REPORTS_DIR, "self-healing-report.json");
  if (!fs.existsSync(fixesPath)) {
    console.log("  No healing report found. Nothing to rollback.\n");
    return;
  }

  let report: HealingReport;
  try {
    report = JSON.parse(fs.readFileSync(fixesPath, "utf-8"));
  } catch {
    console.log("  Failed to load report.\n");
    return;
  }

  const { restored, failed } = rollbackAll(report.fixes);

  if (restored.length > 0) {
    console.log("  🔄 Restored files:");
    for (const f of restored) {
      console.log(`     ✅ ${f}`);
    }
  }
  if (failed.length > 0) {
    console.log("  ❌ Failed to restore:");
    for (const f of failed) {
      console.log(`     ❌ ${f}`);
    }
  }
  if (restored.length === 0 && failed.length === 0) {
    console.log("  No applied fixes found to rollback.\n");
  }

  saveReport(report);
  console.log("\n  ✅ Rollback complete.\n");
}

/* ================================================================== */
/*  Pipeline: Status                                                   */
/* ================================================================== */

async function cmdStatus(): Promise<void> {
  console.log("\n🩺 Self-Healing System — STATUS\n");

  const fixesPath = path.join(REPORTS_DIR, "self-healing-report.json");
  if (!fs.existsSync(fixesPath)) {
    console.log("  No healing report found. Run `npm run self-heal` first.\n");
    return;
  }

  let report: HealingReport;
  try {
    report = JSON.parse(fs.readFileSync(fixesPath, "utf-8"));
  } catch {
    console.log("  Failed to load report.\n");
    return;
  }

  console.log(`  📋 Last run: ${report.timestamp}`);
  console.log(`     Mode: ${report.mode}`);
  console.log(`     Duration: ${report.duration}ms`);
  console.log(`     Issues: ${report.summary.totalIssues}`);
  console.log(`     Fixes: ${report.summary.totalFixes}`);
  console.log(`     ✅ Applied: ${report.summary.applied}`);
  console.log(`     ✔️  Verified: ${report.summary.verified}`);
  console.log(`     ❌ Failed: ${report.summary.failed}`);
  console.log(`     ⏭️  Skipped: ${report.summary.skipped}`);

  // Confidence distribution
  const high = report.fixes.filter((f) => f.confidence >= 80).length;
  const med = report.fixes.filter((f) => f.confidence >= 60 && f.confidence < 80).length;
  const low = report.fixes.filter((f) => f.confidence < 60).length;
  console.log(`\n  📊 Confidence: ${high} high, ${med} medium, ${low} low`);

  // Input sources
  console.log(`\n  📥 Input sources: ${report.inputSources.join(", ") || "none"}`);
  console.log("");
}

/* ================================================================== */
/*  Pipeline: Learn                                                    */
/* ================================================================== */

async function cmdLearn(): Promise<void> {
  console.log("\n🩺 Self-Healing System — LEARNING INSIGHTS\n");
  const report = getLearningReport();
  console.log(report);
}

/* ================================================================== */
/*  Pipeline: Full Heal                                                */
/* ================================================================== */

async function cmdHeal(): Promise<void> {
  console.log("\n🩺 Self-Healing System — FULL HEAL PIPELINE\n");
  console.log("  Phase 1: Detect + Analyze + Apply...");
  await cmdApply();
  console.log("  Phase 2: Verify...");
  await cmdVerify();
  console.log("  Phase 3: Learning...");
  await cmdLearn();
  console.log("\n  ✅ Full healing pipeline complete.\n");
}

/* ================================================================== */
/*  CLI Entry Point                                                    */
/* ================================================================== */

const COMMANDS: Record<string, () => Promise<void>> = {
  detect: cmdDetect,
  suggest: cmdSuggest,
  apply: cmdApply,
  verify: cmdVerify,
  rollback: cmdRollback,
  status: cmdStatus,
  learn: cmdLearn,
  heal: cmdHeal,
};

async function main(): Promise<void> {
  const cmd = process.argv[2] || "suggest";
  const handler = COMMANDS[cmd];

  if (!handler) {
    console.log("Usage: npx tsx lib/self-healing/pipeline.ts <command>\n");
    console.log("Commands:");
    console.log("  detect    — Detect issues only");
    console.log("  suggest   — Detect + analyze + suggest fixes (default)");
    console.log("  apply     — Detect + analyze + apply safe fixes");
    console.log("  verify    — Verify previously applied fixes");
    console.log("  rollback  — Rollback all applied fixes");
    console.log("  status    — Show current status");
    console.log("  learn     — Show learning insights");
    console.log("  heal      — Full pipeline: detect → apply → verify → learn");
    process.exit(1);
  }

  await handler();
}

main().catch((err) => {
  console.error("\n❌ Self-healing pipeline error:", err);
  process.exit(1);
});
