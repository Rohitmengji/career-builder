/**
 * POST /api/stripe/checkout
 *
 * Creates a Stripe Checkout Session for the requested plan.
 * Auth-protected. Returns { url } for redirect.
 *
 * Safeguards:
 *  - Prevents duplicate active subscriptions
 *  - Idempotency key per user+plan (5-min window)
 *  - Validates user exists in DB
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession, validateCsrf } from "@/lib/auth";
import { stripe, PLAN_TO_PRICE, APP_URL } from "@/lib/stripe/config";
import { subscriptionRepo } from "@career-builder/database";

export async function POST(req: NextRequest) {
  // 0. Prevent live Stripe keys in preview environments
  const isPreview = process.env.VERCEL_ENV === "preview";
  const secretKey = process.env.STRIPE_SECRET_KEY || "";
  if (isPreview && secretKey.startsWith("sk_live_")) {
    return NextResponse.json(
      { error: "Live Stripe keys cannot be used in preview environments. Use sk_test_ keys." },
      { status: 403 },
    );
  }

  // 1. Auth
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // 1a. CSRF validation
  const csrfValid = await validateCsrf(req);
  if (!csrfValid) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  // 2. Parse body
  let body: { plan?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const plan = body.plan;
  if (!plan || !PLAN_TO_PRICE[plan]) {
    return NextResponse.json(
      { error: "Invalid plan. Use 'pro' or 'enterprise'." },
      { status: 400 },
    );
  }

  const priceId = PLAN_TO_PRICE[plan];
  if (!priceId) {
    return NextResponse.json(
      { error: "Stripe price ID not configured for this plan." },
      { status: 500 },
    );
  }

  try {
    // 3. Verify user exists in DB (handles stale session after DB reset)
    const sub = await subscriptionRepo.getByUserId(session.userId);
    if (!sub) {
      return NextResponse.json(
        { error: "Session expired. Please log out and log back in." },
        { status: 401 },
      );
    }

    // 4. Prevent duplicate active subscriptions
    if (sub.subscriptionStatus === "active" && sub.plan !== "free") {
      return NextResponse.json(
        { error: `You already have an active ${sub.plan} subscription. Manage it from your account settings.` },
        { status: 409 },
      );
    }

    // 5. Get or create Stripe customer
    let customerId = sub.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: session.email,
        metadata: {
          userId: session.userId,
          tenantId: session.tenantId,
        },
      });
      customerId = customer.id;
      await subscriptionRepo.setStripeCustomerId(session.userId, customerId);
      console.log(`[stripe/checkout] Created customer ${customerId} for user ${session.userId}`);
    }

    // 6. Create Checkout Session with idempotency key
    const idempotencyKey = `checkout_${session.userId}_${plan}_${Math.floor(Date.now() / 300_000)}`;

    const checkoutSession = await stripe.checkout.sessions.create(
      {
        customer: customerId,
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${APP_URL}/editor?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${APP_URL}/editor?checkout=canceled`,
        metadata: {
          userId: session.userId,
          plan,
        },
        subscription_data: {
          metadata: {
            userId: session.userId,
            plan,
          },
        },
        allow_promotion_codes: true,
      },
      { idempotencyKey },
    );

    console.log(`[stripe/checkout] Session ${checkoutSession.id} created for user ${session.userId} (${plan})`);
    return NextResponse.json({ url: checkoutSession.url });
  } catch (err: any) {
    console.error("[stripe/checkout] Error:", err.message, err.stack);
    const isDev = process.env.NODE_ENV !== "production";
    return NextResponse.json(
      { error: isDev ? `Checkout error: ${err.message}` : "Failed to create checkout session" },
      { status: 500 },
    );
  }
}
