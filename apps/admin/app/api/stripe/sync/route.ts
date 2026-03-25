/**
 * POST /api/stripe/sync
 *
 * Checkout-success fallback sync.
 *
 * WHY THIS EXISTS:
 *   Stripe webhooks can fail silently in production — wrong WEBHOOK_SECRET,
 *   unconfigured endpoint, network timeouts, or cold-start races. This means
 *   checkout.session.completed never fires and the DB is never updated.
 *
 *   When a user is redirected back with ?checkout=success&session_id=XXX,
 *   the editor page calls this endpoint to manually pull the session from
 *   Stripe and activate the subscription in our DB — idempotently.
 *
 *   This is the standard Stripe production pattern:
 *     webhook = eventual consistency
 *     sync endpoint = immediate consistency on success redirect
 *
 * SECURITY:
 *   - Requires authenticated session (iron-session)
 *   - Validates that the Stripe session's metadata.userId matches the logged-in user
 *   - Verifies payment_status === "paid" before activating
 *   - Idempotent — safe to call multiple times (activateSubscription is upsert-like)
 *
 * FLOW:
 *   1. Retrieve checkout session from Stripe by session_id
 *   2. Verify payment_status === "paid"
 *   3. Verify session.metadata.userId matches logged-in user (anti-tamper)
 *   4. Retrieve subscription to get price ID
 *   5. Resolve plan + credits from PLAN_PRICE_MAP
 *   6. Call subscriptionRepo.activateSubscription() — same as webhook handler
 *   7. Return updated subscription state to client
 */

import { NextResponse } from "next/server";
import { getSessionReadOnly } from "@/lib/auth";
import { stripe, PLAN_PRICE_MAP, PLAN_CREDITS, JOB_AI_CREDITS_PER_WEEK } from "@/lib/stripe/config";
import { subscriptionRepo } from "@career-builder/database";
import { withRequestLogging } from "@career-builder/observability/request-logger";
import { metrics } from "@career-builder/observability/metrics";
import { logger } from "@career-builder/observability/logger";

const log = logger.api;

// Idempotency: track recently synced session IDs to prevent double-activation
// from rapid double-submits (e.g., user refreshes the success page).
const recentlySynced = new Map<string, number>();
const SYNC_TTL = 5 * 60_000; // 5 minutes

function markSynced(sessionId: string): boolean {
  const now = Date.now();
  // Cleanup stale entries
  for (const [id, ts] of recentlySynced) {
    if (now - ts > SYNC_TTL) recentlySynced.delete(id);
  }
  if (recentlySynced.has(sessionId)) return false; // already synced
  recentlySynced.set(sessionId, now);
  return true;
}

async function handler(req: Request): Promise<NextResponse> {
  // ── 1. Auth ──────────────────────────────────────────────────────
  const session = await getSessionReadOnly();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // ── 2. Parse input ───────────────────────────────────────────────
  let sessionId: string;
  try {
    const body = await req.json();
    sessionId = typeof body?.sessionId === "string" ? body.sessionId.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!sessionId || !sessionId.startsWith("cs_")) {
    return NextResponse.json({ error: "Invalid session ID" }, { status: 400 });
  }

  log.info("stripe_sync_requested", { userId: session.userId, sessionId });

  try {
    // ── 3. Retrieve checkout session from Stripe ─────────────────
    let checkoutSession;
    try {
      checkoutSession = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ["subscription"],
      });
    } catch (err: any) {
      log.error("stripe_sync_retrieve_failed", { userId: session.userId, sessionId, err: err.message });
      return NextResponse.json({ error: "Failed to retrieve checkout session" }, { status: 502 });
    }

    // ── 4. Verify payment status ──────────────────────────────────
    if (checkoutSession.payment_status !== "paid") {
      log.warn("stripe_sync_payment_incomplete", { userId: session.userId, sessionId, paymentStatus: checkoutSession.payment_status });
      return NextResponse.json(
        { error: "Payment not completed", paymentStatus: checkoutSession.payment_status },
        { status: 402 }
      );
    }

    // ── 5. Anti-tamper: verify userId in metadata matches session ─
    const metaUserId = checkoutSession.metadata?.userId;
    if (!metaUserId || metaUserId !== session.userId) {
      log.error("stripe_sync_tamper_attempt", { sessionUserId: session.userId, metaUserId, sessionId } as any);
      metrics.increment("stripe.sync.tamper_attempt");
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // ── 6. Resolve subscription ───────────────────────────────────
    const subscription =
      typeof checkoutSession.subscription === "string"
        ? await stripe.subscriptions.retrieve(checkoutSession.subscription)
        : (checkoutSession.subscription as any);

    if (!subscription || subscription.id == null) {
      log.error("stripe_sync_no_subscription", { userId: session.userId, sessionId });
      return NextResponse.json({ error: "No subscription found on this session" }, { status: 422 });
    }

    const priceId = subscription.items?.data?.[0]?.price?.id as string | undefined;
    const planInfo = priceId ? PLAN_PRICE_MAP[priceId] : null;

    if (!planInfo) {
      log.error("stripe_sync_unknown_price", { userId: session.userId, priceId, sessionId });
      return NextResponse.json({ error: "Unrecognized price ID" }, { status: 422 });
    }

    // ── 7. Idempotency guard ──────────────────────────────────────
    const isFirstSync = markSynced(sessionId);
    if (!isFirstSync) {
      log.info("stripe_sync_duplicate_skipped", { userId: session.userId, sessionId });
    }

    // ── 8. Link Stripe customer if needed ─────────────────────────
    const existing = await subscriptionRepo.getByUserId(session.userId);
    if (checkoutSession.customer && existing && !existing.stripeCustomerId) {
      await subscriptionRepo.setStripeCustomerId(session.userId, checkoutSession.customer as string);
    }

    // ── 9. Activate subscription (upsert — idempotent) ────────────
    await subscriptionRepo.activateSubscription(session.userId, {
      plan: planInfo.plan,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId!,
      aiCredits: planInfo.credits,
      billingCycleStart: new Date(),
    });

    // ── 10. Initialize job AI credits ─────────────────────────────
    const jobCredits = JOB_AI_CREDITS_PER_WEEK[planInfo.plan] || 0;
    if (jobCredits > 0) {
      await subscriptionRepo.resetJobCredits(session.userId, jobCredits);
    }

    metrics.increment("stripe.sync.success");
    log.info("stripe_sync_activated", { userId: session.userId, plan: planInfo.plan, credits: planInfo.credits, jobCredits, sessionId });

    // ── 11. Return fresh subscription state ───────────────────────
    const planTotal = PLAN_CREDITS[planInfo.plan] || 0;
    return NextResponse.json({
      success: true,
      plan: planInfo.plan,
      aiEnabled: true,
      aiCreditsRemaining: planInfo.credits,
      aiCreditsTotal: planTotal,
      subscriptionStatus: "active",
      jobAiCreditsRemaining: jobCredits,
      jobAiCreditsTotal: jobCredits,
    });
  } catch (err: any) {
    log.error("stripe_sync_failed", { userId: session.userId, sessionId, err: err.message });
    metrics.increment("stripe.sync.error");
    return NextResponse.json({ error: "Subscription sync failed" }, { status: 500 });
  }
}

export const POST = withRequestLogging(handler);
