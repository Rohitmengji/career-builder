/**
 * UI Audit — DOM-based Issue Detectors
 *
 * These functions run inside the browser context via page.evaluate().
 * They inspect the live DOM for layout, spacing, image, and overflow issues.
 */

import type { Page } from "@playwright/test";
import type { UIIssue, Severity } from "./config";

let issueCounter = 0;
function nextId(): string {
  return `issue-${++issueCounter}`;
}

/** Reset counter between runs */
export function resetIssueCounter() {
  issueCounter = 0;
}

/* ================================================================== */
/*  1. Horizontal Overflow Detection                                   */
/* ================================================================== */

export async function detectOverflow(
  page: Page,
  route: string,
  device: string,
): Promise<UIIssue[]> {
  const issues: UIIssue[] = [];

  const overflow = await page.evaluate(() => {
    const vw = window.innerWidth;
    const bodyWidth = document.body.scrollWidth;
    const hasOverflow = bodyWidth > vw + 2; // 2px tolerance

    // Find elements causing overflow
    const offenders: { tag: string; selector: string; right: number; width: number }[] = [];
    if (hasOverflow) {
      const all = document.querySelectorAll("*");
      all.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.right > vw + 4 || rect.left < -4) {
          const selector =
            el.id ? `#${el.id}` :
            el.className && typeof el.className === "string"
              ? `${el.tagName.toLowerCase()}.${el.className.split(" ").filter(Boolean).slice(0, 2).join(".")}`
              : el.tagName.toLowerCase();
          offenders.push({
            tag: el.tagName.toLowerCase(),
            selector,
            right: Math.round(rect.right),
            width: Math.round(rect.width),
          });
        }
      });
    }

    return { hasOverflow, bodyWidth, viewportWidth: vw, offenders: offenders.slice(0, 10) };
  });

  if (overflow.hasOverflow) {
    issues.push({
      id: nextId(),
      route,
      device,
      category: "layout",
      type: "overflow",
      severity: "critical",
      message: `Page has horizontal overflow: body=${overflow.bodyWidth}px, viewport=${overflow.viewportWidth}px`,
      details: { offenders: overflow.offenders },
      suggestedFix:
        "Add `overflow-x: hidden` to the body or fix the offending elements. " +
        "Common fixes: replace fixed widths with `w-full max-w-[…]`, add `overflow-hidden` to containers.",
    });

    for (const el of overflow.offenders.slice(0, 3)) {
      issues.push({
        id: nextId(),
        route,
        device,
        category: "layout",
        type: "overflow",
        severity: "major",
        message: `Element overflows viewport: <${el.tag}> right=${el.right}px (viewport=${overflow.viewportWidth}px)`,
        selector: el.selector,
        suggestedFix: `Add \`overflow-hidden\` or \`max-w-full\` to \`${el.selector}\``,
      });
    }
  }

  return issues;
}

/* ================================================================== */
/*  2. Image Issue Detection                                           */
/* ================================================================== */

export async function detectImageIssues(
  page: Page,
  route: string,
  device: string,
): Promise<UIIssue[]> {
  const issues: UIIssue[] = [];

  const imgResults = await page.evaluate(() => {
    const results: {
      src: string;
      broken: boolean;
      noAlt: boolean;
      stretched: boolean;
      naturalW: number;
      naturalH: number;
      displayW: number;
      displayH: number;
      selector: string;
    }[] = [];

    document.querySelectorAll("img").forEach((img) => {
      const rect = img.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return; // hidden

      const selector = img.alt
        ? `img[alt="${img.alt.slice(0, 30)}"]`
        : img.src
          ? `img[src*="${img.src.split("/").pop()?.slice(0, 20)}"]`
          : "img";

      const naturalRatio = img.naturalWidth / (img.naturalHeight || 1);
      const displayRatio = rect.width / (rect.height || 1);
      const stretched = img.naturalWidth > 0 && Math.abs(naturalRatio - displayRatio) > 0.3;

      results.push({
        src: img.src?.slice(0, 100) || "",
        broken: img.naturalWidth === 0 && img.complete,
        noAlt: !img.alt || img.alt.trim() === "",
        stretched,
        naturalW: img.naturalWidth,
        naturalH: img.naturalHeight,
        displayW: Math.round(rect.width),
        displayH: Math.round(rect.height),
        selector,
      });
    });

    return results;
  });

  for (const img of imgResults) {
    if (img.broken) {
      issues.push({
        id: nextId(),
        route,
        device,
        category: "media",
        type: "image",
        severity: "major",
        message: `Broken image: ${img.src}`,
        selector: img.selector,
        suggestedFix: "Check image URL is correct and accessible. Add a fallback placeholder.",
      });
    }
    if (img.stretched) {
      issues.push({
        id: nextId(),
        route,
        device,
        category: "media",
        type: "image",
        severity: "minor",
        message: `Image appears stretched: natural=${img.naturalW}×${img.naturalH}, display=${img.displayW}×${img.displayH}`,
        selector: img.selector,
        suggestedFix: "Add `object-cover` or `object-contain` to preserve aspect ratio.",
      });
    }
  }

  return issues;
}

/* ================================================================== */
/*  3. Layout / Spacing Issue Detection                                */
/* ================================================================== */

export async function detectLayoutIssues(
  page: Page,
  route: string,
  device: string,
): Promise<UIIssue[]> {
  const issues: UIIssue[] = [];

  const layoutData = await page.evaluate(() => {
    const vw = window.innerWidth;
    const results: {
      overlaps: { a: string; b: string; overlapArea: number }[];
      collapsedSections: { selector: string; height: number }[];
      excessiveWhitespace: { selector: string; height: number; childHeight: number }[];
    } = { overlaps: [], collapsedSections: [], excessiveWhitespace: [] };

    // Check sections for collapsed heights
    const sections = document.querySelectorAll("section, [role='region']");
    sections.forEach((section) => {
      const rect = section.getBoundingClientRect();
      if (rect.height < 10 && rect.width > 0) {
        const sel = section.id ? `#${section.id}` : section.className
          ? `section.${String(section.className).split(" ").filter(Boolean).slice(0, 2).join(".")}`
          : "section";
        results.collapsedSections.push({ selector: sel, height: Math.round(rect.height) });
      }
    });

    // Check for excessive whitespace in sections (section height >> total child heights)
    sections.forEach((section) => {
      const rect = section.getBoundingClientRect();
      if (rect.height < 100) return;
      let childHeight = 0;
      const children = section.children;
      for (let i = 0; i < children.length; i++) {
        childHeight += children[i].getBoundingClientRect().height;
      }
      const ratio = rect.height / (childHeight || 1);
      if (ratio > 3 && rect.height > 400) {
        const sel = section.id ? `#${section.id}` : "section";
        results.excessiveWhitespace.push({
          selector: sel,
          height: Math.round(rect.height),
          childHeight: Math.round(childHeight),
        });
      }
    });

    return results;
  });

  for (const s of layoutData.collapsedSections) {
    issues.push({
      id: nextId(),
      route,
      device,
      category: "layout",
      type: "layout",
      severity: "major",
      message: `Section appears collapsed (height=${s.height}px): ${s.selector}`,
      selector: s.selector,
      suggestedFix: "Check if the section has content or if its children have display:none.",
    });
  }

  for (const w of layoutData.excessiveWhitespace) {
    issues.push({
      id: nextId(),
      route,
      device,
      category: "spacing",
      type: "spacing",
      severity: "minor",
      message: `Excessive whitespace: section=${w.height}px but content=${w.childHeight}px (${w.selector})`,
      selector: w.selector,
      suggestedFix: "Reduce section padding or check for hidden/empty child elements.",
    });
  }

  return issues;
}

/* ================================================================== */
/*  4. Touch Target Detection (Mobile)                                 */
/* ================================================================== */

export async function detectTouchTargets(
  page: Page,
  route: string,
  device: string,
  isMobile: boolean,
): Promise<UIIssue[]> {
  if (!isMobile) return [];
  const issues: UIIssue[] = [];

  const smallTargets = await page.evaluate(() => {
    const results: { selector: string; width: number; height: number }[] = [];
    const interactive = document.querySelectorAll("a, button, input, select, textarea, [role='button'], [tabindex]");
    interactive.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return; // hidden
      if (rect.width < 44 || rect.height < 44) {
        // Check if it's actually visible
        const style = window.getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return;
        const tag = el.tagName.toLowerCase();
        const sel = el.id ? `#${el.id}` : `${tag}${el.className && typeof el.className === "string" ? "." + el.className.split(" ").filter(Boolean).slice(0, 2).join(".") : ""}`;
        results.push({ selector: sel, width: Math.round(rect.width), height: Math.round(rect.height) });
      }
    });
    return results.slice(0, 15); // cap to avoid noise
  });

  for (const t of smallTargets) {
    issues.push({
      id: nextId(),
      route,
      device,
      category: "layout",
      type: "layout",
      severity: "info",
      message: `Touch target too small (${t.width}×${t.height}px, minimum 44×44px): ${t.selector}`,
      selector: t.selector,
      suggestedFix: `Add \`min-w-[44px] min-h-[44px]\` or increase padding on \`${t.selector}\``,
    });
  }

  return issues;
}

/* ================================================================== */
/*  5. Performance Metrics                                             */
/* ================================================================== */

export async function collectPerformance(
  page: Page,
  route: string,
  device: string,
): Promise<{ metrics: { cls: number; loadTime: number; domContentLoaded: number }; issues: UIIssue[] }> {
  const metrics = await page.evaluate(() => {
    const perf = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    let cls = 0;
    try {
      const entries = performance.getEntriesByType("layout-shift") as any[];
      cls = entries.reduce((sum, e) => sum + (e.hadRecentInput ? 0 : e.value), 0);
    } catch { /* CLS API not available */ }

    return {
      cls: Math.round(cls * 1000) / 1000,
      loadTime: perf ? Math.round(perf.loadEventEnd - perf.startTime) : 0,
      domContentLoaded: perf ? Math.round(perf.domContentLoadedEventEnd - perf.startTime) : 0,
    };
  });

  const issues: UIIssue[] = [];
  if (metrics.cls > 0.1) {
    issues.push({
      id: nextId(),
      route,
      device,
      category: "performance",
      type: "performance" as any,
      severity: metrics.cls > 0.25 ? "critical" : "major",
      message: `Cumulative Layout Shift (CLS) is ${metrics.cls} (threshold: 0.1)`,
      suggestedFix: "Add explicit width/height to images and embeds. Avoid dynamically injected content above the fold.",
    });
  }

  return { metrics, issues };
}
