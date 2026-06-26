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
  ai_match_explanation: {
    default: false,
    envOverrides: { development: true },
    description:
      "Candidate-facing 'Right to Explanation' match preview on the job detail " +
      "page: paste your background, get an explainable, requirement-grounded fit " +
      "score (private to the candidate, never shared with the employer, not used " +
      "in selection). Off in prod by default — enable per-deploy/tenant once the " +
      "AI provider key is configured (AI brief: ship new AI features flag-gated).",
  },
  salary_benchmarks: {
    default: false,
    envOverrides: { development: true },
    description:
      "Candidate-facing 'Salary Truth' market pay context on the job detail page: " +
      "shows where a role's posted pay sits vs the market (and the market range " +
      "even when pay is hidden), computed from public posted ranges across tenants " +
      "with k-anonymity (>=5 jobs, >=2 tenants) + rounding (ADR-0002). Off by " +
      "default — only shows once enough comparable market data exists.",
  },
  responsiveness_badge: {
    default: false,
    envOverrides: { development: true },
    description:
      "Candidate-facing 'Employer Responsiveness' trust badge on the careers site: " +
      "the % of applicants (who applied >14 days ago) that received a response, " +
      "computed read-only from this tenant's own application statuses with a " +
      "minimum-sample guard (ADR-0003). Opt-in per tenant — a 'we don't ghost' " +
      "recruiting signal no other ATS exposes.",
  },
  ai_resume_insights: {
    default: false,
    envOverrides: { development: true },
    description:
      "Recruiter-facing structured résumé parsing: turns an applicant's extracted " +
      "résumé text into skills, titles, total experience, and education (AI, " +
      "fail-closed). Under Blind Hiring it returns skills/experience but never the " +
      "raw text or name — skills-first review. Off by default; needs the AI key.",
  },
  application_timeline: {
    default: false,
    envOverrides: { development: true },
    description:
      "Candidate-facing real status timeline on /applications: shows each " +
      "candidate-visible workflow event (status changes, later interviews/offers) " +
      "with timestamps, from the ApplicationEvent spine (ADR-0005). Replaces the " +
      "old simulated status block.",
  },
  interview_scheduling: {
    default: false,
    envOverrides: { development: true },
    description:
      "Interview scheduling (ADR-0006): recruiters schedule interviews (time, " +
      "interviewer, type, link) on an application; candidates see them, confirm, " +
      "and add to calendar (ICS). Emits candidate-visible timeline events + an " +
      "invitation email. Off by default.",
  },
  interview_scorecards: {
    default: false,
    envOverrides: { development: true },
    description:
      "Structured interview scorecards (ADR-0007): a per-job rubric of criteria; " +
      "each interviewer submits 1-5 scores + an overall recommendation; an " +
      "aggregated decision panel shows averages, recommendation distribution, and " +
      "a 'needs more feedback' flag. Internal-only (never candidate-visible); " +
      "respects Blind Hiring. Off by default.",
  },
  offer_management: {
    default: false,
    envOverrides: { development: true },
    description:
      "Offer management (ADR-0008): a first-class Offer entity with a full approval " +
      "workflow (draft → submit → approve [hiring_manager+] → send), candidate " +
      "accept/decline on the web app, lazy expiry, and timeline events. Recruiter " +
      "offer lists respect Blind Hiring; candidates see only their own offer. " +
      "Off by default.",
  },
  notifications: {
    default: false,
    envOverrides: { development: true },
    description:
      "In-app notification center (ADR-0009): candidate-visible workflow events " +
      "(status changes, interviews, offers) become candidate notifications; " +
      "recruiters get an 'offer pending approval' notification. Unread badge + " +
      "dropdown in the candidate header and the admin dashboard. Recipient-scoped " +
      "and tenant-isolated. Off by default.",
  },
  advanced_analytics: {
    default: false,
    envOverrides: { development: true },
    description:
      "Hiring-velocity analytics (ADR-0017): median time-to-first-response, " +
      "time-to-hire, and time-to-decision computed from the ApplicationEvent spine. " +
      "Off by default.",
  },
  ai_jd_bias_detection: {
    default: false,
    envOverrides: { development: true },
    description:
      "AI job-description bias check (ADR-0014, EU AI-Act §6 safeguard): flags " +
      "potentially exclusionary language (gendered/age/ableist) in the job editor " +
      "before publish. Advisory + non-blocking; fail-closed. Off by default.",
  },
  eeo_self_id: {
    default: false,
    envOverrides: { development: true },
    description:
      "Voluntary EEO self-identification (ADR-0013): candidates may optionally report " +
      "demographics for AGGREGATE reporting only. Architecturally isolated from the " +
      "hiring path (no recruiter/AI access); admin reports are small-cell + " +
      "complementary suppressed. Off by default.",
  },
  interview_feedback: {
    default: false,
    envOverrides: { development: true },
    description:
      "Candidate-visible interview feedback (ADR-0012): a recruiter can release an " +
      "ANONYMIZED scorecard summary (per-criterion averages + overall, no interviewer " +
      "identity / recommendation labels / comments) to the candidate, per application. " +
      "Off by default.",
  },
  data_export: {
    default: false,
    envOverrides: { development: true },
    description: "GDPR §15 data export (ADR-0011): a candidate can download all their own data (profile, applications, interviews, offers, consents) as JSON. Whitelisted — never internal recruiter data or EEO. Off by default.",
  },
  data_deletion: {
    default: false,
    envOverrides: { development: true },
    description: "GDPR §17 erasure (ADR-0011): a candidate can delete their account. Anonymize-in-place — PII is destroyed but non-identifying decision/audit records are retained; deferred under legal hold. Off by default.",
  },
  consent_capture: {
    default: false,
    envOverrides: { development: true },
    description: "Consent ledger (ADR-0011): records privacy-policy + data-processing consent (versioned, append-only) at apply time, and lets candidates withdraw marketing consent. Off by default.",
  },
  adverse_action_disclosure: {
    default: false,
    envOverrides: { development: true },
    description:
      "Rejection-reason disclosure (ADR-0010): recruiters record a structured " +
      "adverse-action reason on reject (category + internal notes); when this flag " +
      "is on AND the recruiter opts in per-record, the candidate sees a curated " +
      "'why we didn't move forward' message (never the internal notes). Off by default.",
  },
  custom_pipeline_stages: {
    default: false,
    envOverrides: { development: true },
    description:
      "Customizable pipeline stages (ADR-0015): per-tenant ordered stages with a " +
      "semantic `kind` so renaming/inserting stages doesn't break offers status-sync, " +
      "responsiveness, or analytics. When OFF the system uses the fixed 6 statuses " +
      "exactly as before. Unblocks the drag-drop kanban board. Off by default.",
  },
  application_tags: {
    default: false,
    envOverrides: { development: true },
    description:
      "Application tags (ADR-0016): a per-tenant tag library recruiters use to " +
      "annotate/segment candidates (e.g. 'referral', 'strong-fit') and filter the " +
      "pipeline by tag. Internal-only (never candidate-visible); colours come from a " +
      "closed palette. Off by default.",
  },
  saved_views: {
    default: false,
    envOverrides: { development: true },
    description:
      "Saved views (ADR-0016): named, PRIVATE filter presets on the applications " +
      "list (status / job / department / search / tags), scoped per-user. Off by default.",
  },
  talent_pool: {
    default: false,
    envOverrides: { development: true },
    description:
      "Talent pool / CRM (ADR-0018): per-tenant named buckets of past candidates to " +
      "keep warm, with consent-gated re-engagement email (only candidates who granted " +
      "marketing consent, ADR-0011). Blind-hiring-safe (member identity redacted in the " +
      "UI; re-engage sends server-side). Off by default.",
  },
  req_approval: {
    default: false,
    envOverrides: { development: true },
    description:
      "Requisition approval (ADR-0020): a job may be PUBLISHED only once its requisition " +
      "is approved. State machine mirrors offers (draft → pending_approval → approved | " +
      "rejected); approve/reject is manager+. When OFF, publishing is unchanged. Off by default.",
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
