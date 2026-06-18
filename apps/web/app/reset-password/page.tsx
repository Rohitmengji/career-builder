"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthShell, ErrorBanner, SuccessBanner, SubmitButton } from "@/lib/authUi";

function ResetForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done">("idle");
  const [error, setError] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords do not match.");
    setStatus("submitting");
    setError("");
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) setStatus("done");
      else {
        setStatus("idle");
        setError(data.error || "Could not reset password. The link may have expired.");
      }
    } catch {
      setStatus("idle");
      setError("Network error. Please try again.");
    }
  };

  if (!token) {
    return (
      <AuthShell title="Invalid link">
        <ErrorBanner>This password reset link is missing or invalid.</ErrorBanner>
        <Link href="/forgot-password" className="mt-6 block text-center text-sm text-blue-600 hover:text-blue-700 font-medium">
          Request a new link
        </Link>
      </AuthShell>
    );
  }

  if (status === "done") {
    return (
      <AuthShell title="Password updated">
        <SuccessBanner>Your password has been reset and you&apos;re signed in.</SuccessBanner>
        <button
          onClick={() => { router.push("/profile"); router.refresh(); }}
          className="mt-6 w-full inline-flex items-center justify-center px-6 py-3 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition"
        >
          Go to your profile
        </button>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password">
      <form onSubmit={onSubmit} className="space-y-4">
        {error && <ErrorBanner>{error}</ErrorBanner>}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">New password *</label>
          <input
            type="password" required minLength={8} autoComplete="new-password" value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition"
            placeholder="At least 8 characters"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm password *</label>
          <input
            type="password" required minLength={8} autoComplete="new-password" value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition"
            placeholder="Re-enter password"
          />
        </div>
        <SubmitButton submitting={status === "submitting"}>Reset Password</SubmitButton>
      </form>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetForm />
    </Suspense>
  );
}
