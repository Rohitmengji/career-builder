/*
 * Design System — Production-grade token layer & utilities.
 *
 * This module provides:
 *   1. Spacing scale — consistent, named spacing tokens
 *   2. Typography scale — semantic font sizes
 *   3. Breakpoints — mobile-first responsive system
 *   4. Z-index scale — predictable stacking
 *   5. Motion tokens — animation durations/easings
 *   6. Color contrast utilities — WCAG 2.1 AA compliance
 *   7. Safe rendering helpers — null/undefined guards
 *   8. SEO utilities — JSON-LD, heading hierarchy
 *   9. Performance utilities — image optimization, preload hints
 *  10. Accessibility constants — ARIA roles, screen reader text
 *
 * All tokens are composable and extend the existing tenant-config tokens.
 * No mutation of existing types — pure extension via composition.
 */

/* ================================================================== */
/*  1. Spacing Scale                                                   */
/* ================================================================== */

/** 4px base unit spacing scale */
export const spacing = {
  0: "0px",
  0.5: "2px",
  1: "4px",
  1.5: "6px",
  2: "8px",
  2.5: "10px",
  3: "12px",
  3.5: "14px",
  4: "16px",
  5: "20px",
  6: "24px",
  7: "28px",
  8: "32px",
  9: "36px",
  10: "40px",
  11: "44px",
  12: "48px",
  14: "56px",
  16: "64px",
  20: "80px",
  24: "96px",
  28: "112px",
  32: "128px",
} as const;

export type SpacingKey = keyof typeof spacing;

/** Named semantic spacing for common use-cases */
export const semanticSpacing = {
  /** Inline spacing between icon and text */
  iconGap: spacing[2],
  /** Gap between form fields */
  fieldGap: spacing[4],
  /** Gap between cards in a grid */
  cardGap: spacing[6],
  /** Section inner padding (horizontal) */
  sectionPx: spacing[6],
  /** Section inner padding (vertical, mobile) */
  sectionPyMobile: spacing[12],
  /** Section inner padding (vertical, desktop) */
  sectionPyDesktop: spacing[20],
  /** Navbar height */
  navbarHeight: spacing[16],
  /** Container max inline padding */
  containerPx: spacing[6],
} as const;

/* ================================================================== */
/*  2. Typography Scale                                                */
/* ================================================================== */

export const fontSize = {
  xs: "0.75rem",    // 12px
  sm: "0.875rem",   // 14px
  base: "1rem",     // 16px
  lg: "1.125rem",   // 18px
  xl: "1.25rem",    // 20px
  "2xl": "1.5rem",  // 24px
  "3xl": "1.875rem", // 30px
  "4xl": "2.25rem", // 36px
  "5xl": "3rem",    // 48px
  "6xl": "3.75rem", // 60px
} as const;

export const fontWeight = {
  normal: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
  extrabold: "800",
} as const;

export const lineHeight = {
  none: "1",
  tight: "1.25",
  snug: "1.375",
  normal: "1.5",
  relaxed: "1.625",
  loose: "2",
} as const;

/** Semantic typography presets */
export const textPresets = {
  /** Page title / hero heading */
  display: { size: fontSize["5xl"], weight: fontWeight.bold, leading: lineHeight.tight },
  /** Section heading (h2) */
  heading: { size: fontSize["3xl"], weight: fontWeight.semibold, leading: lineHeight.tight },
  /** Subsection heading (h3) */
  subheading: { size: fontSize.xl, weight: fontWeight.semibold, leading: lineHeight.snug },
  /** Card title (h4) */
  cardTitle: { size: fontSize.lg, weight: fontWeight.semibold, leading: lineHeight.snug },
  /** Body text */
  body: { size: fontSize.base, weight: fontWeight.normal, leading: lineHeight.relaxed },
  /** Small/secondary text */
  caption: { size: fontSize.sm, weight: fontWeight.normal, leading: lineHeight.normal },
  /** Tiny label text */
  label: { size: fontSize.xs, weight: fontWeight.medium, leading: lineHeight.normal },
} as const;

/* ================================================================== */
/*  3. Breakpoints — Mobile-First                                      */
/* ================================================================== */

export const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
} as const;

/** Media query helpers (for use in JS/CSS-in-JS — prefer Tailwind classes) */
export const media = {
  sm: `@media (min-width: ${breakpoints.sm}px)`,
  md: `@media (min-width: ${breakpoints.md}px)`,
  lg: `@media (min-width: ${breakpoints.lg}px)`,
  xl: `@media (min-width: ${breakpoints.xl}px)`,
  "2xl": `@media (min-width: ${breakpoints["2xl"]}px)`,
  /** Reduced motion preference */
  reducedMotion: "@media (prefers-reduced-motion: reduce)",
  /** High contrast mode */
  highContrast: "@media (forced-colors: active)",
  /** Dark mode preference */
  darkMode: "@media (prefers-color-scheme: dark)",
} as const;

/* ================================================================== */
/*  4. Z-Index Scale                                                   */
/* ================================================================== */

export const zIndex = {
  /** Behind everything — background decorations */
  behind: -1,
  /** Base level */
  base: 0,
  /** Slightly raised — cards, dropdowns */
  raised: 10,
  /** Navigation bar */
  navbar: 50,
  /** Sticky elements */
  sticky: 40,
  /** Dropdown menus */
  dropdown: 100,
  /** Overlays (modal backdrop) */
  overlay: 200,
  /** Modal dialog */
  modal: 300,
  /** Toast notifications */
  toast: 400,
  /** Tooltip */
  tooltip: 500,
  /** Skip link (always on top) */
  skipLink: 9999,
} as const;

/* ================================================================== */
/*  5. Motion / Animation Tokens                                       */
/* ================================================================== */

export const duration = {
  instant: "0ms",
  fast: "100ms",
  normal: "200ms",
  slow: "300ms",
  slower: "500ms",
} as const;

export const easing = {
  /** Standard ease for most transitions */
  default: "cubic-bezier(0.4, 0, 0.2, 1)",
  /** Enter screen — decelerate */
  easeOut: "cubic-bezier(0, 0, 0.2, 1)",
  /** Leave screen — accelerate */
  easeIn: "cubic-bezier(0.4, 0, 1, 1)",
  /** Spring-like bounce */
  spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
} as const;

/* ================================================================== */
/*  6. Color Contrast & Accessibility Utilities                        */
/* ================================================================== */

/**
 * Calculate relative luminance of a hex color (WCAG 2.1 formula).
 * @see https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html
 */
export function relativeLuminance(hex: string): number {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;

  const linearize = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));

  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/**
 * Calculate contrast ratio between two hex colors.
 * Returns a value between 1 and 21.
 */
export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if two colors meet WCAG 2.1 AA contrast requirements.
 * - Normal text: 4.5:1
 * - Large text (18px+ bold or 24px+): 3:1
 */
export function meetsContrastAA(fg: string, bg: string, largeText = false): boolean {
  const ratio = contrastRatio(fg, bg);
  return largeText ? ratio >= 3 : ratio >= 4.5;
}

/**
 * Get a readable text color (black or white) for a given background.
 * Uses WCAG luminance calculation for accurate results.
 */
export function getReadableTextColor(bgHex: string): "#111827" | "#ffffff" {
  const lum = relativeLuminance(bgHex);
  return lum > 0.179 ? "#111827" : "#ffffff";
}

/**
 * Ensure a foreground color has enough contrast against a background.
 * If not, returns black or white as a safe fallback.
 */
export function ensureContrast(fg: string, bg: string, largeText = false): string {
  if (meetsContrastAA(fg, bg, largeText)) return fg;
  return getReadableTextColor(bg);
}

/* ================================================================== */
/*  7. Safe Rendering Utilities                                        */
/* ================================================================== */

/**
 * Safely coerce a value to a string. Returns fallback for null/undefined/non-string.
 */
export function safeString(value: unknown, fallback = ""): string {
  if (typeof value === "string" && value.trim().length > 0) return value;
  if (typeof value === "number" && !isNaN(value)) return String(value);
  return fallback;
}

/**
 * Safely coerce a value to a boolean.
 */
export function safeBool(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

/**
 * Safely coerce a value to a number.
 */
export function safeNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && !isNaN(value)) return value;
  const parsed = Number(value);
  return isNaN(parsed) ? fallback : parsed;
}

/**
 * Safely coerce a value to an array. Never returns undefined/null.
 */
export function safeArray<T = unknown>(value: unknown, fallback: T[] = []): T[] {
  if (Array.isArray(value)) return value;
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : null;
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Clamp a value between min and max.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Generate a unique ID for ARIA associations (label/describedby).
 */
let idCounter = 0;
export function uniqueId(prefix = "cb"): string {
  return `${prefix}-${++idCounter}`;
}

/* ================================================================== */
/*  8. SEO Utilities                                                   */
/* ================================================================== */

/**
 * Generate JSON-LD structured data for a job posting.
 * @see https://schema.org/JobPosting
 */
export function jobPostingJsonLd(job: {
  title: string;
  description: string;
  company: string;
  location?: string;
  salary?: string;
  type?: string;
  datePosted?: string;
  url?: string;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: job.description,
    hiringOrganization: {
      "@type": "Organization",
      name: job.company,
    },
    ...(job.location && {
      jobLocation: {
        "@type": "Place",
        address: { "@type": "PostalAddress", addressLocality: job.location },
      },
    }),
    ...(job.salary && { baseSalary: job.salary }),
    ...(job.type && { employmentType: job.type.toUpperCase().replace(/\s/g, "_") }),
    ...(job.datePosted && { datePosted: job.datePosted }),
    ...(job.url && { url: job.url }),
  };
}

/**
 * Generate JSON-LD structured data for an organization.
 */
export function organizationJsonLd(org: {
  name: string;
  url?: string;
  logo?: string;
  description?: string;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: org.name,
    ...(org.url && { url: org.url }),
    ...(org.logo && { logo: org.logo }),
    ...(org.description && { description: org.description }),
  };
}

/**
 * Generate JSON-LD BreadcrumbList for navigation.
 */
export function breadcrumbJsonLd(
  items: { name: string; url: string }[]
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/* ================================================================== */
/*  9. Performance Utilities                                           */
/* ================================================================== */

/**
 * Generate an optimized image URL with width/quality params.
 * Works with Unsplash URLs, or returns original if not optimizable.
 */
export function optimizeImageUrl(
  url: string,
  options: { width?: number; quality?: number; format?: "webp" | "auto" } = {}
): string {
  if (!url || typeof url !== "string") return "";

  const { width = 800, quality = 80, format = "auto" } = options;

  // Unsplash optimization
  if (url.includes("unsplash.com")) {
    const base = url.split("?")[0];
    return `${base}?w=${width}&q=${quality}&fm=${format === "auto" ? "webp" : format}&fit=crop`;
  }

  return url;
}

/**
 * Generate srcset for responsive images.
 */
export function generateSrcSet(
  url: string,
  widths: number[] = [320, 640, 960, 1280, 1920]
): string {
  if (!url) return "";
  return widths
    .map((w) => `${optimizeImageUrl(url, { width: w })} ${w}w`)
    .join(", ");
}

/**
 * Default image sizes attribute for responsive images.
 */
export const defaultImageSizes = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw";

/* ================================================================== */
/*  10. Accessibility Constants                                        */
/* ================================================================== */

/** Common ARIA landmark roles */
export const landmarks = {
  banner: "banner",        // <header>
  navigation: "navigation", // <nav>
  main: "main",            // <main>
  contentinfo: "contentinfo", // <footer>
  complementary: "complementary", // <aside>
  search: "search",        // search form
  region: "region",        // generic landmark (needs label)
  form: "form",            // <form> (with label)
} as const;

/** Screen reader only text (use with VisuallyHidden component) */
export const srText = {
  skipToContent: "Skip to main content",
  externalLink: "(opens in a new tab)",
  required: "(required)",
  loading: "Loading, please wait…",
  expandMenu: "Open navigation menu",
  collapseMenu: "Close navigation menu",
  previousSlide: "Previous slide",
  nextSlide: "Next slide",
  currentPage: "Current page",
  searchJobs: "Search jobs",
  clearSearch: "Clear search",
  closeModal: "Close dialog",
} as const;

/** Keyboard keys for consistent event handling */
export const keys = {
  Enter: "Enter",
  Space: " ",
  Escape: "Escape",
  ArrowUp: "ArrowUp",
  ArrowDown: "ArrowDown",
  ArrowLeft: "ArrowLeft",
  ArrowRight: "ArrowRight",
  Tab: "Tab",
  Home: "Home",
  End: "End",
} as const;

/* ================================================================== */
/*  11. Responsive Grid Utilities                                      */
/* ================================================================== */

/**
 * Generate responsive grid column classes (Tailwind).
 * Follows mobile-first principle.
 */
export function gridCols(config: {
  sm?: number;
  md?: number;
  lg?: number;
  xl?: number;
}): string {
  const classes: string[] = ["grid"];
  const { sm = 1, md, lg, xl } = config;
  classes.push(`grid-cols-${sm}`);
  if (md) classes.push(`md:grid-cols-${md}`);
  if (lg) classes.push(`lg:grid-cols-${lg}`);
  if (xl) classes.push(`xl:grid-cols-${xl}`);
  return classes.join(" ");
}

/**
 * Responsive container padding classes.
 */
export const containerClasses = "mx-auto w-full px-4 sm:px-6 lg:px-8" as const;

/* ================================================================== */
/*  12. Validation Helpers                                             */
/* ================================================================== */

/**
 * Validate a URL string. Returns empty string if invalid.
 */
export function safeUrl(value: unknown, fallback = ""): string {
  if (typeof value !== "string" || value.trim().length === 0) return fallback;
  // Allow relative URLs, anchors, mailto, tel
  if (value.startsWith("/") || value.startsWith("#") || value.startsWith("mailto:") || value.startsWith("tel:")) {
    return value;
  }
  try {
    new URL(value);
    return value;
  } catch {
    return fallback;
  }
}

/**
 * Sanitize text content — strip HTML tags for safe rendering.
 * Use this for user-generated content that should be plain text.
 */
export function sanitizeText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/<[^>]*>/g, "").trim();
}

/**
 * Check if a hex color is valid.
 */
export function isValidHex(hex: unknown): hex is string {
  if (typeof hex !== "string") return false;
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(hex);
}

/* ================================================================== */
/*  13. Block Variant System                                           */
/* ================================================================== */

/** Standard section background variants */
export type SectionVariant = "white" | "light" | "dark" | "accent" | "gradient";

/** Standard button variants */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "outline";

/** Standard text alignment */
export type TextAlign = "left" | "center" | "right";

/** Standard layout density */
export type Density = "compact" | "normal" | "spacious";

/**
 * Map density to Tailwind gap classes.
 */
export function densityToGap(density: Density = "normal"): string {
  switch (density) {
    case "compact": return "gap-4";
    case "spacious": return "gap-10";
    default: return "gap-6";
  }
}

/**
 * Map text alignment to Tailwind class.
 */
export function textAlignClass(align: TextAlign = "left"): string {
  switch (align) {
    case "center": return "text-center";
    case "right": return "text-right";
    default: return "text-left";
  }
}
