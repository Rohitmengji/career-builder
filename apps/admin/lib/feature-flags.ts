/*
 * Feature flags for the admin app.
 *
 * The engine now lives in @career-builder/shared/feature-flags so web and
 * admin share one flag registry. This file re-exports it so existing
 * `@/lib/feature-flags` imports keep working.
 *
 * Usage:
 *   import { isEnabled, FLAGS } from "@/lib/feature-flags";
 *   if (isEnabled("ai_site_generator")) { ... }
 */
export * from "@career-builder/shared/feature-flags";
