/*
 * Environment Validation for the public web app.
 */

// Public site URL now resolves from the shared single source of truth.
// Re-exported here so existing `@/lib/env` importers keep working.
export { getSiteUrl } from "@career-builder/shared/env";

interface EnvVar {
  name: string;
  required: boolean;
  description: string;
}

const WEB_ENV_VARS: EnvVar[] = [
  { name: "DATABASE_URL",           required: true,  description: "Prisma database connection URL" },
  { name: "TENANT_ID",             required: true,  description: "Default tenant identifier" },
  { name: "NEXT_PUBLIC_SITE_URL",  required: false, description: "Public URL of web app" },
];

export function validateEnv() {
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const v of WEB_ENV_VARS) {
    const value = process.env[v.name];
    if (!value || value.trim() === "") {
      if (v.required) {
        missing.push(`  ✗ ${v.name} — ${v.description}`);
      } else {
        warnings.push(`  ⚠ ${v.name} — ${v.description} (optional)`);
      }
    }
  }

  if (warnings.length > 0 && process.env.NODE_ENV !== "production") {
    console.warn(`\n[env] Optional environment variables not set:\n${warnings.join("\n")}\n`);
  }

  if (missing.length > 0) {
    const msg = `\n❌ Missing required environment variables:\n${missing.join("\n")}\n`;
    if (process.env.NODE_ENV === "production") {
      throw new Error(msg);
    } else {
      console.error(msg);
    }
  }
}

