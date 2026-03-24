"use client";

/**
 * useGeoPricing — Detect user region and return localized pricing.
 *
 * Detection strategy (no external API needed):
 *   1. Intl.DateTimeFormat().resolvedOptions().timeZone
 *   2. navigator.language / navigator.languages
 *
 * Aggressive pricing benchmarked against:
 *   - Workable:    $299–$719/mo (US)
 *   - Keka:        ₹9,999+/mo (India)
 *   - Greenhouse:  Custom (enterprise $500+/mo est.)
 *   - Freshteam:   $71–$119/mo (US)
 *
 * Cost per AI request (GPT-5.4-mini): ~₹0.14 ($0.0016)
 *
 * Margin analysis:
 *   Pro  (1,000 credits): max cost ₹140 → IN ₹1,499 = 91% margin
 *   Ent  (5,000 credits): max cost ₹700 → IN ₹4,999 = 86% margin
 *   Pro  (1,000 credits): max cost $1.60 → US $79 = 98% margin
 *   Ent  (5,000 credits): max cost $8.00 → US $249 = 97% margin
 */

import { useState, useEffect } from "react";

/* ================================================================== */
/*  Region config                                                      */
/* ================================================================== */

export type PricingRegion = "US" | "UK" | "EU" | "IN" | "OTHER";

export interface RegionPricing {
  region: PricingRegion;
  currency: string;
  currencySymbol: string;
  flag: string;
  pro: { price: number; display: string };
  enterprise: { price: number; display: string };
  free: { display: string };
}

const PRICING: Record<PricingRegion, RegionPricing> = {
  US: {
    region: "US",
    currency: "USD",
    currencySymbol: "$",
    flag: "🇺🇸",
    free: { display: "$0" },
    pro: { price: 79, display: "$79" },
    enterprise: { price: 249, display: "$249" },
  },
  UK: {
    region: "UK",
    currency: "GBP",
    currencySymbol: "£",
    flag: "🇬🇧",
    free: { display: "£0" },
    pro: { price: 59, display: "£59" },
    enterprise: { price: 189, display: "£189" },
  },
  EU: {
    region: "EU",
    currency: "EUR",
    currencySymbol: "€",
    flag: "🇪🇺",
    free: { display: "€0" },
    pro: { price: 69, display: "€69" },
    enterprise: { price: 219, display: "€219" },
  },
  IN: {
    region: "IN",
    currency: "INR",
    currencySymbol: "₹",
    flag: "🇮🇳",
    free: { display: "₹0" },
    pro: { price: 1499, display: "₹1,499" },
    enterprise: { price: 4999, display: "₹4,999" },
  },
  OTHER: {
    region: "OTHER",
    currency: "USD",
    currencySymbol: "$",
    flag: "🌍",
    free: { display: "$0" },
    pro: { price: 79, display: "$79" },
    enterprise: { price: 249, display: "$249" },
  },
};

/* ================================================================== */
/*  Timezone → Region mapping                                          */
/* ================================================================== */

const TZ_TO_REGION: Record<string, PricingRegion> = {
  // India
  "Asia/Kolkata": "IN",
  "Asia/Calcutta": "IN",
  "Asia/Chennai": "IN",

  // UK & Ireland
  "Europe/London": "UK",
  "Europe/Dublin": "UK",
  "Europe/Belfast": "UK",

  // EU major cities
  "Europe/Berlin": "EU",
  "Europe/Paris": "EU",
  "Europe/Madrid": "EU",
  "Europe/Rome": "EU",
  "Europe/Amsterdam": "EU",
  "Europe/Brussels": "EU",
  "Europe/Vienna": "EU",
  "Europe/Stockholm": "EU",
  "Europe/Copenhagen": "EU",
  "Europe/Helsinki": "EU",
  "Europe/Lisbon": "EU",
  "Europe/Warsaw": "EU",
  "Europe/Prague": "EU",
  "Europe/Bucharest": "EU",
  "Europe/Budapest": "EU",
  "Europe/Athens": "EU",
  "Europe/Zurich": "EU",
  "Europe/Oslo": "EU",

  // US timezones
  "America/New_York": "US",
  "America/Chicago": "US",
  "America/Denver": "US",
  "America/Los_Angeles": "US",
  "America/Phoenix": "US",
  "America/Anchorage": "US",
  "Pacific/Honolulu": "US",
  "America/Detroit": "US",
  "America/Indianapolis": "US",
  "America/Boise": "US",
};

/* ================================================================== */
/*  Language prefix → Region fallback                                   */
/* ================================================================== */

const LANG_TO_REGION: Record<string, PricingRegion> = {
  "en-US": "US",
  "en-GB": "UK",
  "en-IN": "IN",
  "hi": "IN",
  "hi-IN": "IN",
  "mr": "IN",
  "ta": "IN",
  "te": "IN",
  "kn": "IN",
  "ml": "IN",
  "gu": "IN",
  "bn": "IN",
  "pa": "IN",
  "de": "EU",
  "de-DE": "EU",
  "de-AT": "EU",
  "de-CH": "EU",
  "fr": "EU",
  "fr-FR": "EU",
  "es": "EU",
  "es-ES": "EU",
  "it": "EU",
  "it-IT": "EU",
  "nl": "EU",
  "nl-NL": "EU",
  "pt-PT": "EU",
  "sv": "EU",
  "da": "EU",
  "fi": "EU",
  "nb": "EU",
  "pl": "EU",
};

/* ================================================================== */
/*  Country code → Region mapping (for IP geolocation)                 */
/* ================================================================== */

const COUNTRY_TO_REGION: Record<string, PricingRegion> = {
  // India
  IN: "IN",
  // US & territories
  US: "US",
  PR: "US",
  GU: "US",
  VI: "US",
  // UK
  GB: "UK",
  // EU member states + EEA
  DE: "EU", FR: "EU", ES: "EU", IT: "EU", NL: "EU", BE: "EU",
  AT: "EU", SE: "EU", DK: "EU", FI: "EU", PT: "EU", PL: "EU",
  CZ: "EU", RO: "EU", HU: "EU", GR: "EU", IE: "EU", BG: "EU",
  HR: "EU", SK: "EU", SI: "EU", LT: "EU", LV: "EU", EE: "EU",
  CY: "EU", LU: "EU", MT: "EU", NO: "EU", CH: "EU", IS: "EU",
  LI: "EU",
};

/* ================================================================== */
/*  Detection logic                                                    */
/* ================================================================== */

/** Fetch country code from an API with timeout */
async function fetchCountryCode(
  url: string,
  extract: (data: any) => string,
  timeoutMs = 3000,
): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.error) return null; // e.g. ipapi.co rate limit
    const code = extract(data);
    return code ? code.toUpperCase() : null;
  } catch {
    return null;
  }
}

/** IP geolocation APIs — tried in order, first success wins */
const GEO_APIS: { url: string; extract: (d: any) => string }[] = [
  // 1. country.is — minimal, fast, generous limits
  { url: "https://api.country.is", extract: (d) => d.country },
  // 2. ipwho.is — rich data, 10k free req/month
  { url: "https://ipwho.is/", extract: (d) => d.country_code },
  // 3. ipapi.co — 1k free req/day (can be rate-limited)
  { url: "https://ipapi.co/json/", extract: (d) => d.country_code },
];

/** Detect region: IP geolocation → timezone → language */
async function detectRegionAsync(): Promise<PricingRegion> {
  // 1. IP geolocation — client-side fetch (CSP whitelisted)
  for (const api of GEO_APIS) {
    const code = await fetchCountryCode(api.url, api.extract);
    if (code && COUNTRY_TO_REGION[code]) {
      return COUNTRY_TO_REGION[code];
    }
    // Valid country code but not in our pricing map → use OTHER
    if (code && code.length === 2) return "OTHER";
  }

  // 2. Timezone fallback (if all APIs failed)
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && TZ_TO_REGION[tz]) {
      return TZ_TO_REGION[tz];
    }
  } catch {
    // ignore
  }

  // 3. Language fallback
  try {
    if (typeof navigator !== "undefined") {
      const langs = navigator.languages ?? [navigator.language];
      for (const lang of langs) {
        if (LANG_TO_REGION[lang]) return LANG_TO_REGION[lang];
        const base = lang.split("-")[0];
        if (base && LANG_TO_REGION[base]) return LANG_TO_REGION[base];
      }
    }
  } catch {
    // ignore
  }

  return "OTHER";
}

/* ================================================================== */
/*  Hook                                                               */
/* ================================================================== */

export function useGeoPricing() {
  const [pricing, setPricing] = useState<RegionPricing>(PRICING.OTHER);
  const [region, setRegion] = useState<PricingRegion>("OTHER");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    detectRegionAsync().then((detected) => {
      if (cancelled) return;
      setRegion(detected);
      setPricing(PRICING[detected]);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  return { pricing, region, loading, allPricing: PRICING };
}

export { PRICING };
