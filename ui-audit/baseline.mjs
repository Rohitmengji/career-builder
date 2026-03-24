#!/usr/bin/env node
/**
 * UI Audit — Baseline Manager
 *
 * Usage:
 *   node ui-audit/baseline.mjs save      — save current screenshots as baseline
 *   node ui-audit/baseline.mjs compare   — compare current vs baseline (pixel diff)
 *   node ui-audit/baseline.mjs clean     — delete baseline
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const ROOT = path.resolve(import.meta.dirname || ".", "..");
const SCREENSHOTS = path.join(ROOT, "ui-audit", "screenshots");
const BASELINE = path.join(ROOT, "ui-audit", "baseline");

const cmd = process.argv[2];

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

if (cmd === "save") {
  if (!fs.existsSync(SCREENSHOTS)) {
    console.error("❌ No screenshots found. Run `npm run ui:audit` first.");
    process.exit(1);
  }
  if (fs.existsSync(BASELINE)) fs.rmSync(BASELINE, { recursive: true });
  copyDir(SCREENSHOTS, BASELINE);
  const count = fs.readdirSync(BASELINE, { recursive: true }).filter(f => String(f).endsWith(".png")).length;
  console.log(`✅ Saved ${count} screenshots as baseline.`);
} else if (cmd === "compare") {
  if (!fs.existsSync(BASELINE)) {
    console.error("❌ No baseline found. Run `node ui-audit/baseline.mjs save` first.");
    process.exit(1);
  }
  if (!fs.existsSync(SCREENSHOTS)) {
    console.error("❌ No current screenshots. Run `npm run ui:audit` first.");
    process.exit(1);
  }
  console.log("📊 Comparing current screenshots against baseline...\n");

  let changed = 0;
  let added = 0;
  let removed = 0;
  let same = 0;

  function walkDir(dir, base = "") {
    const files = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = path.join(base, entry.name);
      if (entry.isDirectory()) files.push(...walkDir(path.join(dir, entry.name), rel));
      else if (entry.name.endsWith(".png")) files.push(rel);
    }
    return files;
  }

  const baselineFiles = new Set(walkDir(BASELINE));
  const currentFiles = new Set(walkDir(SCREENSHOTS));

  for (const file of currentFiles) {
    if (!baselineFiles.has(file)) {
      console.log(`  🆕  NEW: ${file}`);
      added++;
    } else {
      const baseData = fs.readFileSync(path.join(BASELINE, file));
      const currData = fs.readFileSync(path.join(SCREENSHOTS, file));
      if (Buffer.compare(baseData, currData) !== 0) {
        const sizeDiff = currData.length - baseData.length;
        console.log(`  🔄  CHANGED: ${file} (${sizeDiff > 0 ? "+" : ""}${sizeDiff} bytes)`);
        changed++;
      } else {
        same++;
      }
      baselineFiles.delete(file);
    }
  }

  for (const file of baselineFiles) {
    console.log(`  ❌  REMOVED: ${file}`);
    removed++;
  }

  console.log(`\n  Summary: ${same} same, ${changed} changed, ${added} new, ${removed} removed`);
  if (changed > 0 || added > 0 || removed > 0) {
    console.log("  ⚠️  Visual differences detected. Review the screenshots.");
    process.exit(1);
  } else {
    console.log("  ✅  No visual regressions detected.");
  }
} else if (cmd === "clean") {
  if (fs.existsSync(BASELINE)) {
    fs.rmSync(BASELINE, { recursive: true });
    console.log("🧹 Baseline removed.");
  } else {
    console.log("Nothing to clean.");
  }
} else {
  console.log("Usage: node ui-audit/baseline.mjs <save|compare|clean>");
}
