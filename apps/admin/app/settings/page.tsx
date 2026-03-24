"use client";

import { useEffect, useState, useCallback, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuthGuard } from "@/lib/useAuthGuard";

interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: "admin" | "editor" | "viewer";
}

interface UserRecord {
  id: string;
  email: string;
  name: string;
  role: "admin" | "editor" | "viewer";
  createdAt: string;
  lastLogin?: string;
}

interface AuditEntry {
  timestamp: string;
  userId: string;
  email: string;
  action: string;
  details?: string;
}

function getCsrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)cb_csrf=([^;]*)/);
  return match ? match[1] : "";
}

export default function SettingsPage() {
  const router = useRouter();
  const { user: authUser, loading: authLoading } = useAuthGuard();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [tab, setTab] = useState<"profile" | "users" | "audit">("profile");
  const [toast, setToast] = useState("");

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
  const [nuRole, setNuRole] = useState<"admin" | "editor" | "viewer">("editor");

  // Audit
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);

  // Reset password modal
  const [resetPasswordUser, setResetPasswordUser] = useState<{ id: string; email: string; name: string } | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirm, setResetConfirm] = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  /* ── Auth check ───────────────────────────────────────────────── */
  useEffect(() => {
    if (authLoading || !authUser) return;
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
    } catch { /* */ }
  }, []);

  /* ── Load audit (admin only) ──────────────────────────────────── */
  const loadAudit = useCallback(async () => {
    try {
      const res = await fetch("/api/audit");
      if (res.ok) {
        const data = await res.json();
        setAuditEntries(data.entries);
      }
    } catch { /* */ }
  }, []);

  useEffect(() => {
    if (user?.role === "admin") {
      if (tab === "users") loadUsers();
      if (tab === "audit") loadAudit();
    }
  }, [tab, user, loadUsers, loadAudit]);

  /* ── Update profile ───────────────────────────────────────────── */
  const handleUpdateProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (newPassword && newPassword !== confirmPassword) {
      showToast("❌ Passwords don't match");
      return;
    }
    if (newPassword && newPassword.length < 6) {
      showToast("❌ Password must be at least 6 characters");
      return;
    }

    const updates: any = { id: user.id };
    if (newName && newName !== user.name) updates.name = newName;
    if (newPassword) updates.password = newPassword;

    if (!updates.name && !updates.password) {
      showToast("ℹ️ No changes to save");
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
      showToast("✅ Profile updated");
    } else {
      const data = await res.json().catch(() => ({}));
      showToast(`❌ ${data.error || "Update failed"}`);
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
      setNuRole("editor");
      loadUsers();
      showToast("✅ User created");
    } else {
      const data = await res.json().catch(() => ({}));
      showToast(`❌ ${data.error || "Failed to create user"}`);
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
      showToast("✅ User deleted");
    } else {
      const data = await res.json().catch(() => ({}));
      showToast(`❌ ${data.error || "Failed to delete user"}`);
    }
  };

  /* ── Change role ──────────────────────────────────────────────── */
  const handleRoleChange = async (id: string, newRole: string) => {
    const res = await fetch("/api/users", {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-csrf-token": getCsrfToken() },
      body: JSON.stringify({ id, role: newRole }),
    });

    if (res.ok) {
      loadUsers();
      showToast("✅ Role updated");
    } else {
      const data = await res.json().catch(() => ({}));
      showToast(`❌ ${data.error || "Failed to update role"}`);
    }
  };

  /* ── Admin reset password for another user ────────────────────── */
  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!resetPasswordUser) return;

    if (resetPassword.length < 6) {
      showToast("❌ Password must be at least 6 characters");
      return;
    }
    if (resetPassword !== resetConfirm) {
      showToast("❌ Passwords don't match");
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
      showToast(`✅ Password reset for ${resetPasswordUser.email}`);
    } else {
      const data = await res.json().catch(() => ({}));
      showToast(`❌ ${data.error || "Failed to reset password"}`);
    }
  };

  if (!user) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-400">Loading…</p>
      </div>
    );
  }

  const isAdmin = user.role === "admin";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/editor" className="text-gray-400 hover:text-gray-600 text-sm">← Editor</a>
            <h1 className="text-lg font-bold text-gray-900">⚙ Settings</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm text-gray-600">{user.name}</span>
          </div>
        </div>
      </header>

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white px-5 py-2.5 rounded-lg shadow-lg text-sm font-medium animate-fade-in">
          {toast}
        </div>
      )}

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="flex gap-1 mb-8 border-b border-gray-200">
          <button
            onClick={() => setTab("profile")}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === "profile" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            👤 Profile
          </button>
          {isAdmin && (
            <>
              <button
                onClick={() => setTab("users")}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === "users" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
              >
                👥 Users
              </button>
              <button
                onClick={() => setTab("audit")}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === "audit" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
              >
                📋 Audit Log
              </button>
            </>
          )}
        </div>

        {/* ── Profile tab ───────────────────────────────────────────── */}
        {tab === "profile" && (
          <div className="max-w-md">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Your Profile</h2>
            <p className="text-sm text-gray-500 mb-6">Update your name or change your password.</p>

            <form onSubmit={handleUpdateProfile} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={user.email}
                  disabled
                  className="w-full bg-gray-100 border border-gray-200 text-gray-500 px-3 py-2.5 rounded-lg text-sm"
                />
                <p className="text-xs text-gray-400 mt-1">Email cannot be changed</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-white border border-gray-300 text-gray-900 px-3 py-2.5 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <div className={`inline-block px-3 py-1.5 rounded-full text-xs font-semibold ${
                  user.role === "admin" ? "bg-purple-100 text-purple-700" :
                  user.role === "editor" ? "bg-blue-100 text-blue-700" :
                  "bg-gray-100 text-gray-600"
                }`}>
                  {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                </div>
              </div>

              <hr className="border-gray-200" />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Leave blank to keep current"
                  autoComplete="new-password"
                  className="w-full bg-white border border-gray-300 text-gray-900 px-3 py-2.5 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-type new password"
                  autoComplete="new-password"
                  className="w-full bg-white border border-gray-300 text-gray-900 px-3 py-2.5 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                />
              </div>

              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 px-6 rounded-lg text-sm transition-colors"
              >
                Save Changes
              </button>
            </form>
          </div>
        )}

        {/* ── Users tab (admin only) ────────────────────────────────── */}
        {tab === "users" && isAdmin && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">User Management</h2>
                <p className="text-sm text-gray-500">Create and manage user accounts.</p>
              </div>
              <button
                onClick={() => setShowNewUser(!showNewUser)}
                className="bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors"
              >
                {showNewUser ? "Cancel" : "+ Add User"}
              </button>
            </div>

            {/* New user form */}
            {showNewUser && (
              <form onSubmit={handleCreateUser} className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6 space-y-4">
                <h3 className="text-sm font-semibold text-blue-900">New User</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                    <input
                      type="email"
                      value={nuEmail}
                      onChange={(e) => setNuEmail(e.target.value)}
                      required
                      className="w-full bg-white border border-gray-300 text-gray-900 px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
                    <input
                      type="text"
                      value={nuName}
                      onChange={(e) => setNuName(e.target.value)}
                      required
                      className="w-full bg-white border border-gray-300 text-gray-900 px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Password</label>
                    <input
                      type="password"
                      value={nuPassword}
                      onChange={(e) => setNuPassword(e.target.value)}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      className="w-full bg-white border border-gray-300 text-gray-900 px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
                    <select
                      value={nuRole}
                      onChange={(e) => setNuRole(e.target.value as any)}
                      className="w-full bg-white border border-gray-300 text-gray-900 px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="admin">Admin</option>
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </div>
                </div>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 px-5 rounded-lg text-sm"
                >
                  Create User
                </button>
              </form>
            )}

            {/* Users table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 font-medium text-gray-600">User</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Last Login</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-gray-100 last:border-0">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-linear-to-br from-blue-500 to-purple-500 text-white text-xs font-bold flex items-center justify-center">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{u.name}</p>
                            <p className="text-xs text-gray-400">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                          disabled={u.id === user.id}
                          className={`text-xs font-semibold px-2 py-1 rounded-lg border ${
                            u.role === "admin" ? "bg-purple-50 text-purple-700 border-purple-200" :
                            u.role === "editor" ? "bg-blue-50 text-blue-700 border-blue-200" :
                            "bg-gray-50 text-gray-600 border-gray-200"
                          } ${u.id === user.id ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                        >
                          <option value="admin">Admin</option>
                          <option value="editor">Editor</option>
                          <option value="viewer">Viewer</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {u.lastLogin ? new Date(u.lastLogin).toLocaleString() : "Never"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {u.id !== user.id && (
                          <div className="flex items-center justify-end gap-3">
                            <button
                              onClick={() => {
                                setResetPasswordUser({ id: u.id, email: u.email, name: u.name });
                                setResetPassword("");
                                setResetConfirm("");
                              }}
                              className="text-xs text-blue-500 hover:text-blue-700 font-medium"
                            >
                              Reset Password
                            </button>
                            <button
                              onClick={() => handleDeleteUser(u.id, u.email)}
                              className="text-xs text-red-500 hover:text-red-700 font-medium"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                        {u.id === user.id && (
                          <span className="text-xs text-gray-300">You</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {users.length === 0 && (
                <div className="py-12 text-center text-gray-400 text-sm">No users found</div>
              )}
            </div>

            {/* Role legend */}
            <div className="mt-6 bg-gray-50 rounded-xl p-4 text-xs text-gray-500 space-y-1.5">
              <p className="font-semibold text-gray-700 mb-2">Role Permissions</p>
              <p><span className="font-semibold text-purple-600">Admin</span> — Full access: edit pages, manage users, reset passwords, view audit log</p>
              <p><span className="font-semibold text-blue-600">Editor</span> — Edit pages, upload media, change own password</p>
              <p><span className="font-semibold text-gray-600">Viewer</span> — Preview pages only (read-only)</p>
            </div>

            {/* Reset Password Modal */}
            {resetPasswordUser && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
                onClick={(e) => { if (e.target === e.currentTarget) setResetPasswordUser(null); }}
              >
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-fade-in">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-lg font-bold">
                      {resetPasswordUser.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">Reset Password</h3>
                      <p className="text-xs text-gray-500">{resetPasswordUser.email}</p>
                    </div>
                  </div>

                  <form onSubmit={handleResetPassword} className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">New Password</label>
                      <input
                        type="password"
                        value={resetPassword}
                        onChange={(e) => setResetPassword(e.target.value)}
                        required
                        minLength={6}
                        autoComplete="new-password"
                        placeholder="Min 6 characters"
                        className="w-full bg-white border border-gray-300 text-gray-900 px-3 py-2.5 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Confirm Password</label>
                      <input
                        type="password"
                        value={resetConfirm}
                        onChange={(e) => setResetConfirm(e.target.value)}
                        required
                        minLength={6}
                        autoComplete="new-password"
                        placeholder="Re-type password"
                        className="w-full bg-white border border-gray-300 text-gray-900 px-3 py-2.5 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                      />
                    </div>
                    <div className="flex gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => setResetPasswordUser(null)}
                        className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2.5 rounded-lg text-sm transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
                      >
                        Reset Password
                      </button>
                    </div>
                  </form>

                  <p className="text-[10px] text-gray-400 mt-4 text-center">
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
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">Audit Log</h2>
                <p className="text-sm text-gray-500">Track who changed what and when.</p>
              </div>
              <button
                onClick={loadAudit}
                className="text-sm text-blue-600 hover:text-blue-500 font-medium"
              >
                ↻ Refresh
              </button>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Time</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">User</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Action</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {auditEntries.slice(0, 100).map((entry, i) => (
                    <tr key={i} className="border-b border-gray-100 last:border-0">
                      <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                        {new Date(entry.timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-xs font-medium text-gray-700">
                        {entry.email}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          entry.action === "login" ? "bg-green-100 text-green-700" :
                          entry.action === "logout" ? "bg-gray-100 text-gray-600" :
                          entry.action.startsWith("page") ? "bg-blue-100 text-blue-700" :
                          entry.action.startsWith("user") ? "bg-purple-100 text-purple-700" :
                          entry.action.startsWith("media") ? "bg-amber-100 text-amber-700" :
                          "bg-gray-100 text-gray-600"
                        }`}>
                          {entry.action}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-500 max-w-50 truncate">
                        {entry.details || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {auditEntries.length === 0 && (
                <div className="py-12 text-center text-gray-400 text-sm">No activity logged yet</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
