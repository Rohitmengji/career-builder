/*
 * @career-builder/database — main entry point.
 *
 * Re-exports the Prisma client, repositories, and domain types
 * so consumers only need: import { prisma, jobRepo } from "@career-builder/database"
 */

export { prisma } from "./client";

export {
  tenantRepo,
  userRepo,
  jobRepo,
  applicationRepo,
  pageRepo,
  analyticsRepo,
  auditRepo,
  webhookRepo,
  subscriptionRepo,
} from "./repositories";

// Re-export all domain types and constants
export * from "./types";