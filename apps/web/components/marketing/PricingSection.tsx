/*
 * PricingSection.tsx — the "#pricing" section of the public landing page (apps/web).
 *
 * WHAT: Renders the Free / Pro / Enterprise plan cards with prices localized to
 * the visitor's region (currency + amount). Pure marketing display; no DB, no
 * tenant scoping — this is the unauthenticated career-site, not the admin app.
 *
 * WHY: Pricing must show in the visitor's local currency to convert better, but
 * we have no server-side geo lookup here. So we detect region client-side from
 * the browser timezone and pick a hardcoded price table (PRICING).
 *
 * HOW: A "use client" component — region detection (detectRegion) reads
 * Intl timezone, a browser-only API, so it runs in useEffect AFTER mount. To
 * avoid an SSR/client hydration flash of the wrong (default "OTHER") prices, the
 * plans grid stays opacity-0 until `ready` flips true post-detection.
 * NOTE: the PRICING / region logic is intentionally MIRRORED from the admin
 * app's useGeoPricing hook — keep the two tables in sync if either changes.
 */
"use client";

import React, { useState, useEffect } from "react";
import { LOGIN_URL } from "@/lib/marketing-config";
import { Container, Section, SectionHeader, Card, ButtonLink, CheckIcon } from "@/components/ui";

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
    // Browser timezone is our only signal here (no server geo/IP lookup on the
    // public site). Unrecognized zones fall through to the "OTHER" default.
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

const CHECK = <CheckIcon className="w-4 h-4 text-emerald-600 shrink-0" />;

export default function PricingSection() {
  const [region, setRegion] = useState<PricingRegion>("OTHER");
  const [ready, setReady] = useState(false);
  const pricing = PRICING[region];

  useEffect(() => {
    // detectRegion() reads browser-only APIs (locale/timezone) unavailable
    // during SSR, so region is resolved on the client after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRegion(detectRegion());
    setReady(true);
  }, []);

  return (
    <Section id="pricing">
      <Container>
        <SectionHeader
          eyebrow="Simple pricing"
          title="Start free. Upgrade when ready."
          subtitle="No hidden fees. Cancel anytime. Most teams upgrade within 2 days."
        />
        <p className="-mt-6 mb-10 text-center text-sm text-gray-500">
          Cancel anytime · No lock-in · 100% transparent
        </p>

        {/* Plans */}
        <div className={`grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto transition-opacity duration-300 ${ready ? "opacity-100" : "opacity-0"}`}>
          {/* Free */}
          <Card className="flex flex-col">
            <h3 className="text-lg font-semibold text-gray-900">Free</h3>
            <p className="text-sm text-gray-600 mt-1 mb-6">Perfect for trying things out</p>
            <div className="mb-6">
              <span className="text-4xl font-bold text-gray-900">{pricing.currencySymbol}0</span>
              <span className="text-gray-600 text-sm ml-1">/month</span>
            </div>
            <ButtonLink href={LOGIN_URL} variant="secondary" size="lg" fullWidth>
              Get Started
            </ButtonLink>
            <ul className="mt-8 space-y-3">
              {[
                "Visual editor access",
                "1 career site",
                "5 job listings",
                "Community support",
              ].map((f) => (
                <li key={f} className="flex items-center gap-3 text-sm text-gray-700">
                  {CHECK}
                  {f}
                </li>
              ))}
            </ul>
          </Card>

          {/* Pro — highlighted */}
          <Card className="relative flex flex-col border-2 border-blue-600 shadow-md">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
              <span className="bg-blue-600 text-white text-xs font-bold px-4 py-1.5 rounded-full">
                MOST POPULAR
              </span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Pro</h3>
            <p className="text-sm text-gray-600 mt-1 mb-6">For growing teams</p>
            <div className="mb-1">
              <span className="text-4xl font-bold text-gray-900">{pricing.pro.display}</span>
              <span className="text-gray-600 text-sm ml-1">/month</span>
            </div>
            <p className="text-xs text-emerald-700 font-medium mb-6">
              Just {pricing.currencySymbol}{perDay(pricing.pro.price)}/day · Generate 10–20 career pages/month
            </p>
            <ButtonLink href={LOGIN_URL} variant="primary" size="lg" fullWidth>
              Start Free Trial
            </ButtonLink>
            <ul className="mt-8 space-y-3">
              {[
                "Everything in Free",
                "500 AI credits/month",
                "25 AI job descriptions/week",
                "Unlimited job listings",
                "Multi-page AI generation",
                "Priority support",
              ].map((f) => (
                <li key={f} className="flex items-center gap-3 text-sm text-gray-700">
                  {CHECK}
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-6 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-600 leading-relaxed">
                Replace {pricing.currencySymbol}{pricing.pro.price < 200 ? "5,000" : "50,000"}+ in development work
              </p>
            </div>
          </Card>

          {/* Enterprise */}
          <Card className="flex flex-col">
            <h3 className="text-lg font-semibold text-gray-900">Enterprise</h3>
            <p className="text-sm text-gray-600 mt-1 mb-6">For scaling organizations</p>
            <div className="mb-1">
              <span className="text-4xl font-bold text-gray-900">{pricing.enterprise.display}</span>
              <span className="text-gray-600 text-sm ml-1">/month</span>
            </div>
            <p className="text-xs text-gray-600 font-medium mb-6">
              {pricing.currencySymbol}{perDay(pricing.enterprise.price)}/day · Unlimited potential
            </p>
            <ButtonLink href="mailto:rohitmengji403@gmail.com?subject=Enterprise%20Plan%20Inquiry" variant="secondary" size="lg" fullWidth className="bg-gray-900 text-white hover:bg-gray-800">
              Contact Sales
            </ButtonLink>
            <ul className="mt-8 space-y-3">
              {[
                "Everything in Pro",
                "2,500 AI credits/month",
                "White-label branding",
                "Multi-tenant support",
                "Stripe billing portal",
                "Dedicated support",
              ].map((f) => (
                <li key={f} className="flex items-center gap-3 text-sm text-gray-700">
                  {CHECK}
                  {f}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </Container>
    </Section>
  );
}
