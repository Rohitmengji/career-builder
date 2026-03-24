/*
 * ThemeProvider — React context that makes tenant theme available to all blocks.
 *
 * Architecture:
 *   1. Normalizes + validates theme on entry (never trusts raw input)
 *   2. Generates design tokens once (memoized)
 *   3. Injects CSS custom properties onto :root via <style>
 *   4. Loads Google Fonts dynamically
 *   5. Provides useTheme() hook with tokens — components never read raw theme
 *   6. Debug mode logs fallback usage in development
 *
 * Usage:
 *   <ThemeProvider theme={tenantConfig.theme} branding={tenantConfig.branding}>
 *     <RenderPage blocks={blocks} />
 *   </ThemeProvider>
 *
 *   const { tokens, branding } = useTheme();
 */

"use client";

import React, { createContext, useContext, useMemo } from "react";
import {
  type TenantTheme,
  type TenantBranding,
  type DesignTokens,
  DEFAULT_THEME,
  DEFAULT_BRANDING,
  normalizeTheme,
  validateBranding,
  getDesignTokens,
  getAccentTokens,
  themeToCssVars,
  getGoogleFontsUrl,
  darkenHex,
  lightenHex,
  isLightColor,
} from "@career-builder/tenant-config";

/* ================================================================== */
/*  Context Type                                                       */
/* ================================================================== */

export interface ThemeContextValue {
  /** Validated, normalized theme */
  theme: TenantTheme;
  /** Validated branding */
  branding: TenantBranding;
  /** Pre-computed design tokens — USE THESE in components */
  tokens: DesignTokens;
  /** CSS vars object (for injection) */
  cssVars: Record<string, string>;
  /** Get accent tokens for per-block color overrides */
  getAccent: (color?: string) => ReturnType<typeof getAccentTokens>;

  /* ── Legacy compatibility (these delegate to tokens) ────────── */
  /** @deprecated Use tokens.button.radiusClass */
  btnRadiusClass: string;
  /** @deprecated Use tokens.card.radiusClass */
  cardRadiusClass: string;
  /** @deprecated Use tokens.card.shadowClass */
  cardShadowClass: string;
  /** @deprecated Use tokens.containerStyle */
  containerStyle: React.CSSProperties;
  /** @deprecated Use tokens.button.primaryStyle */
  primaryBtnStyle: React.CSSProperties;
  /** @deprecated Use tokens.colors.primaryHover */
  primaryHoverColor: string;
  /** @deprecated Use tokens.layout.sectionPaddingClass */
  sectionPaddingClass: string;
  /** @deprecated Use tokens.isDark */
  isDark: boolean;
  /** @deprecated Use tokens.layout.spacing */
  spacing: DesignTokens["layout"]["spacing"];
  /** @deprecated Use darkenHex directly from tenant-config */
  darken: typeof darkenHex;
  /** @deprecated Use lightenHex directly from tenant-config */
  lighten: typeof lightenHex;
  /** @deprecated Use isLightColor directly from tenant-config */
  isLight: typeof isLightColor;
}

/* ================================================================== */
/*  Context + Hook                                                     */
/* ================================================================== */

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Access theme tokens. Always returns a valid context value.
 * Safe to call outside ThemeProvider — returns defaults.
 */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Safe fallback — never break rendering
    return buildThemeValue(DEFAULT_THEME, DEFAULT_BRANDING);
  }
  return ctx;
}

/* ================================================================== */
/*  Build the full context value                                       */
/* ================================================================== */

function buildThemeValue(theme: TenantTheme, branding: TenantBranding): ThemeContextValue {
  const tokens = getDesignTokens(theme);

  return {
    theme,
    branding,
    tokens,
    cssVars: themeToCssVars(theme),
    getAccent: (color?: string) => getAccentTokens(color, theme.colors.primary),

    // Legacy compatibility — delegate to tokens
    btnRadiusClass: tokens.button.radiusClass,
    cardRadiusClass: tokens.card.radiusClass,
    cardShadowClass: tokens.card.shadowClass,
    containerStyle: tokens.containerStyle as React.CSSProperties,
    primaryBtnStyle: tokens.button.primaryStyle as React.CSSProperties,
    primaryHoverColor: tokens.colors.primaryHover,
    sectionPaddingClass: tokens.layout.sectionPaddingClass,
    isDark: tokens.isDark,
    spacing: tokens.layout.spacing,
    darken: darkenHex,
    lighten: lightenHex,
    isLight: isLightColor,
  };
}

/* ================================================================== */
/*  Provider Component                                                 */
/* ================================================================== */

export function ThemeProvider({
  theme: rawTheme,
  branding: rawBranding,
  children,
}: {
  theme?: TenantTheme | Partial<TenantTheme>;
  branding?: TenantBranding | Partial<TenantBranding>;
  children: React.ReactNode;
}) {
  // Normalize + validate on entry — safe even with garbage input
  const theme = useMemo(() => normalizeTheme(rawTheme as Partial<TenantTheme>), [rawTheme]);
  const branding = useMemo(() => validateBranding(rawBranding as Partial<TenantBranding>), [rawBranding]);

  // Build full context value — memoized to prevent re-renders
  const value = useMemo(() => buildThemeValue(theme, branding), [theme, branding]);

  // Generate CSS var injection string
  const cssVarString = useMemo(() => {
    const entries = Object.entries(value.cssVars)
      .map(([k, v]) => `${k}: ${v};`)
      .join("\n    ");
    return `
  :root {
    ${entries}
  }
  body {
    font-family: var(--cb-font-family);
    font-size: var(--cb-font-size-base);
    line-height: var(--cb-line-height);
    color: var(--cb-color-text);
    background-color: var(--cb-color-background);
  }
  h1, h2, h3, h4, h5, h6 {
    font-family: var(--cb-font-heading);
    font-weight: var(--cb-font-weight-heading);
  }
`;
  }, [value.cssVars]);

  const fontsUrl = useMemo(() => getGoogleFontsUrl(theme), [theme]);

  return (
    <ThemeContext.Provider value={value}>
      {/* Google Fonts */}
      {fontsUrl && (
        // eslint-disable-next-line @next/next/no-page-custom-font
        <link rel="stylesheet" href={fontsUrl} />
      )}
      {/* CSS custom properties */}
      <style dangerouslySetInnerHTML={{ __html: cssVarString }} />
      {children}
    </ThemeContext.Provider>
  );
}

