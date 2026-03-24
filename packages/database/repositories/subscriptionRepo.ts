/**
 * Subscription Repository — server-side subscription state management.
 *
 * ALL subscription checks go through here. Never trust client state.
 */

import { prisma } from "../client";
import { withDbRetry } from "../resilience";

export interface SubscriptionRecord {
  plan: string;
  subscriptionStatus: string;
  aiCredits: number;
  aiCreditsResetAt: Date | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  billingCycleStart: Date | null;
  jobAiCredits: number;
  jobAiCreditsResetAt: Date | null;
}

export const subscriptionRepo = {
  /** Get subscription state for a user */
  async getByUserId(userId: string): Promise<SubscriptionRecord | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        plan: true,
        subscriptionStatus: true,
        aiCredits: true,
        aiCreditsResetAt: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        stripePriceId: true,
        billingCycleStart: true,
        jobAiCredits: true,
        jobAiCreditsResetAt: true,
      },
    });
    return user;
  },

  /** Get user by Stripe customer ID */
  async getByStripeCustomerId(customerId: string) {
    return prisma.user.findUnique({
      where: { stripeCustomerId: customerId },
      select: {
        id: true,
        email: true,
        plan: true,
        subscriptionStatus: true,
        aiCredits: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        stripePriceId: true,
      },
    });
  },

  /** Get user by Stripe subscription ID */
  async getByStripeSubscriptionId(subscriptionId: string) {
    return prisma.user.findUnique({
      where: { stripeSubscriptionId: subscriptionId },
      select: {
        id: true,
        email: true,
        plan: true,
        subscriptionStatus: true,
        aiCredits: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        stripePriceId: true,
      },
    });
  },

  /** Set Stripe customer ID on user. Returns null if user not found. */
  async setStripeCustomerId(userId: string, customerId: string) {
    try {
      return await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customerId },
      });
    } catch (err: any) {
      if (err.code === "P2025") {
        console.error(`[subscriptionRepo] setStripeCustomerId — user ${userId} not found`);
        return null;
      }
      throw err;
    }
  },

  /** Activate a subscription after successful payment.
   *  Returns null if user doesn't exist. */
  async activateSubscription(
    userId: string,
    data: {
      plan: string;
      stripeSubscriptionId: string;
      stripePriceId: string;
      aiCredits: number;
      billingCycleStart: Date;
    },
  ) {
    const resetAt = new Date(data.billingCycleStart);
    resetAt.setMonth(resetAt.getMonth() + 1);

    try {
      return await withDbRetry(() => prisma.user.update({
        where: { id: userId },
        data: {
          plan: data.plan,
          subscriptionStatus: "active",
          stripeSubscriptionId: data.stripeSubscriptionId,
          stripePriceId: data.stripePriceId,
          aiCredits: data.aiCredits,
          aiCreditsResetAt: resetAt,
          billingCycleStart: data.billingCycleStart,
        },
      }));
    } catch (err: any) {
      // P2025 = record not found
      if (err.code === "P2025") {
        console.error(`[subscriptionRepo] activateSubscription — user ${userId} not found`);
        return null;
      }
      throw err;
    }
  },

  /** Update subscription status (e.g., past_due, canceled).
   *  On cancel: resets plan to free, clears credits and Stripe IDs. */
  async updateStatus(userId: string, status: string) {
    const data: any = { subscriptionStatus: status };
    if (status === "canceled") {
      data.plan = "free";
      data.aiCredits = 0;
      data.jobAiCredits = 0;
      data.jobAiCreditsResetAt = null;
      data.stripeSubscriptionId = null;
      data.stripePriceId = null;
    }
    try {
      return await withDbRetry(() => prisma.user.update({ where: { id: userId }, data }));
    } catch (err: any) {
      if (err.code === "P2025") {
        console.error(`[subscriptionRepo] updateStatus — user ${userId} not found`);
        return null;
      }
      throw err;
    }
  },

  /** Decrement AI credits by 1. Returns false if no credits left.
   *  Uses atomic updateMany with conditions to prevent race conditions.
   *  Wrapped with retry for SQLite BUSY errors.
   *  CRITICAL: The WHERE clause (aiCredits > 0) makes this atomic —
   *  parallel requests cannot both succeed if only 1 credit remains. */
  async decrementCredit(userId: string): Promise<boolean> {
    const result = await withDbRetry(() => prisma.user.updateMany({
      where: {
        id: userId,
        plan: { not: "free" },
        subscriptionStatus: "active",
        aiCredits: { gt: 0 },
      },
      data: { aiCredits: { decrement: 1 } },
    }));
    const success = result.count > 0;
    if (success) {
      // Log credit usage for observability — fetch remaining credits
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { aiCredits: true } });
      console.log(`[credits] Decremented AI credit for user ${userId}. Remaining: ${user?.aiCredits ?? "unknown"}`);
    } else {
      console.warn(`[credits] Decrement BLOCKED for user ${userId} — no credits or inactive`);
    }
    return success;
  },

  /** Refund 1 AI credit (after failed AI call).
   *  Uses atomic increment with a hard-cap safety check to prevent
   *  credits from exceeding the plan limit. */
  async refundCredit(userId: string, planCreditLimit: number): Promise<void> {
    await withDbRetry(() => prisma.user.updateMany({
      where: {
        id: userId,
        plan: { not: "free" },
        // Safety: only refund if below the plan limit (prevents over-crediting)
        aiCredits: { lt: planCreditLimit },
      },
      data: { aiCredits: { increment: 1 } },
    }));
    console.log(`[credits] Refunded 1 AI credit to user ${userId} (cap: ${planCreditLimit})`);
  },

  /** Refund 1 job AI credit (after failed AI call).
   *  Uses atomic increment with hard-cap safety. */
  async refundJobCredit(userId: string, weeklyJobLimit: number): Promise<void> {
    await withDbRetry(() => prisma.user.updateMany({
      where: {
        id: userId,
        plan: { not: "free" },
        jobAiCredits: { lt: weeklyJobLimit },
      },
      data: { jobAiCredits: { increment: 1 } },
    }));
    console.log(`[credits] Refunded 1 job AI credit to user ${userId} (cap: ${weeklyJobLimit})`);
  },

  /** Enforce hard floor: if credits somehow went negative, clamp to 0.
   *  Called defensively — should never be needed with atomic decrements. */
  async clampNegativeCredits(userId: string): Promise<void> {
    await prisma.user.updateMany({
      where: { id: userId, aiCredits: { lt: 0 } },
      data: { aiCredits: 0 },
    });
    await prisma.user.updateMany({
      where: { id: userId, jobAiCredits: { lt: 0 } },
      data: { jobAiCredits: 0 },
    });
  },

  /** Reset credits for a new billing cycle */
  async resetCredits(userId: string, credits: number) {
    const resetAt = new Date();
    resetAt.setMonth(resetAt.getMonth() + 1);

    console.log(`[credits] Resetting AI credits for user ${userId} to ${credits}. Next reset: ${resetAt.toISOString()}`);
    return withDbRetry(() => prisma.user.update({
      where: { id: userId },
      data: {
        aiCredits: credits,
        aiCreditsResetAt: resetAt,
      },
    }));
  },

  /** Check if user can use AI (server-side enforced).
   *  Also handles monthly auto-reset if billing cycle has passed. */
  async canUseAi(userId: string): Promise<{ allowed: boolean; reason?: string; credits: number }> {
    const sub = await this.getByUserId(userId);
    if (!sub) return { allowed: false, reason: "User not found", credits: 0 };
    if (sub.plan === "free") return { allowed: false, reason: "Upgrade to Pro to use AI", credits: 0 };
    if (sub.subscriptionStatus !== "active") return { allowed: false, reason: "Subscription not active", credits: sub.aiCredits };

    // Auto-reset: if the monthly reset time has passed, reset credits
    // This catches cases where the Stripe webhook was missed
    if (sub.aiCreditsResetAt && new Date() >= sub.aiCreditsResetAt) {
      // Import plan limits dynamically to avoid circular dep — use known limits
      const PLAN_LIMITS: Record<string, number> = { pro: 500, enterprise: 2500 };
      const limit = PLAN_LIMITS[sub.plan] || 0;
      if (limit > 0) {
        const nextReset = new Date();
        nextReset.setMonth(nextReset.getMonth() + 1);
        await withDbRetry(() => prisma.user.update({
          where: { id: userId },
          data: { aiCredits: limit, aiCreditsResetAt: nextReset },
        }));
        console.log(`[credits] Auto-reset AI credits for user ${userId} to ${limit} (monthly cycle)`);
        return { allowed: true, credits: limit };
      }
    }

    if (sub.aiCredits <= 0) return { allowed: false, reason: "No AI credits remaining", credits: 0 };

    // Safety: if credits exceed plan limit (e.g., after plan limit reduction), clamp in DB
    const PLAN_LIMITS_CHECK: Record<string, number> = { pro: 500, enterprise: 2500 };
    const planMax = PLAN_LIMITS_CHECK[sub.plan] || 0;
    if (planMax > 0 && sub.aiCredits > planMax) {
      await withDbRetry(() => prisma.user.update({
        where: { id: userId },
        data: { aiCredits: planMax },
      }));
      console.log(`[credits] Clamped over-limit credits for user ${userId}: ${sub.aiCredits} → ${planMax}`);
      return { allowed: true, credits: planMax };
    }

    return { allowed: true, credits: sub.aiCredits };
  },

  /* ================================================================ */
  /*  Job AI Credits — separate weekly pool (25/week)                  */
  /* ================================================================ */

  /** Check if user can use Job AI (server-side enforced).
   *  Auto-resets weekly credits if the reset window has passed. */
  async canUseJobAi(userId: string, weeklyLimit: number): Promise<{ allowed: boolean; reason?: string; credits: number }> {
    const sub = await this.getByUserId(userId);
    if (!sub) return { allowed: false, reason: "User not found", credits: 0 };
    if (sub.plan === "free") return { allowed: false, reason: "Upgrade to Pro to use AI", credits: 0 };
    if (sub.subscriptionStatus !== "active") return { allowed: false, reason: "Subscription not active", credits: sub.jobAiCredits };

    // Auto-reset: if the weekly reset time has passed, reset credits
    if (sub.jobAiCreditsResetAt && new Date() >= sub.jobAiCreditsResetAt) {
      const nextReset = new Date();
      nextReset.setDate(nextReset.getDate() + 7);
      await prisma.user.update({
        where: { id: userId },
        data: { jobAiCredits: weeklyLimit, jobAiCreditsResetAt: nextReset },
      });
      return { allowed: true, credits: weeklyLimit };
    }

    if (sub.jobAiCredits <= 0) return { allowed: false, reason: "Weekly job AI credits exhausted (25/week). Resets soon.", credits: 0 };
    return { allowed: true, credits: sub.jobAiCredits };
  },

  /** Decrement job AI credit by 1. Returns false if no credits left.
   *  Atomic — uses updateMany with conditions to prevent race conditions.
   *  Wrapped with retry for SQLite BUSY errors. */
  async decrementJobCredit(userId: string): Promise<boolean> {
    const result = await withDbRetry(() => prisma.user.updateMany({
      where: {
        id: userId,
        plan: { not: "free" },
        subscriptionStatus: "active",
        jobAiCredits: { gt: 0 },
      },
      data: { jobAiCredits: { decrement: 1 } },
    }));
    const success = result.count > 0;
    if (success) {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { jobAiCredits: true } });
      console.log(`[credits] Decremented job AI credit for user ${userId}. Remaining: ${user?.jobAiCredits ?? "unknown"}`);
    } else {
      console.warn(`[credits] Job credit decrement BLOCKED for user ${userId} — no credits or inactive`);
    }
    return success;
  },

  /** Initialize or reset weekly job AI credits */
  async resetJobCredits(userId: string, credits: number) {
    const resetAt = new Date();
    resetAt.setDate(resetAt.getDate() + 7);

    console.log(`[credits] Resetting job AI credits for user ${userId} to ${credits}. Next reset: ${resetAt.toISOString()}`);
    return withDbRetry(() => prisma.user.update({
      where: { id: userId },
      data: {
        jobAiCredits: credits,
        jobAiCreditsResetAt: resetAt,
      },
    }));
  },
};
