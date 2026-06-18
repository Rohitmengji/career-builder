"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthShell, Field, ErrorBanner, SuccessBanner, SubmitButton } from "@/lib/authUi";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "sent">("idle");
  const [error, setError] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("submitting");
    setError("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setStatus("sent");
      else {
        setStatus("idle");
        setError(data.error || "Something went wrong. Please try again.");
      }
    } catch {
      setStatus("idle");
      setError("Network error. Please try again.");
    }
  };

  return (
    <AuthShell title="Reset your password" subtitle="We'll email you a link to set a new password.">
      {status === "sent" ? (
        <div className="space-y-6">
          <SuccessBanner>
            If an account exists for <strong>{email}</strong>, a reset link is on its way. Check your inbox (and spam).
          </SuccessBanner>
          <Link href="/login" className="block text-center text-sm text-blue-600 hover:text-blue-700 font-medium">
            Back to sign in
          </Link>
        </div>
      ) : (
        <>
          <form onSubmit={onSubmit} className="space-y-4">
            {error && <ErrorBanner>{error}</ErrorBanner>}
            <Field label="Email" type="email" value={email} onChange={setEmail} required autoComplete="email" placeholder="you@example.com" />
            <SubmitButton submitting={status === "submitting"}>Send Reset Link</SubmitButton>
          </form>
          <p className="mt-6 text-center text-sm text-gray-500">
            Remembered it? <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium">Sign in</Link>
          </p>
        </>
      )}
    </AuthShell>
  );
}
