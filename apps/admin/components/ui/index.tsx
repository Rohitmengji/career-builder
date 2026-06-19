/*
 * Re-export of the shared UI primitives (@career-builder/ui).
 *
 * The source of truth lives in packages/ui so web and admin share one
 * implementation. This file is kept so existing `@/components/ui` imports
 * across the app continue to resolve unchanged.
 */
export * from "@career-builder/ui";
