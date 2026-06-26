/*
 * Settings page — the recruiter-app account & administration surface.
 *
 * WHAT: A single client page with three tabs — Profile (any user), Users and
 * Audit Log (admins only). Profile lets a user edit their own name/password;
 * Users lets admins create/delete users and change roles; Audit Log shows the
 * activity feed.
 *
 * WHY: Centralizes self-service account management and tenant administration so
 * recruiters/admins never touch the DB directly. Role gating here is UX only —
 * the real authorization is enforced server-side by /api/users and /api/audit.
 *
 * HOW: Client component guarded by useAuthGuard(); all reads/writes go through
 * the admin API routes. Every mutating fetch (PUT/POST/DELETE) sends the CSRF
 * token via the x-csrf-token header (validateCsrf on the server) — see getCsrfToken
 * below, which reads the cb_csrf cookie. Role-management rules (who can edit whom)
 * are mirrored client-side to disable controls, but the server is the source of
 * truth. Protected accounts (admin@/superadmin@company.com) are special-cased.
 */
"use client";

import * as React from "react";
import { useEffect, useState, useCallback, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuthGuard } from "@/lib/useAuthGuard";
import {
  Button,
  ButtonLink,
  Field,
  PasswordField,
  Card,
  Badge,
  Alert,
  Skeleton,
  ArrowLeftIcon,
} from "@/components/ui";

interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: "super_admin" | "admin" | "hiring_manager" | "recruiter" | "viewer";
}

interface UserRecord {
  id: string;
  email: string;
  name: string;
  role: "super_admin" | "admin" | "hiring_manager" | "recruiter" | "viewer";
  createdAt: string;
  lastLoginAt?: string | null;
}

interface AuditEntry {
  timestamp: string;
  userId: string;
  email: string;
  action: string;
  details?: string;
}

type Toast = { tone: "success" | "error" | "info"; message: string } | null;

function getCsrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)cb_csrf=([^;]*)/);
  return match ? match[1] : "";
}

/* ─── Icons (decorative, aria-hidden) ───────────────────────────── */
function UserIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
function UsersIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}
function LogIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </svg>
  );
}
function RefreshIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M23 4v6h-6M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
    </svg>
  );
}

/* ─── Role badge ────────────────────────────────────────────────── */
const ROLE_LABEL: Record<SessionUser["role"], string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  hiring_manager: "Hiring Manager",
  recruiter: "Recruiter",
  viewer: "Viewer",
};

const ROLE_BADGE: Record<SessionUser["role"], string> = {
  super_admin: "bg-red-50 text-red-700",
  admin: "bg-purple-50 text-purple-700",
  hiring_manager: "bg-blue-50 text-blue-700",
  recruiter: "bg-teal-50 text-teal-700",
  viewer: "bg-gray-100 text-gray-700",
};

function RoleBadge({ role }: { role: SessionUser["role"] }) {
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${ROLE_BADGE[role]}`}>
      {ROLE_LABEL[role]}
    </span>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const { user: authUser, loading: authLoading } = useAuthGuard();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [tab, setTab] = useState<"profile" | "users" | "audit">("profile");
  const [toast, setToast] = useState<Toast>(null);

  // Profile form
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Users list
  const [users, setUsers] = useState<UserRecord[]>([]);

  // New user form
  const [showNewUser, setShowNewUser] = useState(false);
  const [nuEmail, setNuEmail] = useState("");
  const [nuName, setNuName] = useState("");
  const [nuPassword, setNuPassword] = useState("");
  const [nuRole, setNuRole] = useState<"super_admin" | "admin" | "hiring_manager" | "recruiter" | "viewer">("viewer");

  // Audit
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);

  // Reset password modal
  const [resetPasswordUser, setResetPasswordUser] = useState<{ id: string; email: string; name: string } | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirm, setResetConfirm] = useState("");

  const showToast = (tone: "success" | "error" | "info", message: string) => {
    setToast({ tone, message });
    setTimeout(() => setToast(null), 3500);
  };

  /* ── Auth check ───────────────────────────────────────────────── */
  useEffect(() => {
    if (authLoading || !authUser) return;
    // Syncing local form state from the external auth source once it resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUser(authUser as SessionUser);
    setNewName(authUser.name);
  }, [authLoading, authUser]);

  /* ── Load users (admin only) ──────────────────────────────────── */
  const loadUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
      }
    } catch (err) {
      console.error("[settings] Failed to load users:", err);
    }
  }, []);

  /* ── Load audit (admin only) ──────────────────────────────────── */
  const loadAudit = useCallback(async () => {
    try {
      const res = await fetch("/api/audit");
      if (res.ok) {
        const data = await res.json();
        setAuditEntries(data.entries);
      }
    } catch (err) {
      console.error("[settings] Failed to load audit log:", err);
    }
  }, []);

  useEffect(() => {
    if (user?.role === "admin" || user?.role === "super_admin") {
      // Data fetches that update state asynchronously, not synchronous renders.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (tab === "users") loadUsers();
      if (tab === "audit") loadAudit();
    }
  }, [tab, user, loadUsers, loadAudit]);

  /* ── Update profile ───────────────────────────────────────────── */
  const handleUpdateProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (newPassword && newPassword !== confirmPassword) {
      showToast("error", "Passwords don't match");
      return;
    }
    if (newPassword && newPassword.length < 6) {
      showToast("error", "Password must be at least 6 characters");
      return;
    }

    const updates: any = { id: user.id };
    if (newName && newName !== user.name) updates.name = newName;
    if (newPassword) updates.password = newPassword;

    if (!updates.name && !updates.password) {
      showToast("info", "No changes to save");
      return;
    }

    const res = await fetch("/api/users", {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-csrf-token": getCsrfToken() },
      body: JSON.stringify(updates),
    });

    if (res.ok) {
      const data = await res.json();
      setUser((prev) => prev ? { ...prev, name: data.user.name } : prev);
      setNewPassword("");
      setConfirmPassword("");
      showToast("success", "Profile updated");
    } else {
      const data = await res.json().catch(() => ({}));
      showToast("error", data.error || "Update failed");
    }
  };

  /* ── Create user ──────────────────────────────────────────────── */
  const handleCreateUser = async (e: FormEvent) => {
    e.preventDefault();

    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": getCsrfToken() },
      body: JSON.stringify({ email: nuEmail, name: nuName, password: nuPassword, role: nuRole }),
    });

    if (res.ok) {
      setShowNewUser(false);
      setNuEmail("");
      setNuName("");
      setNuPassword("");
      setNuRole("viewer");
      loadUsers();
      showToast("success", "User created");
    } else {
      const data = await res.json().catch(() => ({}));
      showToast("error", data.error || "Failed to create user");
    }
  };

  /* ── Delete user ──────────────────────────────────────────────── */
  const handleDeleteUser = async (id: string, email: string) => {
    if (!confirm(`Delete user ${email}? This cannot be undone.`)) return;

    const res = await fetch(`/api/users?id=${id}`, {
      method: "DELETE",
      headers: { "x-csrf-token": getCsrfToken() },
    });

    if (res.ok) {
      loadUsers();
      showToast("success", "User deleted");
    } else {
      const data = await res.json().catch(() => ({}));
      showToast("error", data.error || "Failed to delete user");
    }
  };

  /* ── Change role ──────────────────────────────────────────────── */
  const handleRoleChange = async (id: string, newRole: string) => {
    // Safety: if admin is demoting themselves, confirm first
    const isSelfDemotion = id === user?.id && newRole !== user?.role;
    const isDemotion = isSelfDemotion && (
      newRole === "viewer" || newRole === "recruiter" || newRole === "hiring_manager"
    );
    if (isDemotion) {
      const confirmed = confirm(
        `You are about to change YOUR OWN role to "${newRole}". You will lose admin access and won't be able to undo this yourself. Continue?`
      );
      if (!confirmed) {
        // Re-render to reset the select back to the original value
        loadUsers();
        return;
      }
    }

    const res = await fetch("/api/users", {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-csrf-token": getCsrfToken() },
      body: JSON.stringify({ id, role: newRole }),
    });

    if (res.ok) {
      // If user changed their own role, update local state and redirect if demoted
      if (id === user?.id) {
        const newRoleTyped = newRole as SessionUser["role"];
        setUser((prev) => prev ? { ...prev, role: newRoleTyped } : prev);
        const isStillAdmin = newRole === "admin" || newRole === "super_admin";
        if (!isStillAdmin) {
          showToast("success", "Role updated — redirecting (you no longer have admin access)");
          setTimeout(() => router.push("/editor"), 1500);
          return;
        }
      }
      loadUsers();
      showToast("success", "Role updated");
    } else {
      const data = await res.json().catch(() => ({}));
      showToast("error", data.error || "Failed to update role");
      // Reset the select to the original value on failure
      loadUsers();
    }
  };

  /* ── Admin reset password for another user ────────────────────── */
  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!resetPasswordUser) return;

    if (resetPassword.length < 6) {
      showToast("error", "Password must be at least 6 characters");
      return;
    }
    if (resetPassword !== resetConfirm) {
      showToast("error", "Passwords don't match");
      return;
    }

    const res = await fetch("/api/users", {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-csrf-token": getCsrfToken() },
      body: JSON.stringify({ id: resetPasswordUser.id, password: resetPassword }),
    });

    if (res.ok) {
      setResetPasswordUser(null);
      setResetPassword("");
      setResetConfirm("");
      showToast("success", `Password reset for ${resetPasswordUser.email}`);
    } else {
      const data = await res.json().catch(() => ({}));
      showToast("error", data.error || "Failed to reset password");
    }
  };

  if (!user) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
          <Skeleton className="h-8 w-48" />
          <div className="mt-8 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-2/3" />
          </div>
        </div>
      </main>
    );
  }

  const isAdmin = user.role === "admin" || user.role === "super_admin";
  const isSuperAdmin = user.role === "super_admin";
  /** All admins can manage lower-level roles. Only super_admin can manage admin-level roles. */
  const canManageRoles = isAdmin;

  const tabBtn = (active: boolean) =>
    `inline-flex min-h-[44px] items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-t-md ${
      active
        ? "border-blue-600 text-blue-700"
        : "border-transparent text-gray-600 hover:text-gray-900"
    }`;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <ButtonLink href="/editor" variant="ghost" size="sm" aria-label="Back to editor">
              <ArrowLeftIcon className="h-4 w-4" />
              Editor
            </ButtonLink>
            <h1 className="text-lg font-semibold text-gray-900">Settings</h1>
          </div>
          <div className="flex items-center gap-2">
            {(user.role === "admin" || user.role === "super_admin") && (
              <ButtonLink href="/domains" variant="ghost" size="sm">
                Custom domains
              </ButtonLink>
            )}
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white" aria-hidden="true">
              {user.name.charAt(0).toUpperCase()}
            </span>
            <span className="hidden text-sm text-gray-700 sm:inline">{user.name}</span>
          </div>
        </div>
      </header>

      {/* Toast / live region */}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4" role="status" aria-live="polite">
        {toast && (
          <div className="pointer-events-auto w-full max-w-sm animate-fade-in">
            <Alert tone={toast.tone}>{toast.message}</Alert>
          </div>
        )}
      </div>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        {/* Tabs */}
        <div className="mb-8 flex gap-1 overflow-x-auto border-b border-gray-200" role="tablist" aria-label="Settings sections">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "profile"}
            onClick={() => setTab("profile")}
            className={tabBtn(tab === "profile")}
          >
            <UserIcon /> Profile
          </button>
          {isAdmin && (
            <>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "users"}
                onClick={() => setTab("users")}
                className={tabBtn(tab === "users")}
              >
                <UsersIcon /> Users
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "audit"}
                onClick={() => setTab("audit")}
                className={tabBtn(tab === "audit")}
              >
                <LogIcon /> Audit Log
              </button>
            </>
          )}
        </div>

        {/* ── Profile tab ───────────────────────────────────────────── */}
        {tab === "profile" && (
          <Card className="max-w-xl">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Your Profile</h2>
              <p className="mt-1 text-sm text-gray-600">Update your name or change your password.</p>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-5">
              <Field
                label="Email"
                type="email"
                value={user.email}
                disabled
                readOnly
                hint="Email cannot be changed"
              />

              <Field
                label="Display Name"
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoComplete="name"
              />

              <div>
                <span className="mb-1.5 block text-sm font-medium text-gray-700">Role</span>
                <RoleBadge role={user.role} />
              </div>

              <hr className="border-gray-200" />

              <PasswordField
                label="New Password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Leave blank to keep current"
                autoComplete="new-password"
                hint="Minimum 6 characters."
              />

              <PasswordField
                label="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-type new password"
                autoComplete="new-password"
              />

              <Button type="submit">Save Changes</Button>
            </form>
          </Card>
        )}

        {/* ── Users tab (admin only) ────────────────────────────────── */}
        {tab === "users" && isAdmin && (
          <div>
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">User Management</h2>
                <p className="mt-1 text-sm text-gray-600">Create and manage user accounts.</p>
              </div>
              <Button
                variant={showNewUser ? "secondary" : "primary"}
                onClick={() => setShowNewUser(!showNewUser)}
                aria-expanded={showNewUser}
              >
                {showNewUser ? "Cancel" : "+ Add User"}
              </Button>
            </div>

            {/* New user form */}
            {showNewUser && (
              <Card className="mb-6 border-blue-200 bg-blue-50/60">
                <form onSubmit={handleCreateUser} className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-900">New User</h3>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field
                      label="Email"
                      type="email"
                      value={nuEmail}
                      onChange={(e) => setNuEmail(e.target.value)}
                      required
                      autoComplete="off"
                    />
                    <Field
                      label="Name"
                      type="text"
                      value={nuName}
                      onChange={(e) => setNuName(e.target.value)}
                      required
                    />
                    <PasswordField
                      label="Password"
                      value={nuPassword}
                      onChange={(e) => setNuPassword(e.target.value)}
                      required
                      minLength={6}
                      autoComplete="new-password"
                    />
                    <div>
                      <label htmlFor="nu-role" className="mb-1.5 block text-sm font-medium text-gray-700">Role</label>
                      <select
                        id="nu-role"
                        value={nuRole}
                        onChange={(e) => setNuRole(e.target.value as typeof nuRole)}
                        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:border-blue-600 transition"
                      >
                        <option value="viewer">Viewer</option>
                        <option value="recruiter">Recruiter</option>
                        <option value="hiring_manager">Hiring Manager</option>
                        {isSuperAdmin && <option value="admin">Admin</option>}
                        {isSuperAdmin && <option value="super_admin">Super Admin</option>}
                      </select>
                    </div>
                  </div>
                  <Button type="submit">Create User</Button>
                </form>
              </Card>
            )}

            {/* Users table */}
            <Card className="overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th scope="col" className="px-4 py-3 text-left font-medium text-gray-700">User</th>
                      <th scope="col" className="px-4 py-3 text-left font-medium text-gray-700">Role</th>
                      <th scope="col" className="px-4 py-3 text-left font-medium text-gray-700">Last Login</th>
                      <th scope="col" className="px-4 py-3 text-right font-medium text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className="border-b border-gray-100 last:border-0">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-linear-to-br from-blue-500 to-purple-500 text-xs font-bold text-white" aria-hidden="true">
                              {u.name.charAt(0).toUpperCase()}
                            </span>
                            <div className="min-w-0">
                              <p className="font-medium text-gray-900">{u.name}</p>
                              <p className="text-xs text-gray-600">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {(() => {
                            /* superadmin@company.com role is always immutable — nobody can change it */
                            const isSuperAdminAccount = u.email === "superadmin@company.com";
                            /* admin@company.com can only be changed by super_admin */
                            const isRootAdmin = u.email === "admin@company.com";
                            const isRootAdminLocked = isRootAdmin && !isSuperAdmin;
                            /* Disabled only for: immutable superadmin account, locked root admin, or non-admin users */
                            const isDisabled = isSuperAdminAccount || isRootAdminLocked || !canManageRoles;
                            return (
                              <select
                                aria-label={`Role for ${u.name}`}
                                value={u.role}
                                onChange={(e) => handleRoleChange(u.id, e.target.value)}
                                disabled={isDisabled}
                                title={
                                  isSuperAdminAccount ? "Protected account — role cannot be changed" :
                                  isRootAdminLocked ? "Only Super Admin can change the root admin role" :
                                  !canManageRoles ? "Admin access required to change roles" :
                                  undefined
                                }
                                className={`rounded-lg border px-2 py-1.5 text-xs font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                                  u.role === "super_admin" ? "border-red-200 bg-red-50 text-red-700" :
                                  u.role === "admin" ? "border-purple-200 bg-purple-50 text-purple-700" :
                                  u.role === "hiring_manager" ? "border-blue-200 bg-blue-50 text-blue-700" :
                                  u.role === "recruiter" ? "border-teal-200 bg-teal-50 text-teal-700" :
                                  "border-gray-200 bg-gray-50 text-gray-700"
                                } ${isDisabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                              >
                                <option value="viewer">Viewer</option>
                                <option value="recruiter">Recruiter</option>
                                <option value="hiring_manager">Hiring Manager</option>
                                {/* Only super_admin can assign admin or super_admin roles; show if user already has that role */}
                                {(isSuperAdmin || u.role === "admin") && <option value="admin">Admin</option>}
                                {(isSuperAdmin || u.role === "super_admin") && <option value="super_admin">Super Admin</option>}
                              </select>
                            );
                          })()}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600">
                          {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "Never"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {u.id !== user.id && u.email !== "admin@company.com" && u.email !== "superadmin@company.com" && (
                            <div className="flex items-center justify-end gap-3">
                              {/* Admin/super_admin passwords can only be changed by themselves */}
                              {u.role !== "admin" && u.role !== "super_admin" && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setResetPasswordUser({ id: u.id, email: u.email, name: u.name });
                                    setResetPassword("");
                                    setResetConfirm("");
                                  }}
                                  className="rounded px-1 text-xs font-medium text-blue-700 hover:text-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                                >
                                  Reset Password
                                </button>
                              )}
                              {(u.role === "admin" || u.role === "super_admin") && (
                                <span className="text-[11px] italic text-gray-600">Self-managed password</span>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDeleteUser(u.id, u.email)}
                                className="rounded px-1 text-xs font-medium text-red-700 hover:text-red-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                          {u.id === user.id && (
                            <Badge tone="neutral">You</Badge>
                          )}
                          {u.id !== user.id && (u.email === "admin@company.com" || u.email === "superadmin@company.com") && (
                            <span className="text-[11px] italic text-gray-600">Protected account</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {users.length === 0 && (
                <div className="py-12 text-center text-sm text-gray-600">No users found</div>
              )}
            </Card>

            {/* Role legend */}
            <div className="mt-6 space-y-1.5 rounded-2xl bg-gray-50 p-4 text-xs text-gray-600">
              <p className="mb-2 text-sm font-semibold text-gray-900">Role Permissions</p>
              <p><span className="font-semibold text-red-700">Super Admin</span> — Full platform control: all admin access + AI config, system settings, credit overrides</p>
              <p><span className="font-semibold text-purple-700">Admin</span> — Full access: edit pages, manage users, reset passwords, view audit log</p>
              <p><span className="font-semibold text-blue-700">Hiring Manager</span> — Manage job postings, review applications, edit pages</p>
              <p><span className="font-semibold text-teal-700">Recruiter</span> — Post jobs, manage candidates, upload media</p>
              <p><span className="font-semibold text-gray-700">Viewer</span> — Preview pages only (read-only)</p>
            </div>

            {/* Reset Password Modal */}
            {resetPasswordUser && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
                onClick={(e) => { if (e.target === e.currentTarget) setResetPasswordUser(null); }}
                role="dialog"
                aria-modal="true"
                aria-labelledby="reset-pw-title"
              >
                <div className="w-full max-w-sm animate-fade-in rounded-2xl bg-white p-6 shadow-xl">
                  <div className="mb-5 flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-lg font-bold text-blue-700" aria-hidden="true">
                      {resetPasswordUser.name.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <h3 id="reset-pw-title" className="text-sm font-semibold text-gray-900">Reset Password</h3>
                      <p className="truncate text-xs text-gray-600">{resetPasswordUser.email}</p>
                    </div>
                  </div>

                  <form onSubmit={handleResetPassword} className="space-y-4">
                    <PasswordField
                      label="New Password"
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      placeholder="Min 6 characters"
                    />
                    <PasswordField
                      label="Confirm Password"
                      value={resetConfirm}
                      onChange={(e) => setResetConfirm(e.target.value)}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      placeholder="Re-type password"
                    />
                    <div className="flex gap-3 pt-1">
                      <Button type="button" variant="secondary" fullWidth onClick={() => setResetPasswordUser(null)}>
                        Cancel
                      </Button>
                      <Button type="submit" fullWidth>Reset Password</Button>
                    </div>
                  </form>

                  <p className="mt-4 text-center text-[11px] text-gray-600">
                    The user will need to sign in with the new password. Active sessions will remain until they expire.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Audit tab (admin only) ────────────────────────────────── */}
        {tab === "audit" && isAdmin && (
          <div>
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Audit Log</h2>
                <p className="mt-1 text-sm text-gray-600">Track who changed what and when.</p>
              </div>
              <Button variant="ghost" size="sm" onClick={loadAudit}>
                <RefreshIcon /> Refresh
              </Button>
            </div>

            <Card className="overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th scope="col" className="px-4 py-3 text-left font-medium text-gray-700">Time</th>
                      <th scope="col" className="px-4 py-3 text-left font-medium text-gray-700">User</th>
                      <th scope="col" className="px-4 py-3 text-left font-medium text-gray-700">Action</th>
                      <th scope="col" className="px-4 py-3 text-left font-medium text-gray-700">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditEntries.slice(0, 100).map((entry, i) => (
                      <tr key={i} className="border-b border-gray-100 last:border-0">
                        <td className="whitespace-nowrap px-4 py-2.5 text-xs text-gray-600">
                          {new Date(entry.timestamp).toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5 text-xs font-medium text-gray-700">
                          {entry.email}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            entry.action === "login" ? "bg-emerald-50 text-emerald-700" :
                            entry.action === "logout" ? "bg-gray-100 text-gray-700" :
                            entry.action.startsWith("page") ? "bg-blue-50 text-blue-700" :
                            entry.action.startsWith("user") ? "bg-purple-50 text-purple-700" :
                            entry.action.startsWith("media") ? "bg-amber-50 text-amber-700" :
                            "bg-gray-100 text-gray-700"
                          }`}>
                            {entry.action}
                          </span>
                        </td>
                        <td className="max-w-50 truncate px-4 py-2.5 text-xs text-gray-600">
                          {entry.details || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {auditEntries.length === 0 && (
                <div className="py-12 text-center text-sm text-gray-600">No activity logged yet</div>
              )}
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
