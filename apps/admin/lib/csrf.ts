"use client";

/**
 * Read the CSRF token from the cb_csrf cookie.
 * Returns the token string or empty string if not found.
 */
export function getCsrfToken(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/(?:^|;\s*)cb_csrf=([^;]*)/);
  return match ? match[1] : "";
}

/**
 * Build headers including the CSRF token for mutation requests.
 * Merges with any extra headers provided.
 */
export function csrfHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = getCsrfToken();
  return {
    ...(extra || {}),
    ...(token ? { "x-csrf-token": token } : {}),
  };
}
