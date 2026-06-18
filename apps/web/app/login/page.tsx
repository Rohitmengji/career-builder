"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthShell, Field, ErrorBanner, SubmitButton } from "@/lib/authUi";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/profile";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting">("idle");
  const [error, setError] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("submitting");
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        router.push(returnTo.startsWith("/") ? returnTo : "/profile");
        router.refresh();
      } else {
        setStatus("idle");
        setError(data.error || "Login failed. Please try again.");
      }
    } catch {
      setStatus("idle");
      setError("Network error. Please try again.");
    }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your candidate account.">
      <form onSubmit={onSubmit} className="space-y-4">
        {error && <ErrorBanner>{error}</ErrorBanner>}
        <Field label="Email" type="email" value={email} onChange={setEmail} required autoComplete="email" placeholder="you@example.com" />
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <Link href="/forgot-password" className="text-xs text-blue-600 hover:text-blue-700 font-medium">Forgot password?</Link>
          </div>
          <input
            type="password" required autoComplete="current-password" value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition"
            placeholder="••••••••"
          />
        </div>
        <SubmitButton submitting={status === "submitting"}>Sign In</SubmitButton>
      </form>
      <p className="mt-6 text-center text-sm text-gray-500">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="text-blue-600 hover:text-blue-700 font-medium">Create one</Link>
      </p>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
