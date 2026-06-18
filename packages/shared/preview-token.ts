/*
 * Signed preview tokens — let the admin editor grant a short-lived, tamper-proof
 * link for the public web app to render a page's UNPUBLISHED draft.
 *
 * Both apps share the database, so the web app can read draft blocks directly
 * once a token is verified — no admin-API round-trip. The token is the gate
 * that keeps unpublished drafts from being publicly reachable.
 *
 * Secret: PREVIEW_SECRET (shared by admin + web). Falls back to a deterministic
 * dev secret so local preview works with zero config; REQUIRED in production.
 */

import crypto from "crypto";

const DEFAULT_TTL_SECONDS = 30 * 60; // 30 minutes

function getSecret(): string {
  // MUST be shared between the admin (signer) and web (verifier) apps. Do NOT
  // fall back to SESSION_SECRET — that differs per app, so tokens wouldn't
  // verify cross-app. In dev, both apps use the same deterministic fallback.
  const s = process.env.PREVIEW_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("[preview] PREVIEW_SECRET is required in production (shared by admin + web)");
  }
  return "career-builder-dev-preview-secret-change-me";
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

export interface PreviewClaims {
  tenantId: string;
  slug: string;
}

/** Create a signed preview token for a tenant's page draft. */
export function createPreviewToken(
  tenantId: string,
  slug: string,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${tenantId}:${slug}:${exp}`;
  return `${b64url(payload)}.${sign(payload)}`;
}

/**
 * Verify a preview token. Returns the claims if valid + unexpired, else null.
 * Constant-time signature comparison; verifies the embedded slug/tenant too.
 */
export function verifyPreviewToken(token: string | null | undefined): PreviewClaims | null {
  if (!token || typeof token !== "string") return null;
  const dot = token.lastIndexOf(".");
  if (dot < 1) return null;

  const encodedPayload = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  let payload: string;
  try {
    payload = Buffer.from(encodedPayload, "base64url").toString("utf8");
  } catch {
    return null;
  }

  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  const parts = payload.split(":");
  if (parts.length !== 3) return null;
  const [tenantId, slug, expStr] = parts;
  const exp = Number(expStr);
  if (!tenantId || !slug || !Number.isFinite(exp)) return null;
  if (exp < Math.floor(Date.now() / 1000)) return null; // expired

  return { tenantId, slug };
}
