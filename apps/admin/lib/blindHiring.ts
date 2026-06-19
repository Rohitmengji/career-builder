/*
 * Server helper: resolve the effective blind-hiring config for a tenant.
 * Combines the GLOBAL kill-switch flag (blind_hiring) with the per-tenant
 * Tenant.settings.blindHiring config. Default-safe: any failure → disabled.
 */

import { tenantRepo } from "@career-builder/database";
import { isEnabled } from "@career-builder/shared/feature-flags";
import { parseBlindHiring, DEFAULT_BLIND_HIRING, type BlindHiringConfig } from "@career-builder/shared/blind-hiring";

export async function getBlindHiringConfig(tenantId: string): Promise<BlindHiringConfig> {
  // Global kill switch — if off, redaction is disabled platform-wide.
  if (!isEnabled("blind_hiring")) return { ...DEFAULT_BLIND_HIRING };
  try {
    const tenant = await tenantRepo.findById(tenantId);
    return parseBlindHiring((tenant as { settings?: unknown } | null)?.settings);
  } catch {
    return { ...DEFAULT_BLIND_HIRING };
  }
}

export { redactApplicant, redactApplicants } from "@career-builder/shared/blind-hiring";
