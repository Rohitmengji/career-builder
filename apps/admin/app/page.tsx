import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionReadOnly } from "@/lib/auth";
import { listTenants } from "@/lib/tenantStore";

export default async function AdminHome() {
  const session = await getSessionReadOnly();

  if (!session) {
    redirect("/login");
  }

  const tenantIds = await listTenants();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-3xl">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">🏗️ Career Builder</h1>
          <p className="text-gray-500">Admin Dashboard — Welcome back, {session.name}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Dashboard */}
          <Link
            href="/dashboard"
            className="group block rounded-2xl border border-gray-200 bg-white p-8 shadow-sm hover:shadow-md hover:border-blue-200 transition-all"
          >
            <div className="text-3xl mb-3">📊</div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">Dashboard</h2>
            <p className="text-sm text-gray-500">Overview of jobs, applications, and hiring metrics.</p>
          </Link>

          {/* Job Management */}
          <Link
            href="/jobs"
            className="group block rounded-2xl border border-gray-200 bg-white p-8 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all"
          >
            <div className="text-3xl mb-3">💼</div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1 group-hover:text-indigo-600 transition-colors">Job Management</h2>
            <p className="text-sm text-gray-500">Create, edit, publish, and manage job postings.</p>
          </Link>

          {/* Applications */}
          <Link
            href="/applications"
            className="group block rounded-2xl border border-gray-200 bg-white p-8 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all"
          >
            <div className="text-3xl mb-3">📋</div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1 group-hover:text-emerald-600 transition-colors">Applications</h2>
            <p className="text-sm text-gray-500">Review candidates, track pipeline, and manage hiring.</p>
          </Link>

          {/* Page Editor */}
          <Link
            href="/editor"
            className="group block rounded-2xl border border-gray-200 bg-white p-8 shadow-sm hover:shadow-md hover:border-blue-200 transition-all"
          >
            <div className="text-3xl mb-3">🎨</div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">Page Editor</h2>
            <p className="text-sm text-gray-500">Drag-and-drop blocks to build your career site pages.</p>
          </Link>

          {/* Theme Editor */}
          <Link
            href="/theme"
            className="group block rounded-2xl border border-gray-200 bg-white p-8 shadow-sm hover:shadow-md hover:border-purple-200 transition-all"
          >
            <div className="text-3xl mb-3">🎭</div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1 group-hover:text-purple-600 transition-colors">Theme Editor</h2>
            <p className="text-sm text-gray-500">Configure branding, colors, fonts, and layout per tenant.</p>
          </Link>

          {/* Settings */}
          {session.role === "admin" && (
            <Link
              href="/settings"
              className="group block rounded-2xl border border-gray-200 bg-white p-8 shadow-sm hover:shadow-md hover:border-gray-300 transition-all"
            >
              <div className="text-3xl mb-3">⚙️</div>
              <h2 className="text-lg font-semibold text-gray-900 mb-1 group-hover:text-gray-700 transition-colors">Settings</h2>
              <p className="text-sm text-gray-500">Manage users, roles, and view audit logs.</p>
            </Link>
          )}
        </div>

        {/* Tenants */}
        {tenantIds.length > 0 && (
          <div className="mt-10">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Tenants</h3>
            <div className="flex flex-wrap gap-2">
              {tenantIds.map((tid) => (
                <Link
                  key={tid}
                  href={`/theme?tenant=${tid}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-100 hover:border-gray-300 transition-all"
                >
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  {tid}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}