/*
 * @career-builder/shared/feature-flags — runtime feature flags for ALL apps.
 *
 * Resolution order (highest priority first):
 *   1. Per-tenant override   — Tenant.settings.featureFlags (passed in by caller)
 *   2. Env var               — FEATURE_FLAG_{UPPER_SNAKE_NAME}=true|false
 *   3. Deploy-env override    — per development/preview/production
 *   4. Default
 *
 * Platform-global flags (e.g. multi_tenant_web) are read WITHOUT tenant
 * overrides — you can't know the tenant before multi-tenancy is resolved.
 * Per-tenant flags pass the tenant's parsed flag map as the second arg.
 *
 * The engine is pure (no DB): callers that want per-tenant gating pass the
 * already-loaded Tenant.settings.featureFlags object.
 */

import { getDeployEnv, type DeployEnv } from "./env";

interface FlagDef {
  /** Default value if nothing else matches. */
  default: boolean;
  /** Override per deploy environment. */
  envOverrides?: Partial<Record<DeployEnv, boolean>>;
  /** Human-readable description (admin dashboard / docs). */
  description: string;
}

/**
 * All feature flags. Env var form: FEATURE_FLAG_{UPPER_SNAKE_NAME}=true|false
 */
const FLAG_DEFINITIONS = {
  ai_content_generation: {
    default: true,
    description: "AI-powered content generation for blocks and pages",
  },
  ai_site_generator: {
    default: true,
    description: "Full site generation with AI",
  },
  stripe_billing: {
    default: true,
    description: "Stripe subscription billing",
  },
  dev_plan_switcher: {
    default: true,
    envOverrides: { production: false },
    description: "Dev tool for switching subscription plans (never in prod)",
  },
  geo_pricing: {
    default: true,
    description: "Region-based pricing display",
  },
  live_preview: {
    default: true,
    description: "SSE-based live preview sync between editor and web",
  },
  job_applications: {
    default: true,
    description: "Job application submission and pipeline management",
  },
  audit_logging: {
    default: true,
    description: "Action audit logging for compliance",
  },
  multi_tenant_web: {
    default: false,
    description:
      "Resolve the web tenant per-request from the host (subdomain / custom " +
      "domain) instead of the TENANT_ID env pin. Platform-global; off by default.",
  },
  blind_hiring: {
    default: true,
    description:
      "Global kill switch for blind-hiring redaction. Per-tenant enablement " +
      "lives in Tenant.settings.blindHiring; flip this off to disable the feature " +
      "platform-wide if redaction ever misbehaves (a redaction leak is Sev1).",
  },
} satisfies Record<string, FlagDef>;

export type FeatureFlag = keyof typeof FLAG_DEFINITIONS;

/** A per-tenant override map (subset of flags), e.g. from Tenant.settings.featureFlags. */
export type TenantFlagOverrides = Partial<Record<FeatureFlag, boolean>>;

/**
 * Check if a feature flag is enabled.
 *
 * @param flag             the flag name
 * @param tenantOverrides  optional per-tenant overrides (highest priority).
 *                         Omit for platform-global flags like multi_tenant_web.
 */
export function isEnabled(flag: FeatureFlag, tenantOverrides?: TenantFlagOverrides): boolean {
  const def = FLAG_DEFINITIONS[flag] as FlagDef | undefined;
  if (!def) return false;

  // 1. Per-tenant override
  if (tenantOverrides && typeof tenantOverrides[flag] === "boolean") {
    return tenantOverrides[flag]!;
  }

  // 2. Env var override
  const envVal = process.env[`FEATURE_FLAG_${flag.toUpperCase()}`];
  if (envVal !== undefined) {
    return envVal === "true" || envVal === "1";
  }

  // 3. Deploy environment override
  const env = getDeployEnv();
  if (def.envOverrides && env in def.envOverrides) {
    return def.envOverrides[env]!;
  }

  // 4. Default
  return def.default;
}

/** All flags with their current (global) values — for the admin dashboard. */
export function getAllFlags(): Record<FeatureFlag, { enabled: boolean; description: string }> {
  const result: Record<string, { enabled: boolean; description: string }> = {};
  for (const [name, def] of Object.entries(FLAG_DEFINITIONS)) {
    result[name] = { enabled: isEnabled(name as FeatureFlag), description: def.description };
  }
  return result as Record<FeatureFlag, { enabled: boolean; description: string }>;
}

/** Convenience getters for common global checks. */
export const FLAGS = {
  get AI() { return isEnabled("ai_content_generation"); },
  get STRIPE() { return isEnabled("stripe_billing"); },
  get GEO_PRICING() { return isEnabled("geo_pricing"); },
  get DEV_TOOLS() { return isEnabled("dev_plan_switcher"); },
  get MULTI_TENANT_WEB() { return isEnabled("multi_tenant_web"); },
} as const;
