/**
 * POST /api/dev/set-plan
 *
 * Dev-only endpoint to switch subscription plan for testing.
 * Directly updates the DB — bypasses Stripe entirely.
 *
 * Body: { plan: "free" | "pro" | "enterprise" }
 *
 * NEVER available in production.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@career-builder/database";

const PLAN_CREDITS: Record<string, number> = {
  free: 0,
  pro: 1000,
  enterprise: 5000,
};

const JOB_AI_CREDITS_PER_WEEK: Record<string, number> = {
  free: 0,
  pro: 25,
  enterprise: 25,
};

const VALID_PLANS = new Set(["free", "pro", "enterprise"]);

export async function POST(req: NextRequest) {
  // Hard block in production — also block on Vercel production deploys
  if (process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json();
  const plan = body.plan as string;

  if (!VALID_PLANS.has(plan)) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const credits = PLAN_CREDITS[plan] ?? 0;

  // Get current user state to preserve credits when staying on the same tier
  const currentUser = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { plan: true, aiCredits: true, jobAiCredits: true },
  });

  // Only reset credits when:
  //  - Upgrading (new plan has more credits than current)
  //  - Switching to free (always 0)
  //  - First time activating a plan (current credits are 0)
  const currentCredits = currentUser?.aiCredits ?? 0;
  const currentPlan = currentUser?.plan ?? "free";
  const isUpgrade = credits > (PLAN_CREDITS[currentPlan] ?? 0);
  const isSameTier = plan === currentPlan;
  const shouldResetCredits = plan === "free" || isUpgrade || (!isSameTier && currentCredits === 0);
  const finalCredits = shouldResetCredits ? credits : Math.min(currentCredits, credits);

  // Job AI credits: 25/week for paid plans, 0 for free
  const jobCreditsForPlan = JOB_AI_CREDITS_PER_WEEK[plan] ?? 0;
  const currentJobCredits = currentUser?.jobAiCredits ?? 0;
  // Reset job credits when switching to free or activating a new paid plan
  const shouldResetJobCredits = plan === "free" || isUpgrade || currentJobCredits === 0;
  const finalJobCredits = shouldResetJobCredits ? jobCreditsForPlan : Math.min(currentJobCredits, jobCreditsForPlan);

  // Directly update the DB
  await prisma.user.update({
    where: { id: session.userId },
    data: {
      plan,
      subscriptionStatus: plan === "free" ? "none" : "active",
      aiCredits: finalCredits,
      aiCreditsResetAt: plan === "free" ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      billingCycleStart: plan === "free" ? null : new Date(),
      jobAiCredits: finalJobCredits,
      jobAiCreditsResetAt: plan === "free" ? null : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      // Don't touch stripeCustomerId/stripeSubscriptionId — those are real Stripe data
    },
  });

  console.log(`[dev] Plan switched to "${plan}" for user ${session.userId} (credits: ${finalCredits}, jobCredits: ${finalJobCredits})`);

  return NextResponse.json({
    success: true,
    plan,
    credits: finalCredits,
    jobCredits: finalJobCredits,
    subscriptionStatus: plan === "free" ? "none" : "active",
  });
}
