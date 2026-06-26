/*
 * Login page — the admin console sign-in.
 *
 * WHAT: Email + password form (with a "forgot password" hint panel) for the
 * recruiter app. On success, redirects to /editor.
 *
 * WHY: The unauthenticated entry point; getSessionReadOnly() on protected pages
 * redirects here when there is no session.
 *
 * HOW: Client component. Submits to POST /api/auth, which sets the session
 * cookie server-side; on res.ok we just router.push("/editor"). There is no
 * self-serve password reset — users ask an admin (Settings → Users → Reset
 * Password), which is why the forgot-password panel only shows guidance. Field
 * `required`/noValidate let the browser submit so the server can return its own
 * generic "Invalid credentials" message (we avoid leaking which field was wrong).
 */
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Field,
  PasswordField,
  Alert,
  Card,
  ArrowRightIcon,
  CheckIcon,
} from "@/components/ui";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        router.push("/editor");
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Invalid credentials. Try again.");
      }
    } catch {
      setError("Connection error. Please try again.");
    }

    setLoading(false);
  };

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* Brand / hero side (desktop only) */}
      <aside className="relative hidden overflow-hidden bg-gray-950 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(60% 50% at 20% 10%, rgba(37,99,235,0.35) 0%, transparent 60%), radial-gradient(50% 50% at 90% 90%, rgba(37,99,235,0.20) 0%, transparent 60%)",
          }}
        />
        <div className="relative flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6" />
            </svg>
          </span>
          <span className="text-base font-semibold tracking-tight text-white">Career Builder</span>
        </div>

        <div className="relative max-w-md">
          <p className="text-2xl font-semibold leading-snug tracking-tight text-white text-balance">
            Build, brand, and ship beautiful career sites — all from one workspace.
          </p>
          <ul className="mt-8 space-y-3">
            {[
              "Drag-and-drop page editor",
              "Per-tenant theming and branding",
              "Applicant tracking built in",
            ].map((item) => (
              <li key={item} className="flex items-center gap-3 text-sm text-gray-300">
                <span aria-hidden="true" className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600/90 text-white">
                  <CheckIcon className="h-3.5 w-3.5" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-gray-400">
          © {new Date().getFullYear()} Career Builder. Admin console.
        </p>
      </aside>

      {/* Auth side */}
      <div className="flex items-center justify-center bg-gray-50 px-4 py-12 sm:px-6">
        <div className="w-full max-w-md">
          {/* Mobile brand mark */}
          <div className="mb-8 flex items-center justify-center gap-2.5 lg:hidden">
            <span
              aria-hidden="true"
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6" />
              </svg>
            </span>
            <span className="text-base font-semibold tracking-tight text-gray-900">Career Builder</span>
          </div>

          <div className="mb-8 text-center sm:text-left">
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
              Sign in to the admin console
            </h1>
            <p className="mt-1.5 text-sm text-gray-600">
              Access the editor, jobs, and tenant settings.
            </p>
          </div>

          <Card className="shadow-md ring-1 ring-black/5">
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              {error && <Alert tone="error">{error}</Alert>}

              <Field
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@company.com"
                autoFocus
                autoComplete="email"
                required
              />

              <PasswordField
                label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                required
                labelRight={
                  <button
                    type="button"
                    onClick={() => setShowForgot((s) => !s)}
                    aria-expanded={showForgot}
                    className="rounded text-xs font-medium text-blue-600 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                  >
                    Forgot password?
                  </button>
                }
              />

              <Button
                type="submit"
                fullWidth
                size="lg"
                loading={loading}
                disabled={loading || !email || !password}
              >
                {loading ? "Signing in…" : "Sign in"}
                {!loading && <ArrowRightIcon className="h-4 w-4" />}
              </Button>
            </form>

            {showForgot && (
              <div className="mt-5 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <h2 className="text-sm font-semibold text-gray-900">
                  Can&apos;t access your account?
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-gray-600">
                  Ask your <span className="font-medium text-gray-900">admin</span> to reset your
                  password from <span className="font-medium text-gray-900">Settings → Users → Reset Password</span>.
                </p>
                <p className="mt-2 text-xs leading-relaxed text-gray-500">
                  If you are the admin, reset your password via the database CLI or by re-running the
                  seed script.
                </p>
              </div>
            )}
          </Card>

          <p className="mt-6 text-center text-xs text-gray-500">
            Secured access · Session expires after 7 days of inactivity
          </p>
        </div>
      </div>
    </main>
  );
}
