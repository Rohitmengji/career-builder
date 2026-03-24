/*
 * Design Token System — maps TenantTheme → safe, pre-computed UI tokens.
 *
 * Components NEVER read raw theme values directly. They use tokens.
 * This gives us:
 *   1. One place to change how theme maps to UI
 *   2. Safe fallbacks for every token
 *   3. No dynamic Tailwind class generation (static classes only)
 *   4. Consistent, predictable styling
 *
 * Usage:
 *   const tokens = getDesignTokens(theme);
 *   <div style={tokens.section.white}>...</div>
 *   <button className={tokens.button.radiusClass}>...</button>
 */

import {
  type TenantTheme,
  DEFAULT_THEME,
  darkenHex,
  lightenHex,
  isLightColor,
  getSectionSpacing,
} from "./index";

/** Generic CSS properties type — avoids importing React in shared package */
type CSSProperties = Record<string, string | number | undefined>;

/* ================================================================== */
/*  Static lookup maps (safe — all possible keys are covered)          */
/* ================================================================== */

const BUTTON_RADIUS_CLASS: Record<string, string> = {
  none: "rounded-none",
  sm: "rounded",
  md: "rounded-lg",
  lg: "rounded-xl",
  full: "rounded-full",
};

const CARD_RADIUS_CLASS: Record<string, string> = {
  none: "rounded-none",
  sm: "rounded-lg",
  md: "rounded-xl",
  lg: "rounded-2xl",
  xl: "rounded-3xl",
};

const CARD_SHADOW_CLASS: Record<string, string> = {
  none: "shadow-none",
  sm: "shadow-sm",
  md: "shadow-md",
  lg: "shadow-lg",
};

const SECTION_PADDING_CLASS: Record<string, string> = {
  compact: "py-6 sm:py-8 md:py-10",
  normal: "py-8 sm:py-10 md:py-14",
  spacious: "py-10 sm:py-14 md:py-20",
};

const BUTTON_SIZE_CLASS: Record<string, string> = {
  sm: "px-4 py-2 text-xs",
  md: "px-6 py-3 text-sm",
  lg: "px-8 py-4 text-base",
};

/* ================================================================== */
/*  Token Types                                                        */
/* ================================================================== */

export interface DesignTokens {
  /** Color tokens — hex values for inline styles */
  colors: {
    primary: string;
    primaryHover: string;
    primaryText: string;       // text color for buttons with primary bg
    primaryTint: string;       // light tint of primary (for hover bg, badges)
    secondary: string;
    secondaryHover: string;
    secondaryText: string;
    background: string;
    backgroundAlt: string;     // dark-mode aware alternative bg
    surface: string;
    surfaceHover: string;
    text: string;
    textMuted: string;
    heading: string;
    border: string;
    borderHover: string;
    accent: string;
    success: string;
    error: string;
    overlay: string;           // semi-transparent overlay for hero images
  };

  /** Typography tokens */
  typography: {
    fontFamilyCss: string;
    headingFontFamilyCss: string;
    headingWeight: string;
    baseFontSize: string;
    lineHeight: string;
  };

  /** Layout tokens */
  layout: {
    containerMaxWidth: string;
    sectionPaddingClass: string;
    spacing: ReturnType<typeof getSectionSpacing>;
  };

  /** Component tokens — classes + styles */
  button: {
    radiusClass: string;
    sizeClass: string;
    primaryStyle: CSSProperties;
    primaryHoverBg: string;
    secondaryStyle: CSSProperties;
    secondaryHoverBg: string;
  };

  card: {
    radiusClass: string;
    shadowClass: string;
    style: CSSProperties;
    hoverClass: string;
  };

  section: {
    white: CSSProperties;
    light: CSSProperties;
    dark: CSSProperties;
    accent: CSSProperties;
    gradient: CSSProperties;
  };

  navbar: {
    sticky: boolean;
    bordered: boolean;
    lightStyle: CSSProperties;
    darkStyle: CSSProperties;
    transparentStyle: CSSProperties;
  };

  /** Container inline style */
  containerStyle: CSSProperties;

  /** Is dark mode */
  isDark: boolean;
}

/* ================================================================== */
/*  Token Generator                                                    */
/* ================================================================== */

/**
 * Generate design tokens from a validated TenantTheme.
 *
 * Call this once per theme (memoized in ThemeProvider).
 * Components use tokens.colors.primary instead of theme.colors.primary.
 */
export function getDesignTokens(theme: TenantTheme): DesignTokens {
  const t = theme || DEFAULT_THEME;
  const isDark = t.mode === "dark";

  // Pre-compute derived colors
  const primaryHover = darkenHex(t.colors.primary, 0.12);
  const primaryText = isLightColor(t.colors.primary) ? "#111827" : "#ffffff";
  const primaryTint = lightenHex(t.colors.primary, 0.92);
  const secondaryHover = darkenHex(t.colors.secondary, 0.12);
  const secondaryText = isLightColor(t.colors.secondary) ? "#111827" : "#ffffff";
  const surfaceHover = isDark ? "#374151" : darkenHex(t.colors.surface, 0.03);
  const borderHover = darkenHex(t.colors.border, 0.1);

  // Section background styles
  const sectionWhite: CSSProperties = {
    backgroundColor: isDark ? "#111827" : t.colors.background,
    color: isDark ? "#f9fafb" : t.colors.text,
  };
  const sectionLight: CSSProperties = {
    backgroundColor: isDark ? "#1f2937" : t.colors.surface,
    color: isDark ? "#f9fafb" : t.colors.text,
  };
  const sectionDark: CSSProperties = {
    backgroundColor: "#030712",
    color: "#ffffff",
  };
  const sectionAccent: CSSProperties = {
    backgroundColor: t.colors.primary,
    color: primaryText,
  };
  const sectionGradient: CSSProperties = {
    background: isDark
      ? "linear-gradient(to bottom, #1f2937, #111827)"
      : `linear-gradient(to bottom, ${t.colors.surface}, ${t.colors.background})`,
    color: isDark ? "#f9fafb" : t.colors.text,
  };

  return {
    colors: {
      primary: t.colors.primary,
      primaryHover,
      primaryText,
      primaryTint,
      secondary: t.colors.secondary,
      secondaryHover,
      secondaryText,
      background: t.colors.background,
      backgroundAlt: isDark ? "#1f2937" : t.colors.surface,
      surface: t.colors.surface,
      surfaceHover,
      text: t.colors.text,
      textMuted: t.colors.textMuted,
      heading: isDark ? "#f9fafb" : t.colors.text,
      border: t.colors.border,
      borderHover,
      accent: t.colors.accent,
      success: t.colors.success,
      error: t.colors.error,
      overlay: `${t.colors.background}b3`,
    },

    typography: {
      fontFamilyCss: `"${t.typography.fontFamily}", system-ui, -apple-system, sans-serif`,
      headingFontFamilyCss: t.typography.headingFontFamily
        ? `"${t.typography.headingFontFamily}", "${t.typography.fontFamily}", system-ui, sans-serif`
        : `"${t.typography.fontFamily}", system-ui, -apple-system, sans-serif`,
      headingWeight: t.typography.headingWeight,
      baseFontSize: t.typography.baseFontSize,
      lineHeight: t.typography.lineHeight,
    },

    layout: {
      containerMaxWidth: t.layout.containerWidth,
      sectionPaddingClass: SECTION_PADDING_CLASS[t.layout.sectionSpacing] || SECTION_PADDING_CLASS.normal,
      spacing: getSectionSpacing(t.layout.sectionSpacing),
    },

    button: {
      radiusClass: BUTTON_RADIUS_CLASS[t.components.button.radius] || "rounded-lg",
      sizeClass: BUTTON_SIZE_CLASS[t.components.button.size] || BUTTON_SIZE_CLASS.md,
      primaryStyle: {
        backgroundColor: t.colors.primary,
        color: primaryText,
      },
      primaryHoverBg: primaryHover,
      secondaryStyle: {
        borderWidth: "1px",
        borderColor: t.colors.border,
        color: t.colors.text,
        backgroundColor: "transparent",
      },
      secondaryHoverBg: t.colors.surface,
    },

    card: {
      radiusClass: CARD_RADIUS_CLASS[t.components.card.radius] || "rounded-2xl",
      shadowClass: CARD_SHADOW_CLASS[t.components.card.shadow] || "shadow-sm",
      style: {
        borderColor: t.colors.border,
        backgroundColor: isDark ? "#1f2937" : "#ffffff",
      },
      hoverClass: "hover:shadow-md",
    },

    section: {
      white: sectionWhite,
      light: sectionLight,
      dark: sectionDark,
      accent: sectionAccent,
      gradient: sectionGradient,
    },

    navbar: {
      sticky: t.components.navbar.sticky,
      bordered: t.components.navbar.bordered,
      lightStyle: {
        backgroundColor: `${t.colors.background}cc`,
        color: t.colors.text,
        borderColor: t.colors.border,
      },
      darkStyle: {
        backgroundColor: "#030712",
        color: "#ffffff",
        borderColor: "#1f2937",
      },
      transparentStyle: {
        backgroundColor: "transparent",
        color: t.colors.text,
        borderColor: "transparent",
      },
    },

    containerStyle: { maxWidth: t.layout.containerWidth },
    isDark,
  };
}

/* ================================================================== */
/*  Color Accent Tokens (for per-block color overrides)                */
/* ================================================================== */

export interface AccentTokens {
  /** Hex color */
  hex: string;
  /** For buttons on this accent color */
  btnBg: string;
  btnHover: string;
  btnText: string;
  /** Light tint for backgrounds */
  tint: string;
  /** Contrast color for inverted buttons */
  invertBg: string;
  invertText: string;
  invertHover: string;
}

const ACCENT_PALETTE: Record<string, { hex: string; tint: string }> = {
  blue:   { hex: "#2563eb", tint: "#bfdbfe" },
  teal:   { hex: "#0d9488", tint: "#99f6e4" },
  green:  { hex: "#16a34a", tint: "#bbf7d0" },
  red:    { hex: "#dc2626", tint: "#fecaca" },
  pink:   { hex: "#db2777", tint: "#fbcfe8" },
  purple: { hex: "#9333ea", tint: "#e9d5ff" },
  orange: { hex: "#ea580c", tint: "#fed7aa" },
  yellow: { hex: "#eab308", tint: "#fef08a" },
  gray:   { hex: "#374151", tint: "#d1d5db" },
  white:  { hex: "#111827", tint: "#f3f4f6" },
};

/**
 * Get accent tokens for a per-block color override.
 * Falls back to the theme primary color if no valid accent name.
 */
export function getAccentTokens(color: string | undefined, themePrimary: string): AccentTokens {
  const entry = color ? ACCENT_PALETTE[color] : null;
  const hex = entry?.hex || themePrimary;
  const tint = entry?.tint || lightenHex(hex, 0.92);
  const textOnBg = isLightColor(hex) ? "#111827" : "#ffffff";
  const invertBg = isLightColor(hex) ? "#111827" : "#ffffff";
  const invertText = isLightColor(hex) ? "#ffffff" : hex;

  return {
    hex,
    btnBg: hex,
    btnHover: darkenHex(hex, 0.12),
    btnText: textOnBg,
    tint,
    invertBg,
    invertText,
    invertHover: darkenHex(invertBg, 0.08),
  };
}
