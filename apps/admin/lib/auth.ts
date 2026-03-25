/*
 * Multi-user auth system for Career Site Builder.
 *
 * Features:
 *   - Multi-user with email + password (hashed with bcrypt, cost 12)
 *   - Roles: super_admin, admin, hiring_manager, recruiter, viewer (RBAC)
 *   - Rate limiting per IP (5 attempts → 60s lockout)
 *   - CSRF double-submit cookie
 *   - iron-session encrypted cookies (AES-256-GCM, tamper-proof)
 *   - Sliding session renewal (7 days of inactivity)
 *   - Transparent migration from legacy SHA-256 hashes to bcrypt
 *   - Audit logging via database
 *   - Database-backed user store via @career-builder/database
 *
 * Env vars:
 *   SESSION_SECRET — 32+ char secret for iron-session (REQUIRED in production)
 *   AUTH_SECRET    — legacy signing secret (kept for hash migration only)
 *   TENANT_ID     — default tenant (default: "default")
 */

import { cookies } from "next/headers";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { getIronSession } from "iron-session";
import { userRepo, auditRepo } from "@career-builder/database";
import { sessionOptions, type SessionData, SESSION_MAX_AGE_SECONDS } from "./session";

const AUTH_SECRET = process.env.AUTH_SECRET || "career-builder-secret-key";
const DEFAULT_TENANT_ID = process.env.TENANT_ID || "default";
const CSRF_COOKIE = "cb_csrf";
const SESSION_MAX_AGE = SESSION_MAX_AGE_SECONDS;
const SESSION_MAX_AGE_MS = SESSION_MAX_AGE * 1000;
const BCRYPT_ROUNDS = 12;

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

export type UserRole = "super_admin" | "admin" | "hiring_manager" | "recruiter" | "viewer";

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: string;
  department?: string | null;
  tenantId: string;
  isActive: boolean;
  createdAt: Date;
  lastLoginAt?: Date | null;
}

export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
  tenantId: string;
  timestamp: number;
}

/* ================================================================== */
/*  Password hashing (bcrypt, cost 12)                                 */
/* ================================================================== */

/**
 * Hash a password with bcrypt (cost 12).
 * Always use this for new passwords and password changes.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Legacy SHA-256 hash — only used to detect old hashes during migration.
 * NEVER use this for new passwords.
 */
function legacySha256Hash(password: string): string {
  return crypto
    .createHash("sha256")
    .update(AUTH_SECRET + password)
    .digest("hex");
}

/**
 * Check if a hash is a legacy SHA-256 hash (64 hex chars, no $ prefix).
 * Bcrypt hashes always start with "$2b$" or "$2a$".
 */
function isLegacyHash(hash: string): boolean {
  return !hash.startsWith("$2") && /^[a-f0-9]{64}$/i.test(hash);
}

/**
 * Verify a password against a stored hash.
 * Supports both bcrypt and legacy SHA-256 hashes.
 *
 * If the hash is a legacy SHA-256 hash and the password matches,
 * the hash is automatically upgraded to bcrypt in the database.
 */
export async function verifyPassword(
  password: string,
  storedHash: string,
  userId?: string,
): Promise<boolean> {
  // Try bcrypt first (preferred path for already-migrated users)
  if (storedHash.startsWith("$2")) {
    return bcrypt.compare(password, storedHash);
  }

  // Legacy SHA-256 path — auto-migrate on successful login
  if (isLegacyHash(storedHash)) {
    const legacyMatch = legacySha256Hash(password) === storedHash;
    if (legacyMatch && userId) {
      // Transparently upgrade to bcrypt
      try {
        const bcryptHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
        await userRepo.update(userId, { passwordHash: bcryptHash });
        console.log(`[auth] Migrated user ${userId} from SHA-256 to bcrypt`);
      } catch (err) {
        // Non-fatal — login still succeeds, migration retries next login
        console.error("[auth] Failed to migrate password hash:", err);
      }
    }
    return legacyMatch;
  }

  // Unknown hash format — reject
  return false;
}

/* ================================================================== */
/*  User operations (database-backed)                                  */
/* ================================================================== */

export async function findUserByEmail(email: string, tenantId?: string): Promise<User | null> {
  return userRepo.findByEmail(email, tenantId || DEFAULT_TENANT_ID);
}

export async function findUserById(id: string): Promise<User | null> {
  return userRepo.findById(id);
}

export async function getAllUsers(tenantId?: string) {
  return userRepo.findByTenant(tenantId || DEFAULT_TENANT_ID);
}

export async function createUser(
  email: string,
  name: string,
  password: string,
  role: UserRole,
  tenantId?: string,
): Promise<User> {
  const tid = tenantId || DEFAULT_TENANT_ID;

  // findByEmail now only returns active users, so this check
  // correctly allows re-creating a previously soft-deleted user.
  const existing = await userRepo.findByEmail(email, tid);
  if (existing) {
    throw new Error("Email already exists");
  }

  // userRepo.create uses upsert — if a soft-deleted record exists
  // with the same email+tenant, it reactivates it with fresh data.
  return userRepo.create({
    email: email.toLowerCase(),
    name,
    passwordHash: await hashPassword(password),
    role,
    tenantId: tid,
  });
}

export async function updateUser(
  id: string,
  updates: { name?: string; role?: UserRole; password?: string; department?: string },
): Promise<User | null> {
  const data: { name?: string; role?: string; passwordHash?: string; department?: string; passwordChangedAt?: Date } = {};
  if (updates.name) data.name = updates.name;
  if (updates.role) data.role = updates.role;
  if (updates.password) {
    data.passwordHash = await hashPassword(updates.password);
    data.passwordChangedAt = new Date();
  }
  if (updates.department !== undefined) data.department = updates.department;
  return userRepo.update(id, data);
}

export async function deleteUser(id: string, tenantId?: string): Promise<boolean> {
  const tid = tenantId || DEFAULT_TENANT_ID;
  const user = await userRepo.findById(id);
  if (!user) return false;
  // Verify user belongs to the caller's tenant
  if (user.tenantId !== tid) return false;
  // Prevent deleting the last admin
  if (user.role === "admin") {
    const adminCount = await userRepo.countAdmins(tid);
    if (adminCount <= 1) return false;
  }
  await userRepo.delete(id);
  return true;
}

export async function updateLastLogin(id: string): Promise<void> {
  await userRepo.updateLastLogin(id);
}

/* ================================================================== */
/*  Audit log (database-backed)                                        */
/* ================================================================== */

export async function writeAuditLog(
  userId: string,
  email: string,
  action: string,
  details?: string,
  tenantId?: string,
): Promise<void> {
  // Verify user exists in DB to avoid FK constraint violation (stale sessions may have old IDs)
  let validUserId: string | undefined = userId;
  if (userId) {
    const user = await userRepo.findById(userId);
    if (!user) validUserId = undefined;
  }
  await auditRepo.log({
    action,
    entity: undefined,
    entityId: undefined,
    details: details ? { message: details } : undefined,
    userId: validUserId,
    tenantId: tenantId || DEFAULT_TENANT_ID,
  });
}

export async function readAuditLog(tenantId?: string) {
  const result = await auditRepo.findByTenant(tenantId || DEFAULT_TENANT_ID, 1, 500);
  return result.data;
}

/* ================================================================== */
/*  Rate limiting (in-memory)                                          */
/* ================================================================== */

const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 60_000;

export function checkRateLimit(ip: string): number {
  const record = loginAttempts.get(ip);
  if (!record) return 0;
  const elapsed = Date.now() - record.lastAttempt;
  if (elapsed > LOCKOUT_MS) { loginAttempts.delete(ip); return 0; }
  if (record.count < MAX_ATTEMPTS) return 0;
  return Math.ceil((LOCKOUT_MS - elapsed) / 1000);
}

export function recordFailedAttempt(ip: string): void {
  const record = loginAttempts.get(ip) || { count: 0, lastAttempt: 0 };
  record.count += 1;
  record.lastAttempt = Date.now();
  loginAttempts.set(ip, record);
}

export function clearAttempts(ip: string): void {
  loginAttempts.delete(ip);
}

/* ================================================================== */
/*  Session management (iron-session — encrypted, tamper-proof)        */
/* ================================================================== */

/**
 * Get the iron-session from the request cookies.
 * iron-session encrypts the cookie with AES-256-GCM — it cannot be
 * read, forged, or tampered with by the client.
 */
async function getIronSessionFromCookies() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

/* ================================================================== */
/*  CSRF protection (double-submit cookie pattern)                     */
/* ================================================================== */

export async function generateCsrfToken(): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set(CSRF_COOKIE, token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return token;
}

export async function validateCsrf(request: Request): Promise<boolean> {
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(CSRF_COOKIE)?.value;
  const headerToken = request.headers.get("x-csrf-token");

  if (!cookieToken || !headerToken) return false;
  return cookieToken === headerToken;
}

/* ================================================================== */
/*  Session management                                                 */
/* ================================================================== */

export async function setSession(user: User): Promise<void> {
  const session = await getIronSessionFromCookies();
  session.userId = user.id;
  session.email = user.email;
  session.name = user.name;
  session.role = user.role as UserRole;
  session.tenantId = user.tenantId;
  session.issuedAt = Date.now();
  await session.save();
  await generateCsrfToken();
}

export async function clearSession(): Promise<void> {
  const session = await getIronSessionFromCookies();
  session.destroy();
  const cookieStore = await cookies();
  cookieStore.delete(CSRF_COOKIE);
}

/**
 * Get current session. Returns null if not authenticated.
 * Performs sliding renewal on each call.
 *
 * ⚠️  Only use in Route Handlers / Server Actions — it writes a cookie.
 *     For Server Component pages, use getSessionReadOnly() instead.
 */
export async function getSession(): Promise<SessionPayload | null> {
  const session = await getIronSessionFromCookies();

  // iron-session returns an empty object if no valid session exists
  if (!session.userId) return null;

  // Check expiry (sliding window)
  if (session.issuedAt && Date.now() - session.issuedAt > SESSION_MAX_AGE_MS) {
    session.destroy();
    return null;
  }

  // Verify the user still exists and is active (handles mid-session deactivation)
  const user = await userRepo.findById(session.userId);
  if (!user || !user.isActive) {
    session.destroy();
    return null;
  }

  // Invalidate sessions issued before a password change.
  // When a user changes their password (or an admin resets it), all
  // pre-existing sessions must be invalidated to prevent stale access.
  if (user.passwordChangedAt && session.issuedAt) {
    const pwChangedMs = new Date(user.passwordChangedAt).getTime();
    if (session.issuedAt < pwChangedMs) {
      console.log(`[auth] Session invalidated for ${user.email}: issued before password change`);
      session.destroy();
      return null;
    }
  }

  // Sync session with DB — if role, name, or email changed since session was issued,
  // update the cookie so RBAC decisions always use the latest DB state.
  // This prevents privilege escalation when a user's role is changed by an admin.
  const dbRole = user.role as UserRole;
  const dbName = user.name;
  const dbEmail = user.email;
  if (session.role !== dbRole || session.name !== dbName || session.email !== dbEmail) {
    session.role = dbRole;
    session.name = dbName;
    session.email = dbEmail;
    console.log(`[auth] Session synced for ${user.email}: role=${dbRole}, name=${dbName}`);
  }

  // Sliding renewal — refresh issuedAt
  session.issuedAt = Date.now();
  await session.save();

  return {
    userId: session.userId,
    email: session.email,
    name: session.name,
    role: session.role,
    tenantId: session.tenantId,
    timestamp: session.issuedAt,
  };
}

/**
 * Read-only session check — safe to call from Server Component pages.
 * Does NOT perform sliding renewal (no cookie write).
 *
 * Verifies the user is still active in the database to prevent
 * soft-deleted users from retaining access via stale sessions.
 */
export async function getSessionReadOnly(): Promise<SessionPayload | null> {
  const session = await getIronSessionFromCookies();

  if (!session.userId) return null;

  // Check expiry
  if (session.issuedAt && Date.now() - session.issuedAt > SESSION_MAX_AGE_MS) {
    return null;
  }

  // Verify user is still active (handles mid-session deactivation)
  const user = await userRepo.findById(session.userId);
  if (!user || !user.isActive) {
    return null;
  }

  // Invalidate sessions issued before a password change
  if (user.passwordChangedAt && session.issuedAt) {
    const pwChangedMs = new Date(user.passwordChangedAt).getTime();
    if (session.issuedAt < pwChangedMs) {
      return null;
    }
  }

  // Always return the role/name/email from DB, not the (possibly stale) session cookie.
  // This ensures RBAC decisions in Server Components use the latest DB state even though
  // we can't write an updated cookie here (read-only path).
  return {
    userId: session.userId,
    email: user.email,
    name: user.name,
    role: user.role as UserRole,
    tenantId: session.tenantId,
    timestamp: session.issuedAt,
  };
}

/** Convenience: just check if session exists (for backward compat) */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession();
  return session !== null;
}

/** Check if current user has a specific role or higher */
export async function hasRole(requiredRole: UserRole): Promise<boolean> {
  const session = await getSession();
  if (!session) return false;

  const hierarchy: Record<UserRole, number> = {
    viewer: 0,
    recruiter: 1,
    hiring_manager: 2,
    admin: 3,
    super_admin: 4,
  };
  return (hierarchy[session.role] ?? 0) >= (hierarchy[requiredRole] ?? 0);
}

/** Get the default tenant ID for the admin app */
export function getDefaultTenantId(): string {
  return DEFAULT_TENANT_ID;
}

