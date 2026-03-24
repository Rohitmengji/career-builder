/**
 * Iron-session configuration for Career Site Builder.
 *
 * Replaces insecure base64 session tokens with AES-256-GCM encrypted,
 * tamper-proof, stateless cookie sessions.
 *
 * Env vars:
 *   SESSION_SECRET — 32+ char secret for cookie encryption (REQUIRED in production)
 */

import { SessionOptions } from "iron-session";

/* ================================================================== */
/*  Session data shape                                                 */
/* ================================================================== */

export interface SessionData {
  userId: string;
  email: string;
  name: string;
  role: "admin" | "hiring_manager" | "recruiter" | "viewer";
  tenantId: string;
  /** Epoch ms — used for sliding renewal window */
  issuedAt: number;
}

/* ================================================================== */
/*  Configuration                                                      */
/* ================================================================== */

const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days (seconds)

/**
 * The secret MUST be at least 32 characters.
 * In production, SESSION_SECRET must be set as an env var.
 * The dev fallback is deterministic so sessions survive restarts.
 */
function getSessionSecret(): string {
  const envSecret = process.env.SESSION_SECRET;
  if (envSecret) {
    if (envSecret.length < 32) {
      throw new Error("SESSION_SECRET must be at least 32 characters");
    }
    return envSecret;
  }

  // In production at runtime, fail hard — no fallback
  if (process.env.NODE_ENV === "production") {
    // During `next build` (page data collection), allow a build-time placeholder.
    // The real secret is required at runtime when the server starts.
    if (process.env.NEXT_PHASE === "phase-production-build") {
      console.warn(
        "⚠️  SESSION_SECRET not set during build. " +
        "Set it before starting the production server."
      );
      return "build-time-placeholder-secret-not-for-runtime!!";
    }
    throw new Error(
      "SESSION_SECRET environment variable is required in production. " +
      "Generate one with: openssl rand -base64 32"
    );
  }

  // Dev fallback — deterministic so sessions survive restarts
  return "career-builder-dev-secret-at-least-32-chars-long!!";
}

export const sessionOptions: SessionOptions = {
  password: getSessionSecret(),
  cookieName: "cb_session",
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE,
  },
};

export const SESSION_MAX_AGE_SECONDS = SESSION_MAX_AGE;
