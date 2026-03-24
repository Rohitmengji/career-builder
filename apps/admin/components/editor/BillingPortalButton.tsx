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
          className={className || `text-[10px] font-semibold text-purple-600 hover:text-purple-700 hover:underline transition-colors disabled:opacity-50 disabled:cursor-wait`}
        >
          {loading ? "Opening…" : "Manage Billing →"}
        </button>
        {error && (
          <p className="text-[9px] text-red-500 mt-0.5">{error}</p>
        )}
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={openPortal}
        disabled={loading}
        className={className || `flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold
          bg-white border-2 border-gray-200 text-gray-700
          hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700
          transition-all duration-200 disabled:opacity-50 disabled:cursor-wait
          shadow-sm hover:shadow-md`}
      >
        {loading ? (
          <>
            <span className="w-4 h-4 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin" />
            <span>Opening portal…</span>
          </>
        ) : (
          <>
            <span className="text-base">💳</span>
            <span>Manage Billing</span>
          </>
        )}
      </button>
      {error && (
        <p className="text-xs text-red-500 mt-1.5">{error}</p>
      )}
    </div>
  );
}
