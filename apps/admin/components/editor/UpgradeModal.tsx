"use client";

/**
 * UpgradeModal — Premium upgrade prompt with geo-based pricing.
 * Detects user's region (US/UK/EU/India) and shows localized prices.
 * Shown when FREE users attempt to use AI features.
 *
 * On upgrade click → calls /api/stripe/checkout → redirects to Stripe.
 */

import { useState } from "react";
import { createPortal } from "react-dom";
import type { SubscriptionPlan } from "@/lib/ai/types";
import { useGeoPricing, type RegionPricing } from "@/lib/ai/useGeoPricing";
import { csrfHeaders } from "@/lib/csrf";
import BillingPortalButton from "./BillingPortalButton";

interface UpgradeModalProps {
  currentPlan: SubscriptionPlan;
  /** Whether the user has a linked Stripe customer (ever subscribed) */
  hasStripeCustomer?: boolean;
  /** Current subscription status */
  subscriptionStatus?: string;
  onUpgrade: (plan: SubscriptionPlan) => void;
  onClose: () => void;
}

function buildPlans(pricing: RegionPricing) {
  return [
    {
      plan: "free" as const,
      label: "Free",
      price: pricing.free.display,
      period: "forever",
      features: [
        "Visual drag-and-drop editor",
        "30+ block library",
        "Publish to custom domain",
        "Mobile responsive",
      ],
      cta: "Current Plan",
      disabled: true,
      highlight: false,
    },
    {
      plan: "pro" as const,
      label: "Pro",
      price: pricing.pro.display,
      period: "/month",
      features: [
        "Everything in Free",
        "AI content generation",
        "AI page builder",
        "500 AI credits/month",
        "Priority support",
      ],
      cta: "Upgrade to Pro",
      disabled: false,
      highlight: true,
    },
    {
      plan: "enterprise" as const,
      label: "Enterprise",
      price: pricing.enterprise.display,
      period: "/month",
      features: [
        "Everything in Pro",
        "2,500 AI credits/month",
        "Custom AI models",
        "Team collaboration",
        "Dedicated support",
        "SSO & audit logs",
      ],
      cta: "Contact Sales",
      disabled: false,
      highlight: false,
    },
  ];
}

export default function UpgradeModal({ currentPlan, hasStripeCustomer, subscriptionStatus, onUpgrade, onClose }: UpgradeModalProps) {
  const { pricing, region, loading } = useGeoPricing();
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const plans = buildPlans(pricing);

  async function handleUpgrade(plan: SubscriptionPlan) {
    if (plan === "free") return;

    // Enterprise → open prefilled email to sales
    if (plan === "enterprise") {
      const subject = encodeURIComponent("Enterprise Plan Inquiry — Career Builder");
      const body = encodeURIComponent(
        `Hi,\n\nI'm interested in the Enterprise plan for Career Builder.\n\nPlease share details about:\n- 2,500 AI credits/month\n- Custom AI models\n- Team collaboration & SSO\n- Dedicated support\n\nCompany: \nTeam size: \n\nThank you!`
      );
      window.open(`mailto:rohitmengji403@gmail.com?subject=${subject}&body=${body}`, "_blank");
      return;
    }

    // Pro → Stripe Checkout
    setCheckoutLoading(plan);
    setCheckoutError(null);

    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: csrfHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({ plan }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to start checkout");
      }

      const { url } = await res.json();
      if (url && (url.startsWith("https://checkout.stripe.com") || url.startsWith("https://billing.stripe.com"))) {
        window.location.href = url;
      } else {
        throw new Error("Invalid checkout URL returned");
      }
    } catch (err: any) {
      setCheckoutError(err.message || "Checkout failed. Please try again.");
      setCheckoutLoading(null);
    }
  }
  return createPortal(
    <div
      className="fixed inset-0 z-10000 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-[92vw] max-w-195 overflow-hidden animate-modal-in"
      >
        {/* Header */}
        <div className="relative px-8 pt-8 pb-6 bg-linear-to-br from-purple-600 via-indigo-600 to-blue-600 text-white">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors"
          >
            ✕
          </button>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-xl">
              ✨
            </div>
            <div>
              <h2 className="text-xl font-bold">Unlock AI-Powered Editing</h2>
              <p className="text-sm text-white/70">Generate, improve, and expand content with AI</p>
            </div>
          </div>
          {/* Region indicator */}
          {!loading && (
            <div className="absolute top-4 right-14 flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/10 text-[10px] text-white/70">
              <span>{pricing.flag}</span>
              <span>Prices in {pricing.currency}</span>
            </div>
          )}
        </div>

        {/* Plans grid */}
        <div className="px-6 py-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin" />
            </div>
          ) : (
          <div className="grid grid-cols-3 gap-4">
            {plans.map((p) => {
              const isCurrent = p.plan === currentPlan;
              return (
                <div
                  key={p.plan}
                  className={`relative rounded-xl border-2 p-5 transition-all ${
                    p.highlight
                      ? "border-purple-400 bg-purple-50/50 shadow-lg shadow-purple-100 scale-[1.02]"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  {p.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-purple-600 text-white text-[10px] font-bold uppercase tracking-wider">
                      Most Popular
                    </div>
                  )}

                  <div className="mb-4">
                    <h3 className="text-sm font-bold text-gray-900">{p.label}</h3>
                    <div className="flex items-baseline gap-0.5 mt-1">
                      <span className="text-2xl font-extrabold text-gray-900">{p.price}</span>
                      <span className="text-xs text-gray-500">{p.period}</span>
                    </div>
                  </div>

                  <ul className="space-y-2 mb-5">
                    {p.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                        <span className={`mt-0.5 text-[10px] ${f.includes("AI") ? "text-purple-500" : "text-green-500"}`}>
                          ✓
                        </span>
                        <span className={f.includes("AI") ? "font-semibold text-purple-700" : ""}>
                          {f}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => !isCurrent && !p.disabled && handleUpgrade(p.plan)}
                    disabled={isCurrent || p.plan === "free" || checkoutLoading !== null}
                    className={`w-full py-2.5 rounded-lg text-xs font-bold transition-all ${
                      isCurrent
                        ? "bg-gray-100 text-gray-400 cursor-default"
                        : checkoutLoading === p.plan
                          ? "bg-purple-400 text-white cursor-wait"
                          : p.highlight
                            ? "bg-purple-600 hover:bg-purple-500 text-white shadow-sm hover:shadow-md"
                            : p.plan === "free"
                              ? "bg-gray-100 text-gray-400 cursor-default"
                              : "bg-gray-900 hover:bg-gray-800 text-white"
                    }`}
                  >
                    {checkoutLoading === p.plan ? "Redirecting…" : isCurrent ? "Current Plan" : p.cta}
                  </button>
                </div>
              );
            })}
          </div>
          )}

          {checkoutError && (
            <div className="mt-3 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 text-center">
              {checkoutError}
            </div>
          )}

          <p className="text-center text-[10px] text-gray-400 mt-4">
            Cancel anytime · 14-day money-back guarantee · Prices exclude tax
          </p>

          {/* Manage existing subscription — shown if user has Stripe customer */}
          {hasStripeCustomer && (
            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-center gap-2">
              <span className="text-[10px] text-gray-400">Already subscribed?</span>
              <BillingPortalButton compact />
            </div>
          )}

          {/* Canceled subscription notice */}
          {subscriptionStatus === "canceled" && (
            <div className="mt-3 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-center">
              <p className="text-[11px] font-semibold text-amber-700">Your subscription was canceled</p>
              <p className="text-[10px] text-amber-600 mt-0.5">Subscribe again to restore AI access and credits</p>
            </div>
          )}

          {/* Past due payment notice */}
          {subscriptionStatus === "past_due" && (
            <div className="mt-3 px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg text-center">
              <p className="text-[11px] font-semibold text-red-700">⚠️ Payment failed</p>
              <p className="text-[10px] text-red-600 mt-0.5">Please update your payment method to keep your subscription active</p>
              <div className="mt-2 flex justify-center">
                <BillingPortalButton compact />
              </div>
            </div>
          )}
        </div>
      </div>

    </div>,
    document.body,
  );
}
