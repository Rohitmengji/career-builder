"use client";

/* Shared UI for the candidate auth pages (login / register / reset / forgot). */

import Link from "next/link";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="text-lg font-semibold text-gray-900">Careers</Link>
          <h1 className="text-2xl font-semibold text-gray-900 mt-6">{title}</h1>
          {subtitle && <p className="text-sm text-gray-500 mt-2">{subtitle}</p>}
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8">{children}</div>
      </div>
    </main>
  );
}

export function Field({
  label, type = "text", value, onChange, required, autoComplete, placeholder,
}: {
  label: string; type?: string; value: string; onChange: (v: string) => void;
  required?: boolean; autoComplete?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}{required && " *"}</label>
      <input
        type={type} required={required} autoComplete={autoComplete} value={value}
        onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition placeholder:text-gray-400"
      />
    </div>
  );
}

export function ErrorBanner({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg bg-red-50 border border-red-100 text-red-700 text-sm px-4 py-3">{children}</div>;
}

export function SuccessBanner({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg bg-green-50 border border-green-100 text-green-700 text-sm px-4 py-3">{children}</div>;
}

export function SubmitButton({ submitting, children }: { submitting: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit" disabled={submitting}
      className="w-full inline-flex items-center justify-center px-6 py-3 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {submitting ? "Please wait…" : children}
    </button>
  );
}
