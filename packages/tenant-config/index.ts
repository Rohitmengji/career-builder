/*
 * Tenant Configuration — shared types + defaults.
 *
 * This package is the single source of truth for:
 *   1. TenantTheme — full theme spec (colors, typography, layout, components)
 *   2. TenantBranding — logo, company name, favicon, meta
 *   3. TenantConfig — complete tenant configuration
 *   4. DEFAULT_THEME — safe fallback theme
 *   5. DEFAULT_CONFIG — safe fallback tenant config
 *
 * Both apps/admin and apps/web import from here.
 */

/* ================================================================== */
/*  Theme Types                                                        */
/* ================================================================== */

export interface ThemeColors {
  /** Primary brand color — buttons, links, accents */
  primary: string;
  /** Secondary/complementary color — secondary buttons, tags */
  secondary: string;
  /** Page background */
  background: string;
  /** Surface/card background */
  surface: string;
  /** Primary text color */
  text: string;
  /** Secondary/muted text color */
  textMuted: string;
  /** Border/divider color */
  border: string;
  /** Accent color — highlights, badges */
  accent: string;
  /** Success state */
  success: string;
  /** Error state */
  error: string;
}

export interface ThemeTypography {
  /** Google Fonts family name, e.g. "Inter", "Poppins" */
  fontFamily: string;
  /** Heading font (falls back to fontFamily if empty) */
  headingFontFamily: string;
  /** Heading weight: "400" | "500" | "600" | "700" | "800" */
  headingWeight: string;
  /** Body font size base: "14px" | "15px" | "16px" */
  baseFontSize: string;
  /** Line height: "1.5" | "1.6" | "1.7" | "1.8" */
  lineHeight: string;
}

export interface ThemeLayout {
  /** Max width of content container: "1024px" | "1200px" | "1440px" */
  containerWidth: string;
  /** Section vertical padding: "compact" | "normal" | "spacious" */
  sectionSpacing: "compact" | "normal" | "spacious";
  /** Layout style — affects overall feel */
  layoutStyle: "modern" | "corporate" | "minimal";
}

export interface ThemeComponents {
  button: {
    /** Border radius: "none" | "sm" | "md" | "lg" | "full" */
    radius: "none" | "sm" | "md" | "lg" | "full";
    /** Button size: "sm" | "md" | "lg" */
    size: "sm" | "md" | "lg";
  };
  card: {
    /** Box shadow: "none" | "sm" | "md" | "lg" */
    shadow: "none" | "sm" | "md" | "lg";
    /** Border radius: "none" | "sm" | "md" | "lg" | "xl" */
    radius: "none" | "sm" | "md" | "lg" | "xl";
  };
  navbar: {
    /** Sticky or static */
    sticky: boolean;
    /** Show border bottom */
    bordered: boolean;
  };
  section: {
    /** Border radius of sections (for modern look) */
    radius: "none" | "sm" | "md" | "lg";
  };
}

export interface TenantTheme {
  colors: ThemeColors;
  typography: ThemeTypography;
  layout: ThemeLayout;
  components: ThemeComponents;
  /** Dark mode toggle */
  mode: "light" | "dark";
}

/* ================================================================== */
/*  Branding Types                                                     */
/* ================================================================== */

export interface TenantBranding {
  /** Company/client name */
  companyName: string;
  /** Logo image URL */
  logoUrl: string;
  /** Favicon URL */
  faviconUrl: string;
  /** Meta description for SEO */
  metaDescription: string;
  /** Open Graph image */
  ogImage: string;
}

/* ================================================================== */
/*  Full Tenant Config                                                 */
/* ================================================================== */

export interface TenantConfig {
  /** Unique tenant identifier (used in routes, file names) */
  id: string;
  /** Display name */
  name: string;
  /** Branding assets */
  branding: TenantBranding;
  /** Theme configuration */
  theme: TenantTheme;
  /** When this config was last updated */
  updatedAt: string;
  /** When this tenant was created */
  createdAt: string;
}

/* ================================================================== */
/*  Defaults                                                           */
/* ================================================================== */

export const DEFAULT_THEME: TenantTheme = {
  colors: {
    primary: "#2563eb",
    secondary: "#7c3aed",
    background: "#ffffff",
    surface: "#f9fafb",
    text: "#111827",
    textMuted: "#6b7280",
    border: "#e5e7eb",
    accent: "#0d9488",
    success: "#16a34a",
    error: "#dc2626",
  },
  typography: {
    fontFamily: "Inter",
    headingFontFamily: "",
    headingWeight: "600",
    baseFontSize: "16px",
    lineHeight: "1.6",
  },
  layout: {
    containerWidth: "1200px",
    sectionSpacing: "normal",
    layoutStyle: "modern",
  },
  components: {
    button: {
      radius: "lg",
      size: "md",
    },
    card: {
      shadow: "sm",
      radius: "xl",
    },
    navbar: {
      sticky: true,
      bordered: true,
    },
    section: {
      radius: "none",
    },
  },
  mode: "light",
};

export const DEFAULT_BRANDING: TenantBranding = {
  companyName: "Acme Inc.",
  logoUrl: "",
  faviconUrl: "",
  metaDescription: "Explore open positions and join our world-class team.",
  ogImage: "",
};

export const DEFAULT_CONFIG: TenantConfig = {
  id: "default",
  name: "Default Tenant",
  branding: DEFAULT_BRANDING,
  theme: DEFAULT_THEME,
  updatedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
};

/* ================================================================== */
/*  Utility: Deep merge with safe fallback                             */
/* ================================================================== */

/**
 * Deep-merge a partial tenant config over the defaults.
 * Never returns undefined for any field — always safe.
 */
export function mergeTenantConfig(partial: Partial<TenantConfig>): TenantConfig {
  return {
    id: partial.id || DEFAULT_CONFIG.id,
    name: partial.name || DEFAULT_CONFIG.name,
    branding: {
      ...DEFAULT_BRANDING,
      ...(partial.branding || {}),
    },
    theme: {
      colors: { ...DEFAULT_THEME.colors, ...(partial.theme?.colors || {}) },
      typography: { ...DEFAULT_THEME.typography, ...(partial.theme?.typography || {}) },
      layout: { ...DEFAULT_THEME.layout, ...(partial.theme?.layout || {}) },
      components: {
        button: { ...DEFAULT_THEME.components.button, ...(partial.theme?.components?.button || {}) },
        card: { ...DEFAULT_THEME.components.card, ...(partial.theme?.components?.card || {}) },
        navbar: { ...DEFAULT_THEME.components.navbar, ...(partial.theme?.components?.navbar || {}) },
        section: { ...DEFAULT_THEME.components.section, ...(partial.theme?.components?.section || {}) },
      },
      mode: partial.theme?.mode || DEFAULT_THEME.mode,
    },
    updatedAt: partial.updatedAt || new Date().toISOString(),
    createdAt: partial.createdAt || new Date().toISOString(),
  };
}

/* ================================================================== */
/*  Utility: Theme → CSS custom properties                             */
/* ================================================================== */

/**
 * Convert a TenantTheme into CSS custom property declarations.
 * Inject these as a <style> block or inline on :root.
 */
export function themeToCssVars(theme: TenantTheme): Record<string, string> {
  return {
    "--cb-color-primary": theme.colors.primary,
    "--cb-color-secondary": theme.colors.secondary,
    "--cb-color-background": theme.colors.background,
    "--cb-color-surface": theme.colors.surface,
    "--cb-color-text": theme.colors.text,
    "--cb-color-text-muted": theme.colors.textMuted,
    "--cb-color-border": theme.colors.border,
    "--cb-color-accent": theme.colors.accent,
    "--cb-color-success": theme.colors.success,
    "--cb-color-error": theme.colors.error,
    "--cb-font-family": `"${theme.typography.fontFamily}", system-ui, -apple-system, sans-serif`,
    "--cb-font-heading": theme.typography.headingFontFamily
      ? `"${theme.typography.headingFontFamily}", "${theme.typography.fontFamily}", system-ui, sans-serif`
      : `"${theme.typography.fontFamily}", system-ui, -apple-system, sans-serif`,
    "--cb-font-weight-heading": theme.typography.headingWeight,
    "--cb-font-size-base": theme.typography.baseFontSize,
    "--cb-line-height": theme.typography.lineHeight,
    "--cb-container-width": theme.layout.containerWidth,
    "--cb-btn-radius": radiusMap[theme.components.button.radius] || "8px",
    "--cb-card-radius": cardRadiusMap[theme.components.card.radius] || "16px",
    "--cb-card-shadow": shadowMap[theme.components.card.shadow] || "0 1px 3px rgba(0,0,0,0.08)",
  };
}

const radiusMap: Record<string, string> = {
  none: "0px",
  sm: "4px",
  md: "8px",
  lg: "12px",
  full: "9999px",
};

const cardRadiusMap: Record<string, string> = {
  none: "0px",
  sm: "8px",
  md: "12px",
  lg: "16px",
  xl: "24px",
};

const shadowMap: Record<string, string> = {
  none: "none",
  sm: "0 1px 3px rgba(0,0,0,0.08)",
  md: "0 4px 12px rgba(0,0,0,0.1)",
  lg: "0 8px 24px rgba(0,0,0,0.12)",
};

/**
 * Generate the section spacing value based on layout config.
 */
export function getSectionSpacing(spacing: TenantTheme["layout"]["sectionSpacing"]): { py: string; pyMd: string; pySm: string } {
  switch (spacing) {
    case "compact":
      return { py: "4rem", pyMd: "3rem", pySm: "2.5rem" };
    case "spacious":
      return { py: "8rem", pyMd: "6rem", pySm: "4rem" };
    default: // normal
      return { py: "6rem", pyMd: "5rem", pySm: "4rem" };
  }
}

/**
 * Generate a Google Fonts URL for the given theme.
 */
export function getGoogleFontsUrl(theme: TenantTheme): string {
  const families: string[] = [];
  const weights = "400;500;600;700;800";

  if (theme.typography.fontFamily) {
    families.push(`family=${encodeURIComponent(theme.typography.fontFamily)}:wght@${weights}`);
  }
  if (theme.typography.headingFontFamily && theme.typography.headingFontFamily !== theme.typography.fontFamily) {
    families.push(`family=${encodeURIComponent(theme.typography.headingFontFamily)}:wght@${weights}`);
  }

  if (families.length === 0) return "";
  return `https://fonts.googleapis.com/css2?${families.join("&")}&display=swap`;
}

/**
 * Lighten a hex color for light-bg tints.
 */
export function lightenHex(hex: string, amount: number = 0.92): string {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  const lr = Math.round(r + (255 - r) * amount);
  const lg = Math.round(g + (255 - g) * amount);
  const lb = Math.round(b + (255 - b) * amount);
  return `#${lr.toString(16).padStart(2, "0")}${lg.toString(16).padStart(2, "0")}${lb.toString(16).padStart(2, "0")}`;
}

/**
 * Darken a hex color for hover states.
 */
export function darkenHex(hex: string, amount: number = 0.15): string {
  const c = hex.replace("#", "");
  const r = Math.round(parseInt(c.substring(0, 2), 16) * (1 - amount));
  const g = Math.round(parseInt(c.substring(2, 4), 16) * (1 - amount));
  const b = Math.round(parseInt(c.substring(4, 6), 16) * (1 - amount));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/**
 * Determine if a hex color is light (for choosing text contrast).
 */
export function isLightColor(hex: string): boolean {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
}

/* ================================================================== */
/*  Re-exports from validation & tokens                                */
/* ================================================================== */

export { validateTheme, validateBranding, getValidationWarnings } from "./validation";
export { getDesignTokens, getAccentTokens } from "./tokens";
export type { DesignTokens, AccentTokens } from "./tokens";

/* ================================================================== */
/*  normalizeTheme — merge + validate in one call                      */
/* ================================================================== */

// Import locally for normalizeTheme
import { validateTheme as _validateTheme } from "./validation";

/**
 * Normalize a potentially partial/dirty theme into a fully valid TenantTheme.
 * Deep-merges over DEFAULT_THEME, then validates every field.
 * Safe to call with undefined/null — returns DEFAULT_THEME.
 *
 * This is the recommended entry point for any theme data from external
 * sources (API, file, URL params).
 */
export function normalizeTheme(partial: Partial<TenantTheme> | undefined | null): TenantTheme {
  // First: deep merge to fill gaps
  const merged: TenantTheme = {
    colors: { ...DEFAULT_THEME.colors, ...(partial?.colors || {}) },
    typography: { ...DEFAULT_THEME.typography, ...(partial?.typography || {}) },
    layout: { ...DEFAULT_THEME.layout, ...(partial?.layout || {}) },
    components: {
      button: { ...DEFAULT_THEME.components.button, ...(partial?.components?.button || {}) },
      card: { ...DEFAULT_THEME.components.card, ...(partial?.components?.card || {}) },
      navbar: { ...DEFAULT_THEME.components.navbar, ...(partial?.components?.navbar || {}) },
      section: { ...DEFAULT_THEME.components.section, ...(partial?.components?.section || {}) },
    },
    mode: partial?.mode || DEFAULT_THEME.mode,
  };
  // Second: validate every field (replaces bad values with defaults)
  return _validateTheme(merged);
}
