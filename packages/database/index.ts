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
  pageVersionRepo,
  analyticsRepo,
  auditRepo,
  webhookRepo,
  subscriptionRepo,
  candidateRepo,
  domainRepo,
  normalizeHostname,
  DOMAIN_STATUSES,
  commentRepo,
  salaryBenchmarkRepo,
  eventRepo,
  interviewRepo,
  scorecardRepo,
  offerRepo,
  notificationRepo,
  adverseActionRepo,
  consentRepo,
  dataRightsRepo,
  anonymizedApplicationData,
  eeoRepo,
  stageRepo,
  tagRepo,
  savedViewRepo,
} from "./repositories";
export type {
  CreateDomainInput,
  DomainStatus,
  CreateCommentInput,
  ComparableSalaryQuery,
  ComparableSalaryRow,
  ApplicationFilters,
  ApplicationEventType,
  RecordEventInput,
  CandidateVisibleEvent,
  CreateInterviewInput,
  SubmitScorecardInput,
  ScorecardRatingInput,
  CreateOfferInput,
  OfferUpdateData,
  CreateNotificationInput,
  RecipientType,
  UpsertAdverseActionInput,
  RecordConsentInput,
  DeleteResult,
  RecordEeoInput,
  CreateStageInput,
  CreateTagInput,
  CreateSavedViewInput,
} from "./repositories";

// Re-export all domain types and constants
export * from "./types";