/**
 * Stripe server-side configuration.
 *
 * Env vars:
 *   STRIPE_SECRET_KEY       — sk_test_... or sk_live_...
 *   STRIPE_WEBHOOK_SECRET   — whsec_...
 *   STRIPE_PRO_PRICE_ID     — price_... (Pro monthly)
 *   STRIPE_ENT_PRICE_ID     — price_... (Enterprise monthly)
 *   NEXT_PUBLIC_APP_URL      — http://localhost:3001
 *
 * NEVER import this file on the client side.
 */

import Stripe from "stripe";

/* ================================================================== */
/*  Runtime environment validation                                     */
/* ================================================================== */

function requireEnv(name: string, soft = false): string {
  const val = process.env[name];
  if (!val || val.includes("REPLACE_ME")) {
    if (soft) {
      console.warn(`[stripe] ${name} not set — related features disabled`);
      return "";
    }
    // In production, fail hard; in dev, warn
    if (process.env.NODE_ENV === "production") {
      throw new Error(`[stripe] Missing required env var: ${name}`);
    }
    console.warn(`[stripe] ${name} not set — billing features disabled`);
    return "";
  }
  return val;
}

// Soft (warn, don't throw) at module load. Throwing here crashed `next build`
// page-data collection when STRIPE_* weren't present in the build environment
// (env vars are a runtime concern). The lazy `stripe` client below throws a
// clear error on actual use, and routes can gate on `isStripeConfigured`.
const STRIPE_SECRET_KEY = requireEnv("STRIPE_SECRET_KEY", true);
const STRIPE_PRO_PRICE_ID = requireEnv("STRIPE_PRO_PRICE_ID", true);
const STRIPE_ENT_PRICE_ID = requireEnv("STRIPE_ENT_PRICE_ID", true);

// Webhook secret is soft — only needed when receiving webhooks
export const WEBHOOK_SECRET = requireEnv("STRIPE_WEBHOOK_SECRET", true);

// Lazily construct the Stripe client. Constructing `new Stripe("")` throws
// ("Neither apiKey nor config.authenticator provided") at MODULE LOAD, which
// previously crashed every route that merely imports this file (even just to
// read PLAN_CREDITS) whenever STRIPE_SECRET_KEY was unset — e.g. local dev or
// any deploy without billing configured. The Proxy defers construction to the
// first real Stripe call, so importing the config is always safe and only an
// actual API call surfaces the missing-key error.
let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (_stripe) return _stripe;
  if (!STRIPE_SECRET_KEY) {
    throw new Error("[stripe] STRIPE_SECRET_KEY is not configured — billing is disabled");
  }
  _stripe = new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: "2026-02-25.clover",
    typescript: true,
  });
  return _stripe;
}

/** Whether Stripe billing is configured (has a secret key). */
export const isStripeConfigured = Boolean(STRIPE_SECRET_KEY);

export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    const client = getStripe();
    const value = (client as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(client) : value;
  },
});

/* ================================================================== */
/*  Plan ↔ Price ID mapping                                            */
/* ================================================================== */

export const PLAN_PRICE_MAP: Record<string, { plan: "pro" | "enterprise"; credits: number }> = {};
if (STRIPE_PRO_PRICE_ID) PLAN_PRICE_MAP[STRIPE_PRO_PRICE_ID] = { plan: "pro", credits: 500 };
if (STRIPE_ENT_PRICE_ID) PLAN_PRICE_MAP[STRIPE_ENT_PRICE_ID] = { plan: "enterprise", credits: 2500 };

export const PLAN_TO_PRICE: Record<string, string> = {
  pro: STRIPE_PRO_PRICE_ID,
  enterprise: STRIPE_ENT_PRICE_ID,
};

export const PLAN_CREDITS: Record<string, number> = {
  free: 0,
  pro: 500,
  enterprise: 2500,
};

/** Weekly job AI credits per plan (separate from page AI credits) */
export const JOB_AI_CREDITS_PER_WEEK: Record<string, number> = {
  free: 0,
  pro: 25,
  enterprise: 25,
};

export const APP_URL = (() => {
  const explicit = process.env.NEXT_PUBLIC_APP_URL;
  if (explicit?.trim()) return explicit.trim().replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  if (process.env.NODE_ENV === "production") {
    throw new Error("[stripe] NEXT_PUBLIC_APP_URL is required in production for Stripe redirects");
  }
  return "http://localhost:3001";
})();
