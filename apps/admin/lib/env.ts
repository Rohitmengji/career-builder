/*
 * Environment Validation — ensures all required env vars are set at build/startup.
 *
 * Import this in layout.tsx or a server component to fail fast if config is missing.
 * Soft warnings for optional vars, hard errors for required ones.
 */

interface EnvVar {
  name: string;
  /** true = always required, "production" = only required at runtime in production */
  required: boolean | "production";
  description: string;
}

/** Is this a production runtime (NOT a build step)? */
function isProductionRuntime(): boolean {
  // During `next build`, NEXT_PHASE is set — env is not fully available yet
  if (process.env.NEXT_PHASE === "phase-production-build") return false;
  return process.env.NODE_ENV === "production";
}

const ADMIN_ENV_VARS: EnvVar[] = [
  { name: "DATABASE_URL",             required: true,         description: "Prisma database connection URL" },
  { name: "TENANT_ID",               required: true,         description: "Default tenant identifier" },
  { name: "SESSION_SECRET",          required: "production", description: "32+ char secret for session encryption (REQUIRED in production)" },
  { name: "OPENAI_API_KEY",          required: false,        description: "OpenAI API key for AI features" },
  { name: "AI_MODEL",                required: false,        description: "AI model name (default: gpt-4o-mini)" },
  { name: "STRIPE_SECRET_KEY",       required: false,        description: "Stripe secret key for billing" },
  { name: "STRIPE_WEBHOOK_SECRET",   required: false,        description: "Stripe webhook signing secret" },
  { name: "STRIPE_PRO_PRICE_ID",     required: false,        description: "Stripe Pro plan price ID" },
  { name: "STRIPE_ENT_PRICE_ID",     required: false,        description: "Stripe Enterprise plan price ID" },
  { name: "NEXT_PUBLIC_APP_URL",     required: "production", description: "Public URL of admin app (REQUIRED in production)" },
  { name: "NEXT_PUBLIC_SITE_URL",    required: false,        description: "Public URL of web app (default: http://localhost:3000)" },
];

const WEB_ENV_VARS: EnvVar[] = [
  { name: "DATABASE_URL",             required: true,  description: "Prisma database connection URL" },
  { name: "TENANT_ID",               required: true,  description: "Default tenant identifier" },
  { name: "NEXT_PUBLIC_SITE_URL",    required: false, description: "Public URL of web app (default: http://localhost:3000)" },
];

export function validateEnv(app: "admin" | "web" = "admin") {
  const vars = app === "admin" ? ADMIN_ENV_VARS : WEB_ENV_VARS;
  const missing: string[] = [];
  const warnings: string[] = [];
  const isProdRuntime = isProductionRuntime();

  for (const v of vars) {
    const value = process.env[v.name];
    if (!value || value.trim() === "") {
      const isRequired = v.required === true || (v.required === "production" && isProdRuntime);
      if (isRequired) {
        missing.push(`  ✗ ${v.name} — ${v.description}`);
      } else {
        warnings.push(`  ⚠ ${v.name} — ${v.description} (optional, some features may be limited)`);
      }
    }
  }

  if (warnings.length > 0 && process.env.NODE_ENV !== "production") {
    console.warn(`\n[env] Optional environment variables not set:\n${warnings.join("\n")}\n`);
  }

  if (missing.length > 0) {
    const msg = `\n❌ Missing required environment variables:\n${missing.join("\n")}\n\nPlease set them in .env.local or your hosting provider's environment settings.\n`;
    if (isProdRuntime) {
      throw new Error(msg);
    } else {
      console.error(msg);
    }
  }
}

/** Get a URL with fallback — never returns hardcoded localhost in production */
export function getAppUrl(envVar: string, fallback: string): string {
  const val = process.env[envVar];
  if (val && val.trim()) return val.trim();

  // In production, don't fall back to localhost
  if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
    // Try to construct from Vercel auto-set vars
    if (process.env.VERCEL_URL) {
      return `https://${process.env.VERCEL_URL}`;
    }
  }

  return fallback;
}
