"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

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
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🔐</div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Career Site Admin
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Sign in to access the editor
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@company.com"
              autoFocus
              autoComplete="email"
              className="w-full bg-gray-800 border border-gray-700 text-white px-4 py-3 rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                         placeholder:text-gray-500 transition-colors"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-gray-400">Password</label>
              <button
                type="button"
                onClick={() => setShowForgot(!showForgot)}
                className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
              >
                Forgot password?
              </button>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              className="w-full bg-gray-800 border border-gray-700 text-white px-4 py-3 rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                         placeholder:text-gray-500 transition-colors"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500
                       text-white font-semibold py-3 rounded-lg transition-colors text-sm"
          >
            {loading ? "Signing in…" : "Sign In →"}
          </button>
        </form>

        {/* Forgot password info panel */}
        {showForgot && (
          <div className="mt-4 bg-gray-800 border border-gray-700 rounded-xl p-4 animate-fade-in">
            <div className="flex items-start gap-3">
              <span className="text-lg mt-0.5">🔑</span>
              <div>
                <h3 className="text-sm font-semibold text-white mb-1">Can&apos;t access your account?</h3>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Ask your <span className="text-blue-400 font-medium">admin</span> to reset your password from{" "}
                  <span className="text-white font-medium">Settings → Users → Reset Password</span>.
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  If you are the admin, you can reset your password via the database CLI or by re-running the seed script.
                </p>
              </div>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-gray-600 mt-6">
          Secured access · Session expires after 7 days of inactivity
        </p>
      </div>
    </div>
  );
}
