/**
 * GET /api/subscription
 *
 * Returns current user's subscription state (server-side truth).
 * Used by the client-side useSubscription hook.
 */

import { NextResponse } from "next/server";
import { getSessionReadOnly } from "@/lib/auth";
import { subscriptionRepo } from "@career-builder/database";
import { PLAN_CREDITS, JOB_AI_CREDITS_PER_WEEK } from "@/lib/stripe/config";

export async function GET() {
  try {
    const session = await getSessionReadOnly();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const sub = await subscriptionRepo.getByUserId(session.userId);

    if (!sub) {
      return NextResponse.json({
        plan: "free",
        aiEnabled: false,
        aiCreditsRemaining: 0,
        aiCreditsTotal: 0,
        subscriptionStatus: "none",
        hasStripeCustomer: false,
        billingCycleStart: null,
        aiCreditsResetAt: null,
        jobAiCreditsRemaining: 0,
        jobAiCreditsTotal: 0,
        jobAiCreditsResetAt: null,
      });
    }

    const isActive = sub.subscriptionStatus === "active";
    const aiEnabled = sub.plan !== "free" && isActive;

    // Auto-reset weekly job credits if the reset time has passed
    let jobCredits = sub.jobAiCredits;
    let jobResetAt = sub.jobAiCreditsResetAt;
    const weeklyJobLimit = JOB_AI_CREDITS_PER_WEEK[sub.plan] || 0;
    if (aiEnabled && jobResetAt && new Date() >= jobResetAt) {
      jobCredits = weeklyJobLimit;
      const nextReset = new Date();
      nextReset.setDate(nextReset.getDate() + 7);
      jobResetAt = nextReset;
      // Update in background — don't block the response
      subscriptionRepo.resetJobCredits(session.userId, weeklyJobLimit).catch(() => {});
    }

    return NextResponse.json({
      plan: sub.plan,
      aiEnabled,
      aiCreditsRemaining: sub.aiCredits,
      aiCreditsTotal: PLAN_CREDITS[sub.plan] || 0,
      subscriptionStatus: sub.subscriptionStatus,
      hasStripeCustomer: !!sub.stripeCustomerId,
      billingCycleStart: sub.billingCycleStart?.toISOString() || null,
      aiCreditsResetAt: sub.aiCreditsResetAt?.toISOString() || null,
      jobAiCreditsRemaining: jobCredits,
      jobAiCreditsTotal: weeklyJobLimit,
      jobAiCreditsResetAt: jobResetAt?.toISOString() || null,
    });
  } catch (err: any) {
    console.error("[subscription] Error:", err.message, err.stack);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
