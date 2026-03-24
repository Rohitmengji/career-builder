import { NextResponse } from "next/server";
import {
  getSession,
  getSessionReadOnly,
  validateCsrf,
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
  writeAuditLog,
  type UserRole,
} from "@/lib/auth";
import { createUserSchema, updateUserSchema, safeParse } from "@career-builder/security/validate";
import { sanitizeEmail, sanitizeString } from "@career-builder/security/sanitize";

/** GET /api/users — list all users (admin only) */
export async function GET() {
  const session = await getSessionReadOnly();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const users = await getAllUsers(session.tenantId);
  return NextResponse.json({ users });
}

/** POST /api/users — create a new user (admin only) */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role !== "admin") {
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
  if (session.role !== "admin" && id !== session.userId) {
    return NextResponse.json({ error: "Cannot update other users" }, { status: 403 });
  }

  const updates: { name?: string; role?: UserRole; password?: string } = {};
  if (parsed.data.name) updates.name = sanitizeString(parsed.data.name, 200);
  if (parsed.data.password) {
    updates.password = parsed.data.password;
  }
  if (parsed.data.role && session.role === "admin") updates.role = parsed.data.role as UserRole;

  const updated = await updateUser(id, updates);
  if (!updated) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  await writeAuditLog(session.userId, session.email, "user_update", `${updated.email} — fields: ${Object.keys(updates).join(", ")}`);

  return NextResponse.json({
    user: { id: updated.id, email: updated.email, name: updated.name, role: updated.role },
  });
}

/** DELETE /api/users — delete a user (admin only) */
export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role !== "admin") {
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

  const deleted = await deleteUser(id, session.tenantId);
  if (!deleted) {
    return NextResponse.json({ error: "User not found or is the last admin" }, { status: 400 });
  }

  await writeAuditLog(session.userId, session.email, "user_delete", `id: ${id}`);

  return NextResponse.json({ success: true });
}
