/*
 * Feature Flags — lightweight, zero-cost runtime flags.
 *
 * Supports:
 *   - Environment-based flags (FEATURE_FLAG_xxx env vars)
 *   - Deploy-environment scoping (dev/preview/prod)
 *   - Default values for safety
 *   - TypeScript-safe flag names
 *
 * Usage:
 *   import { isEnabled, FLAGS } from "@/lib/feature-flags";
 *
 *   if (isEnabled("ai_site_generator")) { ... }
 *   if (isEnabled("stripe_billing")) { ... }
 */

type DeployEnv = "development" | "preview" | "production";

function getDeployEnv(): DeployEnv {
  if (process.env.VERCEL_ENV === "production") return "production";
  if (process.env.VERCEL_ENV === "preview") return "preview";
  if (process.env.NODE_ENV === "production") return "production";
  return "development";
}

/* ================================================================== */
/*  Flag definitions                                                   */
/* ================================================================== */

interface FlagDef {
  /** Default value if no env var is set */
  default: boolean;
  /** Override per deploy environment */
  envOverrides?: Partial<Record<DeployEnv, boolean>>;
  /** Description for documentation */
  description: string;
}

/**
 * All feature flags. Add new flags here.
 * Environment variable: FEATURE_FLAG_{UPPER_SNAKE_NAME}=true|false
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
} satisfies Record<string, FlagDef>;

export type FeatureFlag = keyof typeof FLAG_DEFINITIONS;

/* ================================================================== */
/*  Runtime evaluation                                                 */
/* ================================================================== */

/**
 * Check if a feature flag is enabled.
 *
 * Resolution order:
 *   1. FEATURE_FLAG_{NAME} env var (explicit override)
 *   2. Deploy environment override
 *   3. Default value
 */
export function isEnabled(flag: FeatureFlag): boolean {
  const def = FLAG_DEFINITIONS[flag] as FlagDef;
  if (!def) return false;

  // 1. Check env var override
  const envName = `FEATURE_FLAG_${flag.toUpperCase()}`;
  const envVal = process.env[envName];
  if (envVal !== undefined) {
    return envVal === "true" || envVal === "1";
  }

  // 2. Check deploy environment override
  const env = getDeployEnv();
  if (def.envOverrides && env in def.envOverrides) {
    return def.envOverrides[env]!;
  }

  // 3. Default
  return def.default;
}

/**
 * Get all flags and their current values (for admin dashboard).
 */
export function getAllFlags(): Record<FeatureFlag, { enabled: boolean; description: string }> {
  const result: Record<string, { enabled: boolean; description: string }> = {};
  for (const [name, def] of Object.entries(FLAG_DEFINITIONS)) {
    result[name] = {
      enabled: isEnabled(name as FeatureFlag),
      description: def.description,
    };
  }
  return result as Record<FeatureFlag, { enabled: boolean; description: string }>;
}

/** Convenience exports for common checks */
export const FLAGS = {
  get AI() { return isEnabled("ai_content_generation"); },
  get STRIPE() { return isEnabled("stripe_billing"); },
  get GEO_PRICING() { return isEnabled("geo_pricing"); },
  get DEV_TOOLS() { return isEnabled("dev_plan_switcher"); },
} as const;
