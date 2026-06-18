"use client";

/**
 * BillingPortalButton — Opens Stripe Customer Portal for self-service billing.
 *
 * Features:
 *  - Manage subscription (upgrade/downgrade)
 *  - Cancel subscription
 *  - Update payment method
 *  - View/download invoices
 *
 * Only shown when user has a linked Stripe customer (has subscribed before).
 * Handles loading, error, and disabled states.
 */

import { useState, useCallback } from "react";
import { csrfHeaders } from "@/lib/csrf";

interface BillingPortalButtonProps {
  /** Compact mode — smaller text for inline use */
  compact?: boolean;
  /** Custom className override */
  className?: string;
}

export default function BillingPortalButton({ compact = false, className }: BillingPortalButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openPortal = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: csrfHeaders(),
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to open billing portal");
      }

      const { url } = await res.json();
      if (url && url.startsWith("https://billing.stripe.com")) {
        window.location.href = url;
      } else {
        throw new Error("Invalid portal URL returned");
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong");
      setLoading(false);
    }
  }, []);

  if (compact) {
    return (
      <div>
        <button
          onClick={openPortal}
          disabled={loading}
          aria-busy={loading || undefined}
          className={className || `inline-flex items-center gap-1 rounded text-[10px] font-semibold text-purple-700 hover:text-purple-800 hover:underline transition-colors disabled:opacity-50 disabled:cursor-wait focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-600`}
        >
          {loading ? "Opening…" : (
            <>
              Manage Billing
              <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </>
          )}
        </button>
        {error && (
          <p className="text-[9px] text-red-600 mt-0.5" role="alert">{error}</p>
        )}
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={openPortal}
        disabled={loading}
        aria-busy={loading || undefined}
        className={className || `cb-btn inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold
          bg-white border border-gray-300 text-gray-700
          hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700
          transition-all duration-200 disabled:opacity-50 disabled:cursor-wait
          shadow-sm hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-purple-600`}
      >
        {loading ? (
          <>
            <span className="w-4 h-4 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin" aria-hidden="true" />
            <span>Opening portal…</span>
          </>
        ) : (
          <>
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" />
            </svg>
            <span>Manage Billing</span>
          </>
        )}
      </button>
      {error && (
        <p className="text-xs text-red-600 mt-1.5" role="alert">{error}</p>
      )}
    </div>
  );
}
