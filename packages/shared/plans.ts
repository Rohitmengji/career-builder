/*
 * @career-builder/shared/plans — plan-based feature gating.
 *
 * Single source of truth shared by the admin API (which gates writes) AND the
 * request resolver (which must stop routing a paid feature after a downgrade).
 * Enforcing at routing time means a plan downgrade takes effect without a
 * separate cleanup job.
 */

export type Plan = "free" | "pro" | "enterprise";

/** Plans that may use custom domains. */
export const CUSTOM_DOMAIN_PLANS = ["pro", "enterprise"] as const;

export function planAllowsCustomDomain(plan: string | null | undefined): boolean {
  return CUSTOM_DOMAIN_PLANS.includes(String(plan) as (typeof CUSTOM_DOMAIN_PLANS)[number]);
}
