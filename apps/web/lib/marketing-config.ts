/**
 * Marketing page configuration — shared constants for the landing page.
 *
 * CTAs point to the admin app (where auth lives).
 * In production, set NEXT_PUBLIC_ADMIN_API_URL or NEXT_PUBLIC_APP_URL in .env.
 * On Vercel previews, falls back to VERCEL_URL automatically.
 */

function resolveAdminUrl(): string {
  // Explicit env vars
  const explicit =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_ADMIN_API_URL;
  if (explicit?.trim()) return explicit.trim().replace(/\/$/, "");

  // Vercel auto-URL (preview/production)
  if (typeof window !== "undefined" && window.location.hostname !== "localhost") {
    // Client-side: use same origin (works for single-project deploys)
    return window.location.origin;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:3001";
}

export const ADMIN_URL = resolveAdminUrl();

/** Full login URL on the admin app */
export const LOGIN_URL = `${ADMIN_URL}/login`;

/** Full signup URL (same as login for now) */
export const SIGNUP_URL = `${ADMIN_URL}/login`;
