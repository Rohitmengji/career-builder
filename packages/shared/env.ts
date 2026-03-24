/*
 * @career-builder/shared — Unified Environment Helpers
 *
 * Single source of truth for URL resolution across all apps.
 * Handles: development, preview (Vercel PR deploys), production.
 *
 * RULES:
 *   - production → throw if critical env missing
 *   - preview    → allow VERCEL_URL fallback
 *   - dev        → allow localhost fallback
 *   - NEVER expose server-only secrets to client (no NEXT_PUBLIC_ prefix)
 */

/* ================================================================== */
/*  Environment detection                                              */
/* ================================================================== */

export type DeployEnv = "development" | "preview" | "production";

export function getDeployEnv(): DeployEnv {
  // Vercel sets VERCEL_ENV automatically
  const vercelEnv = process.env.VERCEL_ENV;
  if (vercelEnv === "production") return "production";
  if (vercelEnv === "preview") return "preview";

  // Fallback for non-Vercel
  if (process.env.NODE_ENV === "production") return "production";
  return "development";
}

export function isProduction(): boolean {
  return getDeployEnv() === "production";
}

export function isPreview(): boolean {
  return getDeployEnv() === "preview";
}

export function isDevelopment(): boolean {
  return getDeployEnv() === "development";
}

/* ================================================================== */
/*  URL resolution                                                     */
/* ================================================================== */

/**
 * Get the base URL for the web (public) app.
 *
 * Resolution order:
 *   1. NEXT_PUBLIC_SITE_URL env var (explicit override)
 *   2. Vercel auto-URL (preview/production)
 *   3. localhost:3000 (development only)
 */
export function getBaseUrl(): string {
  // Explicit env var always wins
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit?.trim()) return explicit.trim().replace(/\/$/, "");

  // Vercel auto-set URL
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // Production without URL = fatal
  if (isProduction()) {
    throw new Error(
      "[env] NEXT_PUBLIC_SITE_URL is required in production. " +
      "Set it in your Vercel project environment variables."
    );
  }

  return "http://localhost:3000";
}

/**
 * Get the base URL for the admin app.
 *
 * Resolution order:
 *   1. NEXT_PUBLIC_APP_URL env var
 *   2. NEXT_PUBLIC_ADMIN_API_URL (legacy alias)
 *   3. Vercel auto-URL (for single-project deploys)
 *   4. localhost:3001 (development only)
 */
export function getAdminUrl(): string {
  const explicit =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_ADMIN_API_URL;
  if (explicit?.trim()) return explicit.trim().replace(/\/$/, "");

  // For monorepo single-project deploy on Vercel, admin is the same domain
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  if (isProduction()) {
    throw new Error(
      "[env] NEXT_PUBLIC_APP_URL is required in production. " +
      "Set it in your Vercel project environment variables."
    );
  }

  return "http://localhost:3001";
}

/**
 * Get the internal API URL for server-to-server calls.
 *
 * This is used by the web app to call admin API routes server-side.
 * Resolution order:
 *   1. ADMIN_API_URL (server-only, not exposed to client)
 *   2. NEXT_PUBLIC_APP_URL
 *   3. Vercel auto-URL
 *   4. localhost:3001 (dev only)
 */
export function getApiUrl(): string {
  const serverOnly = process.env.ADMIN_API_URL;
  if (serverOnly?.trim()) return serverOnly.trim().replace(/\/$/, "");

  // Fall back to public admin URL
  return getAdminUrl();
}

/**
 * Get the Stripe-safe webhook URL.
 */
export function getWebhookUrl(): string {
  return `${getAdminUrl()}/api/stripe/webhook`;
}

/* ================================================================== */
/*  Env var access helpers                                             */
/* ================================================================== */

/**
 * Get a required env var. Throws in production if missing.
 * Warns in dev/preview.
 */
export function requireEnv(name: string, options?: { soft?: boolean }): string {
  const val = process.env[name];
  if (val?.trim()) return val.trim();

  if (options?.soft) {
    if (!isDevelopment()) {
      console.warn(`[env] Optional var ${name} not set`);
    }
    return "";
  }

  if (isProduction()) {
    throw new Error(`[env] Required env var ${name} is not set in production`);
  }

  console.warn(`[env] ${name} not set — feature may be disabled`);
  return "";
}

/**
 * Check if we're running on Vercel (any environment).
 */
export function isVercel(): boolean {
  return !!process.env.VERCEL;
}

/**
 * Get the Vercel Git commit SHA (useful for cache busting / versioning).
 */
export function getGitSha(): string {
  return process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "local";
}

/**
 * Determine if Stripe should use test mode.
 * Test mode in: development, preview.
 * Live mode in: production ONLY.
 */
export function isStripeTestMode(): boolean {
  return !isProduction();
}
