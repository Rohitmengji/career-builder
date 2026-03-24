/*
 * Runtime theme validation — catches bad data before it reaches components.
 *
 * validateTheme(theme) validates all fields and returns a safe theme:
 *   - Invalid hex colors → fall back to DEFAULT_THEME value
 *   - Invalid enum values → fall back to DEFAULT_THEME value
 *   - Missing fields → filled from DEFAULT_THEME
 *   - Logs warnings in dev mode for debugging
 *
 * NEVER throws. Always returns a usable TenantTheme.
 */

import {
  type TenantTheme,
  type TenantBranding,
  type ThemeColors,
  type ThemeTypography,
  type ThemeLayout,
  type ThemeComponents,
  DEFAULT_THEME,
  DEFAULT_BRANDING,
} from "./index";

/* ================================================================== */
/*  Debug mode                                                         */
/* ================================================================== */

const IS_DEV = typeof process !== "undefined" && process.env?.NODE_ENV !== "production";

interface ValidationWarning {
  field: string;
  value: unknown;
  fallback: unknown;
  reason: string;
}

let warnings: ValidationWarning[] = [];

function warn(field: string, value: unknown, fallback: unknown, reason: string): void {
  const entry: ValidationWarning = { field, value, fallback, reason };
  warnings.push(entry);
  if (IS_DEV) {
    console.warn(`[ThemeValidation] ${field}: ${reason} (got: ${JSON.stringify(value)}, using: ${JSON.stringify(fallback)})`);
  }
}

/** Get all validation warnings from the last validateTheme() call. */
export function getValidationWarnings(): ValidationWarning[] {
  return [...warnings];
}

/* ================================================================== */
/*  Validators                                                         */
/* ================================================================== */

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

function isValidHex(value: unknown): value is string {
  return typeof value === "string" && HEX_RE.test(value);
}

function validateHex(field: string, value: unknown, fallback: string): string {
  if (isValidHex(value)) return value;
  if (typeof value === "string" && value.length > 0) {
    warn(field, value, fallback, "Invalid hex color");
  }
  return fallback;
}

function validateEnum<T extends string>(field: string, value: unknown, allowed: readonly T[], fallback: T): T {
  if (typeof value === "string" && (allowed as readonly string[]).includes(value)) {
    return value as T;
  }
  if (value !== undefined && value !== null) {
    warn(field, value, fallback, `Must be one of: ${allowed.join(", ")}`);
  }
  return fallback;
}

function validateString(field: string, value: unknown, fallback: string): string {
  if (typeof value === "string") return value;
  if (value !== undefined && value !== null) {
    warn(field, value, fallback, "Expected string");
  }
  return fallback;
}

function validateBool(field: string, value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (value !== undefined && value !== null) {
    warn(field, value, fallback, "Expected boolean");
  }
  return fallback;
}

/* ================================================================== */
/*  Theme validation                                                   */
/* ================================================================== */

function validateColors(colors: Partial<ThemeColors> | undefined): ThemeColors {
  const c = colors || {};
  const d = DEFAULT_THEME.colors;
  return {
    primary: validateHex("colors.primary", c.primary, d.primary),
    secondary: validateHex("colors.secondary", c.secondary, d.secondary),
    background: validateHex("colors.background", c.background, d.background),
    surface: validateHex("colors.surface", c.surface, d.surface),
    text: validateHex("colors.text", c.text, d.text),
    textMuted: validateHex("colors.textMuted", c.textMuted, d.textMuted),
    border: validateHex("colors.border", c.border, d.border),
    accent: validateHex("colors.accent", c.accent, d.accent),
    success: validateHex("colors.success", c.success, d.success),
    error: validateHex("colors.error", c.error, d.error),
  };
}

const FONT_SIZE_VALUES = ["14px", "15px", "16px", "18px"] as const;
const LINE_HEIGHT_VALUES = ["1.5", "1.6", "1.7", "1.8"] as const;
const HEADING_WEIGHT_VALUES = ["400", "500", "600", "700", "800"] as const;

function validateTypography(typo: Partial<ThemeTypography> | undefined): ThemeTypography {
  const t = typo || {};
  const d = DEFAULT_THEME.typography;
  return {
    fontFamily: validateString("typography.fontFamily", t.fontFamily, d.fontFamily),
    headingFontFamily: validateString("typography.headingFontFamily", t.headingFontFamily, d.headingFontFamily),
    headingWeight: validateEnum("typography.headingWeight", t.headingWeight, HEADING_WEIGHT_VALUES, d.headingWeight as typeof HEADING_WEIGHT_VALUES[number]),
    baseFontSize: validateEnum("typography.baseFontSize", t.baseFontSize, FONT_SIZE_VALUES, d.baseFontSize as typeof FONT_SIZE_VALUES[number]),
    lineHeight: validateEnum("typography.lineHeight", t.lineHeight, LINE_HEIGHT_VALUES, d.lineHeight as typeof LINE_HEIGHT_VALUES[number]),
  };
}

const CONTAINER_WIDTHS = ["1024px", "1200px", "1440px"] as const;
const SPACING_VALUES = ["compact", "normal", "spacious"] as const;
const LAYOUT_STYLES = ["modern", "corporate", "minimal"] as const;
const BTN_RADIUS = ["none", "sm", "md", "lg", "full"] as const;
const BTN_SIZE = ["sm", "md", "lg"] as const;
const CARD_SHADOW = ["none", "sm", "md", "lg"] as const;
const CARD_RADIUS = ["none", "sm", "md", "lg", "xl"] as const;
const SECTION_RADIUS = ["none", "sm", "md", "lg"] as const;

function validateLayout(layout: Partial<ThemeLayout> | undefined): ThemeLayout {
  const l = layout || {};
  const d = DEFAULT_THEME.layout;
  return {
    containerWidth: validateEnum("layout.containerWidth", l.containerWidth, CONTAINER_WIDTHS, d.containerWidth as typeof CONTAINER_WIDTHS[number]),
    sectionSpacing: validateEnum("layout.sectionSpacing", l.sectionSpacing, SPACING_VALUES, d.sectionSpacing),
    layoutStyle: validateEnum("layout.layoutStyle", l.layoutStyle, LAYOUT_STYLES, d.layoutStyle),
  };
}

function validateComponents(comp: Partial<ThemeComponents> | undefined): ThemeComponents {
  const c = comp || {};
  const d = DEFAULT_THEME.components;
  return {
    button: {
      radius: validateEnum("components.button.radius", c.button?.radius, BTN_RADIUS, d.button.radius),
      size: validateEnum("components.button.size", c.button?.size, BTN_SIZE, d.button.size),
    },
    card: {
      shadow: validateEnum("components.card.shadow", c.card?.shadow, CARD_SHADOW, d.card.shadow),
      radius: validateEnum("components.card.radius", c.card?.radius, CARD_RADIUS, d.card.radius),
    },
    navbar: {
      sticky: validateBool("components.navbar.sticky", c.navbar?.sticky, d.navbar.sticky),
      bordered: validateBool("components.navbar.bordered", c.navbar?.bordered, d.navbar.bordered),
    },
    section: {
      radius: validateEnum("components.section.radius", c.section?.radius, SECTION_RADIUS, d.section.radius),
    },
  };
}

const MODE_VALUES = ["light", "dark"] as const;

/**
 * Validate and normalize a theme. Always returns a fully-populated, safe TenantTheme.
 * Invalid values are replaced with DEFAULT_THEME values.
 * In dev mode, logs warnings for every fallback.
 */
export function validateTheme(theme: Partial<TenantTheme> | undefined | null): TenantTheme {
  warnings = [];
  const t = theme || {};
  return {
    colors: validateColors(t.colors),
    typography: validateTypography(t.typography),
    layout: validateLayout(t.layout),
    components: validateComponents(t.components),
    mode: validateEnum("mode", t.mode, MODE_VALUES, DEFAULT_THEME.mode),
  };
}

/**
 * Validate branding. Returns safe TenantBranding.
 */
export function validateBranding(branding: Partial<TenantBranding> | undefined | null): TenantBranding {
  const b = branding || {};
  const d = DEFAULT_BRANDING;
  return {
    companyName: validateString("branding.companyName", b.companyName, d.companyName),
    logoUrl: typeof b.logoUrl === "string" ? b.logoUrl : d.logoUrl,
    faviconUrl: typeof b.faviconUrl === "string" ? b.faviconUrl : d.faviconUrl,
    metaDescription: validateString("branding.metaDescription", b.metaDescription, d.metaDescription),
    ogImage: typeof b.ogImage === "string" ? b.ogImage : d.ogImage,
  };
}
