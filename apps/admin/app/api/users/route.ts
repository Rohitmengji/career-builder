import { NextResponse } from "next/server";
import {
  getSession,
  getSessionReadOnly,
  validateCsrf,
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
  findUserById,
  writeAuditLog,
  type UserRole,
} from "@/lib/auth";
import { createUserSchema, updateUserSchema, safeParse } from "@career-builder/security/validate";
import { sanitizeEmail, sanitizeString } from "@career-builder/security/sanitize";

/** List of emails that are protected — cannot be deleted or have their role changed */
const PROTECTED_ACCOUNTS = new Set(["admin@company.com", "superadmin@company.com"]);

/** The root admin email — only this admin (and super_admin) can change roles */
const ROOT_ADMIN_EMAIL = "admin@company.com";

/** Check if a role is admin-level (admin or super_admin) */
function isAdminRole(role: string): boolean {
  return role === "admin" || role === "super_admin";
}

/** Check if the session user is allowed to manage roles.
 *  Only the root admin (admin@company.com) and super_admin can change other users' roles.
 *  Other admin-level users can view users but NOT change roles. */
function canManageRoles(sessionEmail: string, sessionRole: string): boolean {
  return sessionRole === "super_admin" || sessionEmail === ROOT_ADMIN_EMAIL;
}

/** GET /api/users — list all users (admin/super_admin only) */
export async function GET() {
  const session = await getSessionReadOnly();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminRole(session.role)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const users = await getAllUsers(session.tenantId);
  return NextResponse.json({ users });
}

/** POST /api/users — create a new user (admin/super_admin only) */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminRole(session.role)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const csrfValid = await validateCsrf(req);
  if (!csrfValid) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  const body = await req.json();

  // Validate with Zod schema
  const parsed = safeParse(createUserSchema, body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { role, password } = parsed.data;
  const email = sanitizeEmail(parsed.data.email);
  const name = sanitizeString(parsed.data.name, 200);

  // Only super_admin can create super_admin users
  if (role === "super_admin" && session.role !== "super_admin") {
    return NextResponse.json({ error: "Only Super Admin can create Super Admin users." }, { status: 403 });
  }

  if (!email) {
    return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
  }

  try {
    const user = await createUser(email, name, password, role as UserRole, session.tenantId);
    await writeAuditLog(session.userId, session.email, "user_create", `${user.email} (${role})`);
    return NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create user";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/** PUT /api/users — update a user (admin only, or own password) */
export async function PUT(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const csrfValid = await validateCsrf(req);
  if (!csrfValid) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  const body = await req.json();

  // Validate with Zod schema
  const parsed = safeParse(updateUserSchema, body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { id } = parsed.data;

  // Non-admins can only update their own password/name
  if (!isAdminRole(session.role) && id !== session.userId) {
    return NextResponse.json({ error: "Cannot update other users" }, { status: 403 });
  }

  // PROTECTION: Admin/super_admin passwords can only be changed by themselves.
  if (parsed.data.password && id !== session.userId) {
    const targetUser = await findUserById(id);
    if (targetUser && isAdminRole(targetUser.role)) {
      console.warn(`[users] BLOCKED: ${session.email} tried to reset password for ${targetUser.role} ${targetUser.email}`);
      return NextResponse.json(
        { error: "Admin passwords can only be changed by the admin themselves. Ask them to change it from their Profile settings." },
        { status: 403 },
      );
    }
  }

  // PROTECTION: Protected accounts' roles are immutable.
  if (parsed.data.role) {
    // Only root admin (admin@company.com) and super_admin can change roles
    if (!canManageRoles(session.email, session.role)) {
      console.warn(`[users] BLOCKED: ${session.email} (${session.role}) tried to change role — only root admin or super_admin can manage roles`);
      return NextResponse.json(
        { error: "Only the root admin (admin@company.com) or Super Admin can change user roles." },
        { status: 403 },
      );
    }

    const targetUser = await findUserById(id);
    if (targetUser && PROTECTED_ACCOUNTS.has(targetUser.email)) {
      console.warn(`[users] BLOCKED: ${session.email} tried to change protected account ${targetUser.email} role to ${parsed.data.role}`);
      return NextResponse.json(
        { error: "This account's role cannot be changed." },
        { status: 403 },
      );
    }
    // Only super_admin can assign/change super_admin role
    if (parsed.data.role === "super_admin" && session.role !== "super_admin") {
      return NextResponse.json({ error: "Only Super Admin can assign the Super Admin role." }, { status: 403 });
    }
    // Only super_admin can change an existing admin/super_admin's role
    if (targetUser && isAdminRole(targetUser.role) && session.role !== "super_admin") {
      return NextResponse.json({ error: "Only Super Admin can change admin-level roles." }, { status: 403 });
    }
  }

  const updates: { name?: string; role?: UserRole; password?: string } = {};
  if (parsed.data.name) updates.name = sanitizeString(parsed.data.name, 200);
  if (parsed.data.password) {
    updates.password = parsed.data.password;
  }
  if (parsed.data.role && isAdminRole(session.role)) updates.role = parsed.data.role as UserRole;

  const updated = await updateUser(id, updates);
  if (!updated) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  await writeAuditLog(session.userId, session.email, "user_update", `${updated.email} — fields: ${Object.keys(updates).join(", ")}`);

  return NextResponse.json({
    user: { id: updated.id, email: updated.email, name: updated.name, role: updated.role },
  });
}

/** DELETE /api/users — delete a user (admin/super_admin only) */
export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminRole(session.role)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const csrfValid = await validateCsrf(req);
  if (!csrfValid) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "User ID required" }, { status: 400 });
  }

  if (id === session.userId) {
    return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });
  }

  // PROTECTION: Protected accounts cannot be deleted by anyone.
  const targetUser = await findUserById(id);
  if (targetUser && PROTECTED_ACCOUNTS.has(targetUser.email)) {
    console.warn(`[users] BLOCKED: ${session.email} tried to delete protected account ${targetUser.email}`);
    return NextResponse.json({ error: "This protected account cannot be deleted." }, { status: 403 });
  }

  // Only super_admin can delete admin-level users
  if (targetUser && isAdminRole(targetUser.role) && session.role !== "super_admin") {
    return NextResponse.json({ error: "Only Super Admin can delete admin-level users." }, { status: 403 });
  }

  const deleted = await deleteUser(id, session.tenantId);
  if (!deleted) {
    return NextResponse.json({ error: "User not found or is the last admin" }, { status: 400 });
  }

  await writeAuditLog(session.userId, session.email, "user_delete", `id: ${id}`);

  return NextResponse.json({ success: true });
}
