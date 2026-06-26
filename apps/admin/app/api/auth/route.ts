/*
 * /api/auth — admin/recruiter authentication endpoint (login / logout / session check).
 *
 * WHY: This is the front door to the admin app. Every recruiter session starts here,
 * so it concentrates the auth-critical concerns: credential verification, brute-force
 * lockout, session cookie issuance, and audit logging.
 *
 * HOW it fits in:
 *   - POST   = login (email + password), DELETE = logout, GET = read-only session check.
 *   - Mutating handlers (POST/DELETE) use setSession()/clearSession(); GET uses
 *     getSessionReadOnly() so it never writes a cookie (safe for caching/preflight).
 *   - All handlers are wrapped in withRequestLogging() for structured logs + metrics.
 *   - Rate limiting is keyed on the *trusted* client IP (see getClientIp) and is
 *     consistent with the edge limiter so lockout keys match across layers.
 *   - Failure responses are deliberately uniform ("Invalid email or password") to avoid
 *     account enumeration; the specific reason is only recorded in metrics/logs.
 *   - Tenant scoping rides along on the user/session (user.tenantId), not via a query param.
 */
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import {
  findUserByEmail,
  verifyPassword,
  updateLastLogin,
  setSession,
  clearSession,
  getSession,
  getSessionReadOnly,
  checkRateLimit,
  recordFailedAttempt,
  clearAttempts,
  writeAuditLog,
} from "@/lib/auth";
import { loginSchema, safeParse } from "@career-builder/security/validate";
import { sanitizeEmail } from "@career-builder/security/sanitize";
import { withRequestLogging, recordLoginFailure } from "@career-builder/observability/request-logger";
import { logger } from "@career-builder/observability/logger";
import { metrics, METRIC } from "@career-builder/observability/metrics";

const log = logger.security;

function getClientIp(headersList: Headers): string {
  // Trusted client IP for login lockout keys. Using the leftmost (spoofable)
  // XFF entry let an attacker rotate the lockout key per attempt OR lock out a
  // victim IP. Prefer platform headers, else the trusted RIGHTMOST hop —
  // consistent with the edge rate limiter so keys match across layers.
  const cfIp = headersList.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();
  const vercelIp = headersList.get("x-vercel-forwarded-for") || headersList.get("x-real-ip");
  if (vercelIp) return vercelIp.split(",")[0]!.trim();
  const xff = headersList.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length > 0) {
      const trusted = Math.max(1, parseInt(process.env.TRUSTED_PROXY_COUNT || "1", 10) || 1);
      return parts[Math.max(0, parts.length - trusted)]!;
    }
  }
  return "unknown";
}

/** POST /api/auth — login with email + password (rate-limited) */
export const POST = withRequestLogging(async (req: Request) => {
  const headersList = await headers();
  const ip = getClientIp(headersList);

  // Rate limit check
  const lockoutSeconds = checkRateLimit(ip);
  if (lockoutSeconds > 0) {
    log.warn("login_rate_limited", { ip, lockoutSeconds });
    return NextResponse.json(
      { error: `Too many attempts. Try again in ${lockoutSeconds}s.` },
      { status: 429 }
    );
  }

  const body = await req.json();

  // Validate with Zod schema
  const parsed = safeParse(loginSchema, body);
  if (!parsed.success) {
    recordFailedAttempt(ip);
    recordLoginFailure();
    metrics.increment(METRIC.LOGIN_FAILURES, { reason: "validation" });
    return NextResponse.json({ error: "Email and password are required" }, { status: 401 });
  }

  const email = sanitizeEmail(parsed.data.email);
  if (!email) {
    recordFailedAttempt(ip);
    recordLoginFailure();
    metrics.increment(METRIC.LOGIN_FAILURES, { reason: "invalid_email" });
    return NextResponse.json({ error: "Invalid email format" }, { status: 401 });
  }

  let user;
  try {
    user = await findUserByEmail(email);
  } catch (dbErr: any) {
    console.error("[auth] Database error during login:", dbErr.message, dbErr.stack);
    const isDev = process.env.NODE_ENV !== "production";
    return NextResponse.json(
      { error: isDev ? `Database error: ${dbErr.message}` : "Internal server error" },
      { status: 500 },
    );
  }

  // Bad-credentials path is intentionally identical for "no such user" and "wrong
  // password" (same response + metric reason) to prevent account enumeration.
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash, user.id))) {
    recordFailedAttempt(ip);
    recordLoginFailure();
    metrics.increment(METRIC.LOGIN_FAILURES, { reason: "bad_credentials" });
    log.warn("login_failed", { ip, email: email[0] + "***" });
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  // Defense-in-depth: reject deactivated users even if findByEmail somehow returns them
  if (!user.isActive) {
    recordFailedAttempt(ip);
    recordLoginFailure();
    metrics.increment(METRIC.LOGIN_FAILURES, { reason: "inactive_user" });
    log.warn("login_inactive_user", { ip, userId: user.id });
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  clearAttempts(ip);
  try {
    await updateLastLogin(user.id);
  } catch (err) {
    console.error("[auth] Failed to update lastLoginAt for user", user.id, err instanceof Error ? err.message : err);
    // non-fatal — don't block login if this fails
  }
  await setSession(user);
  metrics.increment(METRIC.LOGINS_TOTAL, { tenantId: user.tenantId });
  log.info("login_success", { userId: user.id, tenantId: user.tenantId });

  try {
    await writeAuditLog(user.id, user.email, "login", `IP: ${ip}`);
  } catch {
    // non-fatal
  }

  return NextResponse.json({
    success: true,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
});

/** DELETE /api/auth — logout */
export const DELETE = withRequestLogging(async () => {
  const session = await getSession();
  if (session) {
    try {
      await writeAuditLog(session.userId, session.email, "logout");
    } catch {
      // non-fatal
    }
  }
  await clearSession();
  return NextResponse.json({ success: true });
});

/** GET /api/auth — check session status + return user info (read-only, no cookie write) */
export const GET = withRequestLogging(async () => {
  const session = await getSessionReadOnly();
  if (!session) {
    return NextResponse.json({ authenticated: false });
  }
  return NextResponse.json({
    authenticated: true,
    user: {
      id: session.userId,
      email: session.email,
      name: session.name,
      role: session.role,
      tenantId: session.tenantId,
    },
  });
});