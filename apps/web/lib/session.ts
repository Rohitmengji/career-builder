/**
 * Candidate session config for the public career site.
 *
 * Separate from the admin app's staff session. AES-256-GCM encrypted,
 * tamper-proof, stateless iron-session cookie.
 *
 * Env: SESSION_SECRET — 32+ char secret (REQUIRED in production).
 */

import type { SessionOptions } from "iron-session";

export interface CandidateSessionData {
  candidateId: string;
  email: string;
  firstName: string;
  lastName: string;
  tenantId: string;
  /** Epoch ms — issued-at for the session. */
  issuedAt: number;
}

export const CANDIDATE_SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days (seconds)
export const CANDIDATE_SESSION_COOKIE = "cb_candidate_session";

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("[auth] SESSION_SECRET (32+ chars) is required in production");
  }
  // Deterministic dev fallback so sessions survive restarts. NEVER used in prod.
  return "career-builder-dev-candidate-session-secret-change-me";
}

export const candidateSessionOptions: SessionOptions = {
  password: getSessionSecret(),
  cookieName: CANDIDATE_SESSION_COOKIE,
  ttl: CANDIDATE_SESSION_MAX_AGE,
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: CANDIDATE_SESSION_MAX_AGE,
    path: "/",
  },
};
