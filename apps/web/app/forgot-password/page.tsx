/*
 * Forgot-password request page (client component).
 *
 * WHAT: A single-email form that asks the server to send a password-reset link,
 * then swaps to a "check your email" confirmation state.
 *
 * WHY: Lets candidates recover access to their account on the public career site.
 *
 * HOW: Posts the email to /api/auth/forgot-password. SECURITY/UX gotcha: the
 * confirmation copy is intentionally non-committal ("If an account exists for X…")
 * to avoid account-enumeration — we show success on any res.ok regardless of
 * whether that email maps to a real candidate. The actual email send and existence
 * check happen server-side.
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthShell, Field, ErrorBanner, SubmitButton } from "@/lib/authUi";
import { ButtonLink, CheckIcon, EmptyState } from "@/components/ui";

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

  if (status === "sent") {
    return (
      <AuthShell title="Check your email" subtitle="We'll email you a link to set a new password.">
        <div role="status" aria-live="polite">
          <EmptyState
            icon={<CheckIcon className="h-6 w-6" />}
            title="Reset link sent"
            body={
              <>
                If an account exists for <strong className="font-medium text-gray-900">{email}</strong>, a reset link is on
                its way. Check your inbox (and spam folder).
              </>
            }
            action={
              <ButtonLink href="/login" variant="secondary" size="lg">
                Back to sign in
              </ButtonLink>
            }
          />
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Reset your password" subtitle="We'll email you a link to set a new password.">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && <ErrorBanner>{error}</ErrorBanner>}
        <Field label="Email" type="email" value={email} onChange={setEmail} required autoComplete="email" placeholder="you@example.com" />
        <SubmitButton submitting={status === "submitting"}>Send Reset Link</SubmitButton>
      </form>
      <p className="mt-6 text-center text-sm text-gray-600">
        Remembered it?{" "}
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
