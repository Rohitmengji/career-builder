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
