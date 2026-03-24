"use client";

import React, { useState, useEffect } from "react";
import { LOGIN_URL } from "@/lib/marketing-config";

/* ================================================================== */
/*  Inline geo-pricing (mirrored from admin app's useGeoPricing)       */
/* ================================================================== */

type PricingRegion = "US" | "UK" | "EU" | "IN" | "OTHER";

interface RegionPricing {
  region: PricingRegion;
  currency: string;
  currencySymbol: string;
  pro: { price: number; display: string };
  enterprise: { price: number; display: string };
}

const PRICING: Record<PricingRegion, RegionPricing> = {
  US: { region: "US", currency: "USD", currencySymbol: "$", pro: { price: 79, display: "$79" }, enterprise: { price: 249, display: "$249" } },
  UK: { region: "UK", currency: "GBP", currencySymbol: "£", pro: { price: 59, display: "£59" }, enterprise: { price: 189, display: "£189" } },
  EU: { region: "EU", currency: "EUR", currencySymbol: "€", pro: { price: 69, display: "€69" }, enterprise: { price: 219, display: "€219" } },
  IN: { region: "IN", currency: "INR", currencySymbol: "₹", pro: { price: 1499, display: "₹1,499" }, enterprise: { price: 4999, display: "₹4,999" } },
  OTHER: { region: "OTHER", currency: "USD", currencySymbol: "$", pro: { price: 79, display: "$79" }, enterprise: { price: 249, display: "$249" } },
};

const TZ_TO_REGION: Record<string, PricingRegion> = {
  "Asia/Kolkata": "IN", "Asia/Calcutta": "IN", "Asia/Chennai": "IN",
  "Europe/London": "UK", "Europe/Dublin": "UK",
  "Europe/Berlin": "EU", "Europe/Paris": "EU", "Europe/Madrid": "EU", "Europe/Rome": "EU", "Europe/Amsterdam": "EU",
  "America/New_York": "US", "America/Chicago": "US", "America/Denver": "US", "America/Los_Angeles": "US",
};

function detectRegion(): PricingRegion {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && TZ_TO_REGION[tz]) return TZ_TO_REGION[tz];
  } catch { /* ignore */ }
  return "OTHER";
}

function perDay(price: number): string {
  const daily = Math.round(price / 30);
  return daily.toString();
}

/* ================================================================== */
/*  Component                                                          */
/* ================================================================== */

const CHECK = (
  <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
);

export default function PricingSection() {
  const [region, setRegion] = useState<PricingRegion>("OTHER");
  const [ready, setReady] = useState(false);
  const pricing = PRICING[region];

  useEffect(() => {
    setRegion(detectRegion());
    setReady(true);
  }, []);

  return (
    <section id="pricing" className="py-24 sm:py-32">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <p className="text-sm font-semibold text-blue-600 uppercase tracking-wider mb-3">
            Simple pricing
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 tracking-tight">
            Start free. Upgrade when ready.
          </h2>
          <p className="mt-4 text-lg text-gray-500">
            No hidden fees. Cancel anytime. Most teams upgrade within 2 days.
          </p>
          <p className="mt-2 text-sm text-gray-400">
            🔒 Cancel anytime · No lock-in · 100% transparent
          </p>
        </div>

        {/* Plans */}
        <div className={`grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto transition-opacity duration-300 ${ready ? "opacity-100" : "opacity-0"}`}>
          {/* Free */}
          <div className="bg-white rounded-2xl border border-gray-200 p-8 hover:border-gray-300 hover:shadow-lg transition-all duration-300">
            <h3 className="text-lg font-semibold text-gray-900">Free</h3>
            <p className="text-sm text-gray-500 mt-1 mb-6">Perfect for trying things out</p>
            <div className="mb-6">
              <span className="text-4xl font-bold text-gray-900">{pricing.currencySymbol}0</span>
              <span className="text-gray-500 text-sm ml-1">/month</span>
            </div>
            <a
              href={LOGIN_URL}
              className="block w-full text-center bg-gray-100 hover:bg-gray-200 text-gray-900 font-semibold py-3 rounded-xl transition-colors text-sm"
            >
              Get Started
            </a>
            <ul className="mt-8 space-y-3">
              {[
                "Visual editor access",
                "1 career site",
                "5 job listings",
                "Community support",
              ].map((f) => (
                <li key={f} className="flex items-center gap-3 text-sm text-gray-600">
                  {CHECK}
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Pro — highlighted */}
          <div className="relative bg-white rounded-2xl border-2 border-blue-600 p-8 shadow-xl shadow-blue-600/10 hover:shadow-2xl hover:shadow-blue-600/15 hover:-translate-y-1 transition-all duration-300">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
              <span className="bg-blue-600 text-white text-xs font-bold px-4 py-1.5 rounded-full">
                MOST POPULAR
              </span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Pro</h3>
            <p className="text-sm text-gray-500 mt-1 mb-6">For growing teams</p>
            <div className="mb-1">
              <span className="text-4xl font-bold text-gray-900">{pricing.pro.display}</span>
              <span className="text-gray-500 text-sm ml-1">/month</span>
            </div>
            <p className="text-xs text-green-600 font-medium mb-6">
              Just {pricing.currencySymbol}{perDay(pricing.pro.price)}/day · Generate 10–20 career pages/month
            </p>
            <a
              href={LOGIN_URL}
              className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors text-sm shadow-lg shadow-blue-600/25"
            >
              Start Free Trial
            </a>
            <ul className="mt-8 space-y-3">
              {[
                "Everything in Free",
                "1,000 AI credits/month",
                "25 AI job descriptions/week",
                "Unlimited job listings",
                "Multi-page AI generation",
                "Priority support",
              ].map((f) => (
                <li key={f} className="flex items-center gap-3 text-sm text-gray-600">
                  {CHECK}
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-6 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-400 leading-relaxed">
                💡 Replace {pricing.currencySymbol}{pricing.pro.price < 200 ? "5,000" : "50,000"}+ in development work
              </p>
            </div>
          </div>

          {/* Enterprise */}
          <div className="bg-white rounded-2xl border border-gray-200 p-8 hover:border-gray-300 hover:shadow-lg transition-all duration-300">
            <h3 className="text-lg font-semibold text-gray-900">Enterprise</h3>
            <p className="text-sm text-gray-500 mt-1 mb-6">For scaling organizations</p>
            <div className="mb-1">
              <span className="text-4xl font-bold text-gray-900">{pricing.enterprise.display}</span>
              <span className="text-gray-500 text-sm ml-1">/month</span>
            </div>
            <p className="text-xs text-gray-400 font-medium mb-6">
              {pricing.currencySymbol}{perDay(pricing.enterprise.price)}/day · Unlimited potential
            </p>
            <a
              href="mailto:rohitmengji403@gmail.com?subject=Enterprise%20Plan%20Inquiry"
              className="block w-full text-center bg-gray-900 hover:bg-gray-800 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
            >
              Contact Sales
            </a>
            <ul className="mt-8 space-y-3">
              {[
                "Everything in Pro",
                "5,000 AI credits/month",
                "White-label branding",
                "Multi-tenant support",
                "Stripe billing portal",
                "Dedicated support",
              ].map((f) => (
                <li key={f} className="flex items-center gap-3 text-sm text-gray-600">
                  {CHECK}
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
