/**
 * POST /api/stripe/webhook
 *
 * Handles Stripe webhook events.
 * Verifies signature, updates DB via subscriptionRepo.
 *
 * Safeguards:
 *  - Signature verification (STRIPE_WEBHOOK_SECRET)
 *  - Idempotency via event ID deduplication
 *  - User existence checks before DB writes
 *  - Returns 500 on transient DB errors (Stripe will retry)
 *  - Returns 200 on business-logic issues (no retry needed)
 *
 * Events handled:
 *   - checkout.session.completed  → activate subscription
 *   - invoice.paid                → reset credits on renewal
 *   - customer.subscription.updated → status changes (past_due, etc.)
 *   - customer.subscription.deleted → cancellation
 */

import { NextRequest, NextResponse } from "next/server";
import { stripe, PLAN_PRICE_MAP, PLAN_CREDITS, JOB_AI_CREDITS_PER_WEEK, WEBHOOK_SECRET } from "@/lib/stripe/config";
import { subscriptionRepo } from "@career-builder/database";
import { getKV } from "@career-builder/shared/kv";

/* ================================================================== */
/*  Idempotency — prevent duplicate event processing                   */
/* ================================================================== */

// Stripe may retry an event for up to ~7 minutes; keep the marker for 10.
const IDEMPOTENCY_TTL_SECONDS = 10 * 60;

/**
 * Atomic, cross-instance idempotency via the shared KV store. The previous
 * implementation used a per-process Map, which on serverless meant each
 * instance had its own view — so the same event could be processed twice (e.g.
 * double credit grants). incr() returning >1 means we've already seen it.
 * With KV_DRIVER=redis this is durable across all instances.
 */
async function isDuplicate(eventId: string): Promise<boolean> {
  try {
    const count = await getKV().incr(`stripe:webhook:${eventId}`, IDEMPOTENCY_TTL_SECONDS);
    return count > 1;
  } catch (err) {
    // Fail-open: never drop a real Stripe event because the KV is unavailable.
    console.error("[stripe/webhook] idempotency check failed (processing anyway):", err);
    return false;
  }
}

/**
 * CRITICAL: We must read raw body for signature verification.
 * Next.js App Router: use req.text() NOT req.json().
 */
export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");

  if (!signature || !WEBHOOK_SECRET) {
    console.error("[stripe/webhook] Missing signature or webhook secret");
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event;
  try {
    const rawBody = await req.text();
    event = stripe.webhooks.constructEvent(rawBody, signature, WEBHOOK_SECRET);
  } catch (err: any) {
    console.error("[stripe/webhook] Signature verification failed:", err.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Idempotency check — skip duplicate events
  if (await isDuplicate(event.id)) {
    console.log(`[stripe/webhook] Duplicate event skipped: ${event.id} (${event.type})`);
    return NextResponse.json({ received: true, duplicate: true });
  }

  console.log(`[stripe/webhook] Processing ${event.type} (${event.id})`);

  try {
    switch (event.type) {
      /* ─── Checkout complete → activate subscription ─────────── */
      case "checkout.session.completed": {
        const session = event.data.object as any;
        const userId = session.metadata?.userId;
        const subscriptionId = session.subscription as string;

        if (!userId || !subscriptionId) {
          console.warn("[stripe/webhook] checkout.session.completed missing metadata", {
            hasUserId: !!userId,
            hasSubscriptionId: !!subscriptionId,
          });
          break;
        }

        // Verify user exists before writing
        const existingUser = await subscriptionRepo.getByUserId(userId);
        if (!existingUser) {
          console.error(`[stripe/webhook] User ${userId} not found in DB — cannot activate`);
          break;
        }

        // Fetch the subscription to get the price ID
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const priceId = subscription.items.data[0]?.price?.id;
        const planInfo = priceId ? PLAN_PRICE_MAP[priceId] : null;

        if (!planInfo) {
          console.warn("[stripe/webhook] Unknown price ID:", priceId);
          break;
        }

        // Link customer ID if not already set
        if (session.customer && !existingUser.stripeCustomerId) {
          await subscriptionRepo.setStripeCustomerId(userId, session.customer as string);
        }

        // Activate subscription
        await subscriptionRepo.activateSubscription(userId, {
          plan: planInfo.plan,
          stripeSubscriptionId: subscriptionId,
          stripePriceId: priceId!,
          aiCredits: planInfo.credits,
          billingCycleStart: new Date(),
        });

        // Initialize weekly job AI credits
        const jobCredits = JOB_AI_CREDITS_PER_WEEK[planInfo.plan] || 0;
        if (jobCredits > 0) {
          await subscriptionRepo.resetJobCredits(userId, jobCredits);
        }

        console.log(`[stripe/webhook] ✅ Activated ${planInfo.plan} (${planInfo.credits} AI credits, ${jobCredits} job credits/week) for user ${userId}`);
        break;
      }

      /* ─── Invoice paid → reset credits on renewal ───────────── */
      case "invoice.paid": {
        const invoice = event.data.object as any;
        const subscriptionId = invoice.subscription as string;

        if (!subscriptionId) break;

        // Only handle renewal invoices (not the first one)
        if (invoice.billing_reason === "subscription_create") break;

        const user = await subscriptionRepo.getByStripeSubscriptionId(subscriptionId);
        if (!user) {
          console.warn("[stripe/webhook] invoice.paid — user not found for sub:", subscriptionId);
          break;
        }

        const credits = PLAN_CREDITS[user.plan] || 0;
        if (credits > 0) {
          await subscriptionRepo.resetCredits(user.id, credits);
          // Also reset weekly job credits on renewal
          const jobCredits = JOB_AI_CREDITS_PER_WEEK[user.plan] || 0;
          if (jobCredits > 0) {
            await subscriptionRepo.resetJobCredits(user.id, jobCredits);
          }
          console.log(`[stripe/webhook] ✅ Reset ${credits} AI credits + ${jobCredits} job credits for user ${user.id} (renewal)`);
        }
        break;
      }

      /* ─── Subscription updated → status sync ────────────────── */
      case "customer.subscription.updated": {
        const subscription = event.data.object as any;
        let userId = subscription.metadata?.userId;

        // Fallback: find user by subscription ID
        if (!userId) {
          const user = await subscriptionRepo.getByStripeSubscriptionId(subscription.id);
          if (!user) {
            console.warn("[stripe/webhook] subscription.updated — user not found for sub:", subscription.id);
            break;
          }
          userId = user.id;
        }

        await subscriptionRepo.updateStatus(userId, subscription.status);
        console.log(`[stripe/webhook] Status → ${subscription.status} for user ${userId}`);

        // If plan/price changed (upgrade/downgrade) while active, update credits
        const priceId = subscription.items?.data?.[0]?.price?.id;
        const planInfo = priceId ? PLAN_PRICE_MAP[priceId] : null;
        if (planInfo && subscription.status === "active") {
          await subscriptionRepo.activateSubscription(userId, {
            plan: planInfo.plan,
            stripeSubscriptionId: subscription.id,
            stripePriceId: priceId,
            aiCredits: planInfo.credits,
            billingCycleStart: new Date(),
          });
          const jobCredits = JOB_AI_CREDITS_PER_WEEK[planInfo.plan] || 0;
          if (jobCredits > 0) {
            await subscriptionRepo.resetJobCredits(userId, jobCredits);
          }
          console.log(`[stripe/webhook] ✅ Plan changed to ${planInfo.plan} for user ${userId}`);
        }
        break;
      }

      /* ─── Subscription deleted → cancel ─────────────────────── */
      case "customer.subscription.deleted": {
        const subscription = event.data.object as any;
        let userId = subscription.metadata?.userId;

        if (!userId) {
          const user = await subscriptionRepo.getByStripeSubscriptionId(subscription.id);
          if (!user) {
            console.warn("[stripe/webhook] subscription.deleted — user not found for sub:", subscription.id);
            break;
          }
          userId = user.id;
        }

        await subscriptionRepo.updateStatus(userId, "canceled");
        console.log(`[stripe/webhook] ✅ Canceled subscription for user ${userId}`);
        break;
      }

      /* ─── Invoice payment failed → flag past_due ────────────── */
      case "invoice.payment_failed": {
        const invoice = event.data.object as any;
        const subscriptionId = invoice.subscription as string;

        if (!subscriptionId) break;

        const user = await subscriptionRepo.getByStripeSubscriptionId(subscriptionId);
        if (!user) {
          console.warn("[stripe/webhook] invoice.payment_failed — user not found for sub:", subscriptionId);
          break;
        }

        // Stripe will also send subscription.updated with status=past_due,
        // but we handle it here too for faster UX feedback
        await subscriptionRepo.updateStatus(user.id, "past_due");
        console.log(`[stripe/webhook] ⚠️ Payment failed for user ${user.id} — status → past_due`);
        break;
      }

      default:
        console.log(`[stripe/webhook] Unhandled event: ${event.type}`);
    }
  } catch (err: any) {
    // Transient errors (DB down, network) → return 500 so Stripe retries
    console.error(`[stripe/webhook] ❌ Error handling ${event.type}:`, err.message, err.stack);
    // Clear the idempotency marker so Stripe's retry can be processed.
    try {
      await getKV().del(`stripe:webhook:${event.id}`);
    } catch { /* best-effort */ }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
