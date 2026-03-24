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
   *  Wrapped with retry for SQLite BUSY errors. */
  async decrementCredit(userId: string): Promise<boolean> {
    // Atomic: only decrements if plan != free, status = active, credits > 0
    const result = await withDbRetry(() => prisma.user.updateMany({
      where: {
        id: userId,
        plan: { not: "free" },
        subscriptionStatus: "active",
        aiCredits: { gt: 0 },
      },
      data: { aiCredits: { decrement: 1 } },
    }));
    return result.count > 0;
  },

  /** Reset credits for a new billing cycle */
  async resetCredits(userId: string, credits: number) {
    const resetAt = new Date();
    resetAt.setMonth(resetAt.getMonth() + 1);

    return withDbRetry(() => prisma.user.update({
      where: { id: userId },
      data: {
        aiCredits: credits,
        aiCreditsResetAt: resetAt,
      },
    }));
  },

  /** Check if user can use AI (server-side enforced) */
  async canUseAi(userId: string): Promise<{ allowed: boolean; reason?: string; credits: number }> {
    const sub = await this.getByUserId(userId);
    if (!sub) return { allowed: false, reason: "User not found", credits: 0 };
    if (sub.plan === "free") return { allowed: false, reason: "Upgrade to Pro to use AI", credits: 0 };
    if (sub.subscriptionStatus !== "active") return { allowed: false, reason: "Subscription not active", credits: sub.aiCredits };
    if (sub.aiCredits <= 0) return { allowed: false, reason: "No AI credits remaining", credits: 0 };
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
    return result.count > 0;
  },

  /** Initialize or reset weekly job AI credits */
  async resetJobCredits(userId: string, credits: number) {
    const resetAt = new Date();
    resetAt.setDate(resetAt.getDate() + 7);

    return withDbRetry(() => prisma.user.update({
      where: { id: userId },
      data: {
        jobAiCredits: credits,
        jobAiCreditsResetAt: resetAt,
      },
    }));
  },
};
