"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthShell, ErrorBanner, SubmitButton } from "@/lib/authUi";
import { Button, ButtonLink, PasswordField, Skeleton, CheckIcon, EmptyState } from "@/components/ui";

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
        <EmptyState
          title="This link is invalid"
          body="This password reset link is missing or invalid. Request a new one to continue."
          action={
            <ButtonLink href="/forgot-password" variant="secondary" size="lg">
              Request a new link
            </ButtonLink>
          }
        />
      </AuthShell>
    );
  }

  if (status === "done") {
    return (
      <AuthShell title="Password updated">
        <div role="status" aria-live="polite">
          <EmptyState
            icon={<CheckIcon className="h-6 w-6" />}
            title="You're all set"
            body="Your password has been reset and you're signed in."
            action={
              <Button size="lg" onClick={() => { router.push("/profile"); router.refresh(); }}>
                Go to your profile
              </Button>
            }
          />
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password" subtitle="Pick a strong password you don't use elsewhere.">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && <ErrorBanner>{error}</ErrorBanner>}
        <PasswordField
          label="New password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <PasswordField
          label="Confirm password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="Re-enter password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        <SubmitButton submitting={status === "submitting"}>Reset Password</SubmitButton>
      </form>
    </AuthShell>
  );
}

function ResetFallback() {
  return (
    <AuthShell title="Choose a new password" subtitle="Pick a strong password you don't use elsewhere.">
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetFallback />}>
      <ResetForm />
    </Suspense>
  );
}
