"use client";

/**
 * useSubscription — Client hook for subscription status.
 *
 * Fetches server-side truth from /api/subscription.
 * Falls back to free plan if unauthenticated or API fails.
 * All instances share state via a custom event bus so credits
 * stay in sync across AiAssistant, DevPlanSwitcher, etc.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { SubscriptionPlan, SubscriptionStatus } from "./types";

const DEFAULT_STATUS: SubscriptionStatus = {
  plan: "free" as SubscriptionPlan,
  aiEnabled: false,
  aiCreditsRemaining: 0,
  aiCreditsTotal: 0,
  subscriptionStatus: "none",
  hasStripeCustomer: false,
  billingCycleStart: null,
  aiCreditsResetAt: null,
  jobAiCreditsRemaining: 0,
  jobAiCreditsTotal: 0,
  jobAiCreditsResetAt: null,
};

/** Shared event name for cross-instance sync */
const SYNC_EVENT = "cb:subscription:sync";

/** Global cached status so all hook instances share the same data */
let _cachedStatus: SubscriptionStatus | null = null;
let _fetchPromise: Promise<SubscriptionStatus> | null = null;

async function fetchFromServer(): Promise<SubscriptionStatus> {
  try {
    const res = await fetch("/api/subscription", { credentials: "include" });
    if (!res.ok) return DEFAULT_STATUS;
    const data = await res.json();
    const status: SubscriptionStatus = {
      plan: data.plan as SubscriptionPlan,
      aiEnabled: data.aiEnabled,
      aiCreditsRemaining: data.aiCreditsRemaining,
      aiCreditsTotal: data.aiCreditsTotal,
      subscriptionStatus: data.subscriptionStatus || "none",
      hasStripeCustomer: data.hasStripeCustomer || false,
      billingCycleStart: data.billingCycleStart || null,
      aiCreditsResetAt: data.aiCreditsResetAt || null,
      jobAiCreditsRemaining: data.jobAiCreditsRemaining ?? 0,
      jobAiCreditsTotal: data.jobAiCreditsTotal ?? 0,
      jobAiCreditsResetAt: data.jobAiCreditsResetAt || null,
    };
    _cachedStatus = status;
    return status;
  } catch {
    return DEFAULT_STATUS;
  }
}

/** Fetch once, dedup concurrent calls */
function fetchSubscriptionShared(): Promise<SubscriptionStatus> {
  if (!_fetchPromise) {
    _fetchPromise = fetchFromServer().finally(() => { _fetchPromise = null; });
  }
  return _fetchPromise;
}

/** Emit sync event so all hook instances update */
function emitSync(status: SubscriptionStatus) {
  _cachedStatus = status;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: status }));
  }
}

export function useSubscription() {
  const [status, setStatus] = useState<SubscriptionStatus>(_cachedStatus || DEFAULT_STATUS);
  const [loading, setLoading] = useState(!_cachedStatus);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Listen for sync events from other hook instances */
  useEffect(() => {
    const handler = (e: Event) => {
      const synced = (e as CustomEvent<SubscriptionStatus>).detail;
      setStatus(synced);
    };
    window.addEventListener(SYNC_EVENT, handler);
    return () => window.removeEventListener(SYNC_EVENT, handler);
  }, []);

  /** Initial fetch on mount (shared / deduped) */
  useEffect(() => {
    if (_cachedStatus) {
      setStatus(_cachedStatus);
      setLoading(false);
      return;
    }
    fetchSubscriptionShared().then((s) => {
      setStatus(s);
      emitSync(s);
      setLoading(false);
    });
  }, []);

  /** Re-fetch from server and sync all instances */
  const refresh = useCallback(async () => {
    setLoading(true);
    _cachedStatus = null; // bust cache
    const s = await fetchFromServer();
    emitSync(s);
    setLoading(false);
  }, []);

  /**
   * Optimistic local decrement + delayed server re-fetch.
   * The optimistic update gives instant UI feedback.
   * The server re-fetch (500ms later) corrects any drift.
   */
  const decrementCredit = useCallback(() => {
    setStatus((prev) => {
      const updated = {
        ...prev,
        aiCreditsRemaining: Math.max(0, prev.aiCreditsRemaining - 1),
      };
      emitSync(updated);
      return updated;
    });

    // Re-fetch from server after a short delay to get the real count
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(async () => {
      const s = await fetchFromServer();
      emitSync(s);
    }, 800);
  }, []);

  /** Optimistic decrement for job AI credits (separate weekly pool) */
  const decrementJobCredit = useCallback(() => {
    setStatus((prev) => {
      const updated = {
        ...prev,
        jobAiCreditsRemaining: Math.max(0, prev.jobAiCreditsRemaining - 1),
      };
      emitSync(updated);
      return updated;
    });

    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(async () => {
      const s = await fetchFromServer();
      emitSync(s);
    }, 800);
  }, []);

  /** Switch plan via dev-only API. Only works in development. */
  const setPlan = useCallback(async (plan: SubscriptionPlan) => {
    if (process.env.NODE_ENV === "production") return;
    try {
      const res = await fetch("/api/dev/set-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ plan }),
      });
      if (!res.ok) {
        console.error("[useSubscription] setPlan failed:", await res.text());
        return;
      }
      // Re-fetch from server to get the updated state
      await refresh();
    } catch (err) {
      console.error("[useSubscription] setPlan error:", err);
    }
  }, [refresh]);

  return { status, loading, decrementCredit, decrementJobCredit, setPlan, refresh };
}

