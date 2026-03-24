"use client";

/**
 * DevPlanSwitcher — Floating dev-only widget to toggle subscription plans.
 *
 * Shows a small pill in the bottom-left corner of the screen.
 * Click to expand and switch between Free / Pro / Enterprise.
 * Only renders in development mode (NODE_ENV !== "production").
 */

import { useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import type { SubscriptionPlan } from "@/lib/ai/types";
import { useSubscription } from "@/lib/ai/useSubscription";

const PLAN_CONFIG: {
  plan: SubscriptionPlan;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: string;
}[] = [
  {
    plan: "free",
    label: "Free",
    color: "text-gray-700",
    bgColor: "bg-gray-100",
    borderColor: "border-gray-300",
    icon: "🔒",
  },
  {
    plan: "pro",
    label: "Pro",
    color: "text-purple-700",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-400",
    icon: "⚡",
  },
  {
    plan: "enterprise",
    label: "Enterprise",
    color: "text-amber-700",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-400",
    icon: "🏢",
  },
];

export default function DevPlanSwitcher() {
  const pathname = usePathname();

  // Only render in development
  if (process.env.NODE_ENV === "production") return null;

  // Only show on the editor page — gate BEFORE calling useSubscription
  // to avoid unnecessary /api/subscription calls on login/other pages
  if (pathname !== "/editor") return null;

  return <DevPlanSwitcherInner />;
}

function DevPlanSwitcherInner() {
  const { status, setPlan, loading } = useSubscription();
  const [expanded, setExpanded] = useState(false);
  const [switching, setSwitching] = useState(false);

  const currentConfig = PLAN_CONFIG.find((p) => p.plan === status.plan) ?? PLAN_CONFIG[0];

  const handleSwitch = useCallback(
    async (plan: SubscriptionPlan) => {
      setSwitching(true);
      await setPlan(plan);
      setSwitching(false);
      setExpanded(false);
    },
    [setPlan],
  );

  if (loading) return null;

  return (
    <div className="fixed top-1.5 left-80 z-9999">
      {/* Collapsed pill */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 shadow-lg text-xs font-bold transition-all hover:scale-105 active:scale-95 ${currentConfig.bgColor} ${currentConfig.borderColor} ${currentConfig.color}`}
      >
        <span>{currentConfig.icon}</span>
        <span>{currentConfig.label}</span>
        <span className="text-[10px] opacity-60">DEV</span>
      </button>

      {/* Expanded dropdown panel (opens below the pill) */}
      {expanded && (
        <div className="absolute top-full left-0 mt-2 rounded-xl border border-gray-200 bg-white shadow-2xl p-3 w-56">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              🛠 Dev Plan Switcher
            </span>
            <button
              onClick={() => setExpanded(false)}
              className="text-gray-400 hover:text-gray-600 text-sm font-bold"
            >
              ✕
            </button>
          </div>
          <div className="space-y-2">
            {PLAN_CONFIG.map((cfg) => {
              const isActive = status.plan === cfg.plan;
              return (
                <button
                  key={cfg.plan}
                  disabled={switching}
                  onClick={() => handleSwitch(cfg.plan)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all disabled:opacity-50 ${
                    isActive
                      ? `${cfg.bgColor} ${cfg.borderColor} ${cfg.color} ring-2 ring-offset-1 ring-purple-200`
                      : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <span className="text-lg">{cfg.icon}</span>
                  <span className="flex-1 text-left">{cfg.label}</span>
                  {isActive && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-bold">
                      Active
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-3 pt-2 border-t border-gray-100">
            <div className="text-[10px] text-gray-400 space-y-0.5">
              {switching ? (
                <p className="text-purple-500 font-semibold">⏳ Switching plan…</p>
              ) : (
                <>
                  <p>Page AI Credits: {`${status.aiCreditsRemaining.toLocaleString()}/${status.aiCreditsTotal.toLocaleString()}`}</p>
                  <p>Job AI Credits: {`${status.jobAiCreditsRemaining.toLocaleString()}/${status.jobAiCreditsTotal.toLocaleString()}/week`}</p>
                  <p>AI Enabled: {status.aiEnabled ? "✅ Yes" : "❌ No"}</p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
