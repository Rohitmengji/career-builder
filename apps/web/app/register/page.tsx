/*
 * Candidate self-registration page (client component).
 *
 * WHAT: A controlled sign-up form (name/email/phone/password) for job seekers on
 * the public career site. On success it routes to /profile.
 *
 * WHY: Lets candidates create an account so applications pre-fill and they can
 * track status. Candidate identity in this system is keyed by lowercased email +
 * tenantId (no candidateId FK — ADR-0001); the email captured here is that anchor,
 * so the server normalizes/owns it (this form just collects it).
 *
 * HOW: Posts JSON to /api/auth/register, which does the real validation, hashing,
 * tenant scoping, and session creation. Client-side we only do a cheap UX guard
 * (password >= 8 chars) — never the source of truth. router.refresh() after push
 * re-runs server components so the new session is picked up.
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthShell, Field, ErrorBanner, SubmitButton } from "@/lib/authUi";
import { PasswordField } from "@/components/ui";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", password: "" });
  const [status, setStatus] = useState<"idle" | "submitting">("idle");
  const [error, setError] = useState("");

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Client-side UX guard only; the server re-validates and is the source of truth.
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setStatus("submitting");
    setError("");
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        router.push("/profile");
        router.refresh();
      } else {
        setStatus("idle");
        setError(data.error || "Could not create account. Please try again.");
      }
    } catch {
      setStatus("idle");
      setError("Network error. Please try again.");
    }
  };

  return (
    <AuthShell title="Create your account" subtitle="Apply faster and track your applications.">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && <ErrorBanner>{error}</ErrorBanner>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="First name" value={form.firstName} onChange={set("firstName")} required autoComplete="given-name" placeholder="Jane" />
          <Field label="Last name" value={form.lastName} onChange={set("lastName")} required autoComplete="family-name" placeholder="Doe" />
        </div>
        <Field label="Email" type="email" value={form.email} onChange={set("email")} required autoComplete="email" placeholder="you@example.com" />
        <Field label="Phone" type="tel" value={form.phone} onChange={set("phone")} autoComplete="tel" placeholder="+1 (555) 000-0000" />
        <PasswordField
          label="Password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={form.password}
          onChange={(e) => set("password")(e.target.value)}
        />
        <SubmitButton submitting={status === "submitting"}>Create Account</SubmitButton>
      </form>
      <p className="mt-6 text-center text-sm text-gray-600">
        Already have an account?{" "}
        <Link
          href="/login"
          className="rounded font-medium text-blue-600 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
