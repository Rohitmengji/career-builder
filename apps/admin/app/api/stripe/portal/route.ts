/**
 * POST /api/stripe/portal
 *
 * Creates a Stripe Customer Portal session for self-service billing management.
 * Users can: manage subscription, upgrade/downgrade, cancel, update payment, view invoices.
 *
 * Security:
 *  - Auth required
 *  - stripeCustomerId always fetched from DB (never from client)
 *  - Viewers blocked (admin, hiring_manager, recruiter only)
 *  - Returns 400 if user has no Stripe customer (never subscribed)
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession, validateCsrf } from "@/lib/auth";
import { stripe, APP_URL } from "@/lib/stripe/config";
import { subscriptionRepo } from "@career-builder/database";

export async function POST(req: NextRequest) {
  // 0. Prevent live Stripe keys in preview environments
  const isPreview = process.env.VERCEL_ENV === "preview";
  const secretKey = process.env.STRIPE_SECRET_KEY || "";
  if (isPreview && secretKey.startsWith("sk_live_")) {
    return NextResponse.json(
      { error: "Live Stripe keys cannot be used in preview environments." },
      { status: 403 },
    );
  }

  // 1. Auth check
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // 2. Role check — viewers can't manage billing
  if (session.role === "viewer") {
    return NextResponse.json(
      { error: "You don't have permission to manage billing." },
      { status: 403 },
    );
  }

  // 2a. CSRF validation
  const csrfValid = await validateCsrf(req);
  if (!csrfValid) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  try {
    // 3. Fetch subscription state from DB — NEVER trust client
    const sub = await subscriptionRepo.getByUserId(session.userId);

    if (!sub) {
      return NextResponse.json(
        { error: "Session expired. Please log out and log back in." },
        { status: 401 },
      );
    }

    // 4. Ensure user has a Stripe customer ID
    if (!sub.stripeCustomerId) {
      return NextResponse.json(
        { error: "No billing account found. Please subscribe to a plan first." },
        { status: 400 },
      );
    }

    // 5. Create Stripe Billing Portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${APP_URL}/editor?portal=returned`,
    });

    console.log(
      `[stripe/portal] Portal session created for user ${session.userId} (customer: ${sub.stripeCustomerId})`,
    );

    return NextResponse.json({ url: portalSession.url });
  } catch (err: any) {
    console.error("[stripe/portal] Error:", err.message, err.stack);

    // Handle specific Stripe errors
    if (err.type === "StripeInvalidRequestError") {
      return NextResponse.json(
        { error: "Billing account issue. Please contact support." },
        { status: 400 },
      );
    }

    const isDev = process.env.NODE_ENV !== "production";
    return NextResponse.json(
      { error: isDev ? `Portal error: ${err.message}` : "Failed to open billing portal" },
      { status: 500 },
    );
  }
}
