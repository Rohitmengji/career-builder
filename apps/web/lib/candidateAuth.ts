/**
 * Candidate auth helpers for the public career site.
 *
 * Wraps iron-session for stateless encrypted cookie sessions, password hashing
 * (scrypt, via @career-builder/security), and the password-reset token flow.
 */

import { cookies } from "next/headers";
import { getIronSession, type IronSession } from "iron-session";
import { candidateSessionOptions, type CandidateSessionData } from "./session";
import { candidateRepo } from "@career-builder/database";
import { hashPassword, verifyPassword, generateUrlSafeToken, sha256 } from "@career-builder/security/crypto";
import { getWebTenantId, sessionTenantMatchesHost } from "./tenant-runtime";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

/** Read the iron-session (read/write capable). */
export async function getSession(): Promise<IronSession<CandidateSessionData>> {
  const cookieStore = await cookies();
  return getIronSession<CandidateSessionData>(cookieStore, candidateSessionOptions);
}

/** The currently-authenticated candidate session, or null. */
export async function getCandidateSession(): Promise<CandidateSessionData | null> {
  const session = await getSession();
  return session.candidateId ? session : null;
}

/** Load the fresh candidate record for the current session (null if none / deactivated). */
export async function getCurrentCandidate() {
  const session = await getCandidateSession();
  if (!session) return null;
  // Reject a session minted on another tenant's host (cookie replay across
  // tenants). No-op when multi_tenant_web is off.
  if (!(await sessionTenantMatchesHost(session.tenantId))) return null;
  const candidate = await candidateRepo.findById(session.candidateId, session.tenantId);
  if (!candidate || !candidate.isActive) return null;
  return candidate;
}

async function writeSession(candidate: { id: string; email: string; firstName: string; lastName: string; tenantId: string }) {
  const session = await getSession();
  session.candidateId = candidate.id;
  session.email = candidate.email;
  session.firstName = candidate.firstName;
  session.lastName = candidate.lastName;
  session.tenantId = candidate.tenantId;
  session.issuedAt = Date.now();
  await session.save();
}

export async function clearSession(): Promise<void> {
  const session = await getSession();
  session.destroy();
}

export interface PublicCandidate {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

export type AuthResult =
  | { ok: true; candidate: PublicCandidate }
  | { ok: false; error: string };

/** Strip sensitive fields (passwordHash, reset token) before returning to a client. */
function toPublic(c: { id: string; email: string; firstName: string; lastName: string }): PublicCandidate {
  return { id: c.id, email: c.email, firstName: c.firstName, lastName: c.lastName };
}

/** Register a new candidate and establish a session. */
export async function registerCandidate(input: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase();
  const tenantId = await getWebTenantId();
  const existing = await candidateRepo.findByEmail(email, tenantId);
  if (existing) {
    return { ok: false, error: "An account with this email already exists." };
  }
  const passwordHash = await hashPassword(input.password);
  const candidate = await candidateRepo.create({
    email,
    passwordHash,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    phone: input.phone?.trim() || null,
    tenantId,
  });
  await writeSession(candidate);
  return { ok: true, candidate: toPublic(candidate) };
}

/** Verify credentials and establish a session. Constant message to avoid enumeration. */
export async function loginCandidate(email: string, password: string): Promise<AuthResult> {
  const tenantId = await getWebTenantId();
  const candidate = await candidateRepo.findByEmail(email.trim().toLowerCase(), tenantId);
  const INVALID = "Invalid email or password.";
  if (!candidate || !candidate.isActive) {
    // Still run a hash to keep timing roughly constant.
    await verifyPassword(password, "$scrypt$16384$8$1$0000$0000").catch(() => false);
    return { ok: false, error: INVALID };
  }
  const valid = await verifyPassword(password, candidate.passwordHash);
  if (!valid) return { ok: false, error: INVALID };
  await candidateRepo.recordLogin(candidate.id);
  await writeSession(candidate);
  return { ok: true, candidate: toPublic(candidate) };
}

/**
 * Begin the password-reset flow. Returns the RAW token to email (only stored
 * hashed). Returns null if no account — callers should respond identically
 * either way to avoid account enumeration.
 */
export async function createPasswordResetToken(email: string): Promise<string | null> {
  const tenantId = await getWebTenantId();
  const candidate = await candidateRepo.findByEmail(email.trim().toLowerCase(), tenantId);
  if (!candidate) return null;
  const rawToken = generateUrlSafeToken(32);
  const tokenHash = sha256(rawToken);
  await candidateRepo.setResetToken(candidate.id, tokenHash, new Date(Date.now() + RESET_TOKEN_TTL_MS));
  return rawToken;
}

/** Complete the password-reset flow using the raw token from the email link. */
export async function resetPasswordWithToken(rawToken: string, newPassword: string): Promise<AuthResult> {
  const tokenHash = sha256(rawToken);
  const candidate = await candidateRepo.findByValidResetToken(tokenHash);
  if (!candidate) return { ok: false, error: "This reset link is invalid or has expired." };
  const passwordHash = await hashPassword(newPassword);
  await candidateRepo.setPassword(candidate.id, passwordHash);
  await writeSession(candidate);
  return { ok: true, candidate: toPublic(candidate) };
}
