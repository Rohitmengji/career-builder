/**
 * UI Audit — Main Playwright Test Suite (v2)
 *
 * Improvements:
 *   - Scrolls page to trigger lazy images / IntersectionObservers
 *   - Waits for all images to load before capturing
 *   - Per-section screenshots for component-level audit
 *   - DOM snapshot for each route (for AI fix analysis)
 *   - Gracefully skips routes that need admin API
 *
 * Run:  npm run ui:audit
 */

import { test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import * as fs from "fs";
import * as path from "path";
import {
  ROUTES,
  type UIIssue,
  type A11yViolation,
  type PerfMetrics,
  type AuditReport,
} from "../config";
import {
  resetIssueCounter,
  detectOverflow,
  detectImageIssues,
  detectLayoutIssues,
  detectTouchTargets,
  collectPerformance,
} from "../detectors";

/* ------------------------------------------------------------------ */
/*  Shared state                                                       */
/* ------------------------------------------------------------------ */

const allIssues: UIIssue[] = [];
const allA11y: A11yViolation[] = [];
const allPerf: PerfMetrics[] = [];
const allScreenshots: string[] = [];

const ROOT = path.resolve(__dirname, "../..");
const SCREENSHOTS_DIR = path.join(ROOT, "ui-audit", "screenshots");
const REPORTS_DIR = path.join(ROOT, "ui-audit", "reports");
const SNAPSHOTS_DIR = path.join(ROOT, "ui-audit", "snapshots");

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function ensureDir(dir: string) { fs.mkdirSync(dir, { recursive: true }); }

function slug(routePath: string): string {
  return routePath === "/" ? "homepage" : routePath.replace(/\//g, "-").replace(/^-/, "");
}

function ssPath(routePath: string, device: string, suffix = ""): string {
  const dir = path.join(SCREENSHOTS_DIR, slug(routePath));
  ensureDir(dir);
  return path.join(dir, `${device}${suffix ? `-${suffix}` : ""}.png`);
}

function isMobile(name: string): boolean {
  return name.includes("mobile") || name.includes("iphone");
}

/** Scroll the entire page to trigger IntersectionObservers & lazy loads */
async function scrollFullPage(page: import("@playwright/test").Page) {
  await page.evaluate(async () => {
    const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
    const step = 400;
    const h = document.body.scrollHeight;
    for (let y = 0; y < h; y += step) {
      window.scrollBy(0, step);
      await delay(120);
    }
    window.scrollTo(0, 0);
    await delay(300);
  });
}

/** Wait for all visible <img> to finish loading */
async function waitForImages(page: import("@playwright/test").Page) {
  await page.evaluate(() =>
    Promise.all(
      Array.from(document.images)
        .filter(img => !img.complete && img.getBoundingClientRect().width > 0)
        .map(img => new Promise<void>(resolve => {
          img.onload = img.onerror = () => resolve();
          setTimeout(resolve, 5000);
        }))
    )
  );
}

/** Capture per-section screenshots */
async function captureSections(
  page: import("@playwright/test").Page,
  routePath: string,
  device: string,
): Promise<string[]> {
  const paths: string[] = [];
  const vw = await page.evaluate(() => window.innerWidth);

  const sections = await page.evaluate(() => {
    const out: { idx: number; top: number; height: number; label: string }[] = [];
    document.querySelectorAll("section, nav, footer, [role='region'], [role='contentinfo'], main").forEach((el, idx) => {
      const r = el.getBoundingClientRect();
      if (r.height < 20) return;
      const heading = el.querySelector("h1, h2, h3");
      const label = heading?.textContent?.trim().slice(0, 40) || el.getAttribute("aria-label")?.slice(0, 40) || el.tagName.toLowerCase();
      out.push({ idx, top: r.top + window.scrollY, height: r.height, label });
    });
    return out;
  });

  for (const s of sections.slice(0, 25)) {
    const name = s.label.replace(/[^a-zA-Z0-9]/g, "-").replace(/-+/g, "-").toLowerCase().slice(0, 30);
    const p = ssPath(routePath, device, `section-${s.idx}-${name}`);
    try {
      await page.screenshot({
        path: p,
        clip: { x: 0, y: s.top, width: vw, height: Math.min(s.height, 2000) },
      });
      paths.push(path.relative(ROOT, p));
    } catch { /* off-screen */ }
  }
  return paths;
}

/** Capture DOM snapshot for AI analysis */
async function captureDOMSnapshot(
  page: import("@playwright/test").Page,
  routePath: string,
  device: string,
) {
  const snapshot = await page.evaluate(() => {
    const secs: any[] = [];
    document.querySelectorAll("section, nav, footer, main").forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.height < 20) return;
      const cs = window.getComputedStyle(el);
      secs.push({
        tag: el.tagName.toLowerCase(),
        ariaLabel: el.getAttribute("aria-label") || "",
        classes: el.className?.toString() || "",
        html: el.outerHTML.slice(0, 3000),
        rect: { width: Math.round(r.width), height: Math.round(r.height), top: Math.round(r.top + window.scrollY) },
        computed: {
          display: cs.display, padding: cs.padding, margin: cs.margin,
          overflow: cs.overflow, overflowX: cs.overflowX,
        },
      });
    });
    return {
      url: window.location.href,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      body: { scrollWidth: document.body.scrollWidth, scrollHeight: document.body.scrollHeight },
      sectionCount: secs.length,
      sections: secs,
    };
  });

  const dir = path.join(SNAPSHOTS_DIR, slug(routePath));
  ensureDir(dir);
  fs.writeFileSync(path.join(dir, `${device}.json`), JSON.stringify(snapshot, null, 2));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

test.beforeAll(() => {
  resetIssueCounter();
  ensureDir(SCREENSHOTS_DIR);
  ensureDir(REPORTS_DIR);
  ensureDir(SNAPSHOTS_DIR);
});

for (const route of ROUTES) {
  test.describe(`${route.label} (${route.path})`, () => {

    test("screenshot + layout audit", async ({ page }, testInfo) => {
      const device = testInfo.project.name;

      const res = await page.goto(route.path, { waitUntil: "domcontentloaded", timeout: 30_000 });
      if (!res || res.status() >= 400) {
        console.log(`  ⏭️  ${route.path} @ ${device}: Skipped (HTTP ${res?.status() || "no response"})`);
        return;
      }

      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
      await scrollFullPage(page);
      await waitForImages(page);
      await page.waitForTimeout(400);

      // 1. Full-page
      const fp = ssPath(route.path, device, "full");
      await page.screenshot({ path: fp, fullPage: true, timeout: 15_000 });
      allScreenshots.push(path.relative(ROOT, fp));

      // 2. Viewport
      const vp = ssPath(route.path, device, "viewport");
      await page.screenshot({ path: vp, fullPage: false });
      allScreenshots.push(path.relative(ROOT, vp));

      // 3. Per-section
      const sectionPaths = await captureSections(page, route.path, device);
      allScreenshots.push(...sectionPaths);

      // 4. DOM snapshot
      await captureDOMSnapshot(page, route.path, device);

      // 5. Detectors
      const o = await detectOverflow(page, route.path, device);
      const img = await detectImageIssues(page, route.path, device);
      const lay = await detectLayoutIssues(page, route.path, device);
      const touch = await detectTouchTargets(page, route.path, device, isMobile(device));
      const { metrics, issues: perf } = await collectPerformance(page, route.path, device);

      allPerf.push({ route: route.path, device, ...metrics });
      const all = [...o, ...img, ...lay, ...touch, ...perf];
      for (const issue of all) issue.screenshot = path.relative(ROOT, fp);
      allIssues.push(...all);

      if (all.length > 0) {
        console.log(`\n  ⚠️  ${route.path} @ ${device}: ${all.length} issue(s)`);
        for (const i of all.slice(0, 8)) {
          const ic = i.severity === "critical" ? "🔴" : i.severity === "major" ? "🟠" : i.severity === "minor" ? "🟡" : "🔵";
          console.log(`     ${ic} [${i.severity}] ${i.message}`);
        }
        if (all.length > 8) console.log(`     ... +${all.length - 8} more`);
      } else {
        console.log(`\n  ✅  ${route.path} @ ${device}: No issues`);
      }
    });

    test("accessibility audit", async ({ page }, testInfo) => {
      const device = testInfo.project.name;
      const res = await page.goto(route.path, { waitUntil: "domcontentloaded", timeout: 30_000 });
      if (!res || res.status() >= 400) return;
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      await page.waitForTimeout(400);

      try {
        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze();

        for (const v of results.violations) {
          allA11y.push({
            route: route.path, device,
            id: v.id, impact: v.impact || "unknown",
            description: v.description, helpUrl: v.helpUrl,
            nodes: v.nodes.length,
            selectors: v.nodes.slice(0, 5).map(n => n.target.join(" > ")),
          });
        }

        const count = results.violations.length;
        if (count > 0) {
          console.log(`\n  ♿  ${route.path} @ ${device}: ${count} a11y violation(s)`);
          for (const v of results.violations.slice(0, 5)) {
            const ic = v.impact === "critical" ? "🔴" : v.impact === "serious" ? "🟠" : "🟡";
            console.log(`     ${ic} [${v.impact}] ${v.id}: ${v.description} (${v.nodes.length})`);
          }
        } else {
          console.log(`\n  ♿  ${route.path} @ ${device}: Clean ✅`);
        }
      } catch (e) {
        console.log(`\n  ♿  ${route.path} @ ${device}: axe skipped`);
      }
    });
  });
}

/* ------------------------------------------------------------------ */
/*  Report                                                             */
/* ------------------------------------------------------------------ */

test.afterAll(async () => {
  const report: AuditReport = {
    timestamp: new Date().toISOString(),
    duration: 0,
    routes: ROUTES.map(r => r.path),
    devices: ["mobile-se", "mobile-14", "tablet", "laptop", "desktop"],
    totalIssues: allIssues.length,
    critical: allIssues.filter(i => i.severity === "critical").length,
    major: allIssues.filter(i => i.severity === "major").length,
    minor: allIssues.filter(i => i.severity === "minor").length,
    info: allIssues.filter(i => i.severity === "info").length,
    issues: allIssues,
    accessibility: allA11y,
    performance: allPerf,
    screenshots: allScreenshots,
  };

  ensureDir(REPORTS_DIR);
  fs.writeFileSync(path.join(REPORTS_DIR, "ui-audit.json"), JSON.stringify(report, null, 2));

  const md = buildMarkdown(report);
  fs.writeFileSync(path.join(REPORTS_DIR, "ui-audit.md"), md);

  console.log("\n" + "═".repeat(60));
  console.log("  📊  UI AUDIT REPORT");
  console.log("═".repeat(60));
  console.log(`  📸  Screenshots: ${allScreenshots.length}`);
  console.log(`  🐛  Issues: ${report.totalIssues}`);
  if (report.critical) console.log(`     🔴  Critical: ${report.critical}`);
  if (report.major) console.log(`     🟠  Major: ${report.major}`);
  if (report.minor) console.log(`     🟡  Minor: ${report.minor}`);
  if (report.info) console.log(`     🔵  Info: ${report.info}`);
  console.log(`  ♿  A11y: ${allA11y.length}`);
  console.log(`  ⚡  Perf: ${allPerf.length} pages`);
  console.log(`  📄  ui-audit/reports/ui-audit.json`);
  console.log(`  📝  ui-audit/reports/ui-audit.md`);
  console.log("═".repeat(60) + "\n");
});

function buildMarkdown(r: AuditReport): string {
  const L: string[] = [];
  L.push("# 📊 UI Audit Report\n");
  L.push(`**Generated:** ${r.timestamp}  `);
  L.push(`**Routes:** ${r.routes.join(", ")}  `);
  L.push(`**Screenshots:** ${r.screenshots.length}\n`);
  L.push("## Summary\n");
  L.push("| Metric | Count |\n|--------|-------|\n");
  L.push(`| Issues | ${r.totalIssues} |\n| 🔴 Critical | ${r.critical} |\n| 🟠 Major | ${r.major} |\n| 🟡 Minor | ${r.minor} |\n| 🔵 Info | ${r.info} |\n| ♿ A11y | ${r.accessibility.length} |\n`);

  if (r.issues.length) {
    L.push("\n## 🐛 Issues\n");
    for (const i of r.issues) {
      const ic = i.severity === "critical" ? "🔴" : i.severity === "major" ? "🟠" : i.severity === "minor" ? "🟡" : "🔵";
      L.push(`- ${ic} **[${i.severity}]** ${i.route} @ ${i.device}: ${i.message}`);
      if (i.selector) L.push(`  - \`${i.selector}\``);
      if (i.suggestedFix) L.push(`  - 💡 ${i.suggestedFix}`);
    }
  }

  if (r.accessibility.length) {
    L.push("\n## ♿ Accessibility\n");
    for (const v of r.accessibility) {
      const ic = v.impact === "critical" ? "🔴" : v.impact === "serious" ? "🟠" : "🟡";
      L.push(`- ${ic} **${v.id}** (${v.impact}) ${v.route}@${v.device}: ${v.description} (${v.nodes} nodes)`);
    }
  }

  if (r.performance.length) {
    L.push("\n## ⚡ Performance\n");
    L.push("| Route | Device | CLS | Load | DCL |\n|---|---|---|---|---|\n");
    for (const p of r.performance) L.push(`| ${p.route} | ${p.device} | ${p.cls} | ${p.loadTime}ms | ${p.domContentLoaded}ms |`);
  }

  L.push("\n## 📸 Screenshots\n");
  for (const s of r.screenshots) L.push(`- \`${s}\``);
  return L.join("\n");
}
