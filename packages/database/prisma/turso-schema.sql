-- ============================================================
-- GENERATED FILE — DO NOT EDIT BY HAND.
-- Source of truth: prisma/schema.prisma
-- Regenerate with:  npm run db:gen-turso-sql   (in packages/database)
-- Parity is enforced in CI via:  npm run db:verify-turso
-- push-turso.ts executes these statements (idempotently) against Turso.
-- ============================================================

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "theme" TEXT NOT NULL DEFAULT '{}',
    "branding" TEXT NOT NULL DEFAULT '{}',
    "settings" TEXT NOT NULL DEFAULT '{}',
    "plan" TEXT NOT NULL DEFAULT 'free',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Domain" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hostname" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "verifyToken" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" DATETIME,
    CONSTRAINT "Domain_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'viewer',
    "department" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" DATETIME,
    "passwordChangedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "stripePriceId" TEXT,
    "subscriptionStatus" TEXT NOT NULL DEFAULT 'none',
    "aiCredits" INTEGER NOT NULL DEFAULT 0,
    "aiCreditsResetAt" DATETIME,
    "billingCycleStart" DATETIME,
    "jobAiCredits" INTEGER NOT NULL DEFAULT 0,
    "jobAiCreditsResetAt" DATETIME,
    "aiDailyUsed" INTEGER NOT NULL DEFAULT 0,
    "aiDailyResetAt" DATETIME,
    "tenantId" TEXT NOT NULL,
    CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "employmentType" TEXT NOT NULL DEFAULT 'full-time',
    "experienceLevel" TEXT NOT NULL DEFAULT 'mid',
    "salaryMin" INTEGER,
    "salaryMax" INTEGER,
    "salaryCurrency" TEXT NOT NULL DEFAULT 'USD',
    "salaryPeriod" TEXT NOT NULL DEFAULT 'yearly',
    "requirements" TEXT NOT NULL DEFAULT '[]',
    "niceToHave" TEXT NOT NULL DEFAULT '[]',
    "benefits" TEXT NOT NULL DEFAULT '[]',
    "tags" TEXT NOT NULL DEFAULT '[]',
    "screeningQuestions" TEXT NOT NULL DEFAULT '[]',
    "scorecardCriteria" TEXT NOT NULL DEFAULT '[]',
    "isRemote" BOOLEAN NOT NULL DEFAULT false,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "postedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closesAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "externalId" TEXT,
    "externalSource" TEXT,
    "externalUrl" TEXT,
    "tenantId" TEXT NOT NULL,
    CONSTRAINT "Job_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "resumeUrl" TEXT,
    "resumePath" TEXT,
    "resumeText" TEXT,
    "screeningAnswers" TEXT,
    "coverLetter" TEXT,
    "linkedinUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'applied',
    "rating" INTEGER,
    "notes" TEXT,
    "source" TEXT,
    "anonymizedAt" DATETIME,
    "legalHold" BOOLEAN NOT NULL DEFAULT false,
    "legalHoldReason" TEXT,
    "feedbackReleasedAt" DATETIME,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "externalId" TEXT,
    "jobId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "stageId" TEXT,
    CONSTRAINT "Application_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Application_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Application_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "PipelineStage" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApplicationComment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "mentions" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApplicationComment_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ApplicationComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApplicationEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "actorId" TEXT,
    "actorType" TEXT NOT NULL DEFAULT 'system',
    "visibility" TEXT NOT NULL DEFAULT 'internal',
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApplicationEvent_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Interview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "jobId" TEXT,
    "round" INTEGER NOT NULL DEFAULT 1,
    "type" TEXT NOT NULL DEFAULT 'video',
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "interviewerId" TEXT,
    "scheduledAt" DATETIME NOT NULL,
    "durationMins" INTEGER NOT NULL DEFAULT 45,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "location" TEXT,
    "meetingUrl" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Interview_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Interview_interviewerId_fkey" FOREIGN KEY ("interviewerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Scorecard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "interviewId" TEXT,
    "interviewerId" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "overallNotes" TEXT,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Scorecard_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Scorecard_interviewerId_fkey" FOREIGN KEY ("interviewerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScorecardRating" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scorecardId" TEXT NOT NULL,
    "criterion" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT,
    CONSTRAINT "ScorecardRating_scorecardId_fkey" FOREIGN KEY ("scorecardId") REFERENCES "Scorecard" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "jobId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "salaryAmount" INTEGER,
    "salaryCurrency" TEXT NOT NULL DEFAULT 'USD',
    "salaryPeriod" TEXT NOT NULL DEFAULT 'yearly',
    "startDate" DATETIME,
    "expiresAt" DATETIME,
    "terms" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "approverId" TEXT,
    "approvedAt" DATETIME,
    "sentAt" DATETIME,
    "respondedAt" DATETIME,
    "decisionNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Offer_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Offer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Offer_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "recipientType" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "applicationId" TEXT,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "EeoSelfId" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "gender" TEXT,
    "race" TEXT,
    "ethnicity" TEXT,
    "veteranStatus" TEXT,
    "disability" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Consent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "subjectEmail" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "source" TEXT NOT NULL,
    "ipAddress" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AdverseAction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'rejection',
    "category" TEXT NOT NULL,
    "freeText" TEXT,
    "stage" TEXT,
    "sharedWithCandidate" BOOLEAN NOT NULL DEFAULT false,
    "candidateMessage" TEXT,
    "decidedById" TEXT,
    "decidedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AdverseAction_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AdverseAction_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PipelineStage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "jobId" TEXT,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isTerminal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PipelineStage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PipelineStage_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Page" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "blocks" TEXT NOT NULL DEFAULT '[]',
    "publishedBlocks" TEXT NOT NULL DEFAULT '[]',
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" DATETIME,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "publishedVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "tenantId" TEXT NOT NULL,
    CONSTRAINT "Page_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PageVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "version" INTEGER NOT NULL,
    "blocks" TEXT NOT NULL DEFAULT '[]',
    "title" TEXT NOT NULL DEFAULT '',
    "savedBy" TEXT,
    "savedByEmail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pageId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    CONSTRAINT "PageVersion_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "entity" TEXT,
    "entityId" TEXT,
    "details" TEXT,
    "ipAddress" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "tenantId" TEXT NOT NULL,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "jobId" TEXT,
    "pageSlug" TEXT,
    "metadata" TEXT,
    "sessionId" TEXT,
    "referrer" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,
    CONSTRAINT "AnalyticsEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Webhook" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "url" TEXT NOT NULL,
    "events" TEXT NOT NULL,
    "secret" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "tenantId" TEXT NOT NULL,
    CONSTRAINT "Webhook_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "location" TEXT,
    "linkedinUrl" TEXT,
    "resumeUrl" TEXT,
    "headline" TEXT,
    "bio" TEXT,
    "resetTokenHash" TEXT,
    "resetTokenExpiry" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "tenantId" TEXT NOT NULL,
    CONSTRAINT "Candidate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AppConfig" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ApplicationTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ApplicationTag_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApplicationTagOnApplication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApplicationTagOnApplication_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ApplicationTagOnApplication_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ApplicationTagOnApplication_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "ApplicationTag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SavedView" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filters" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SavedView_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SavedView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TalentPool" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TalentPool_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TalentPoolMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "candidateEmail" TEXT NOT NULL,
    "candidateName" TEXT,
    "note" TEXT,
    "addedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TalentPoolMember_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TalentPoolMember_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "TalentPool" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Requisition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "jobId" TEXT,
    "title" TEXT NOT NULL,
    "department" TEXT,
    "headcount" INTEGER NOT NULL DEFAULT 1,
    "justification" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdById" TEXT,
    "approverId" TEXT,
    "decisionNote" TEXT,
    "decidedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Requisition_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Requisition_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_domain_key" ON "Tenant"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "Domain_hostname_key" ON "Domain"("hostname");

-- CreateIndex
CREATE INDEX "Domain_tenantId_idx" ON "Domain"("tenantId");

-- CreateIndex
CREATE INDEX "Domain_status_idx" ON "Domain"("status");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeSubscriptionId_key" ON "User"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- CreateIndex
CREATE INDEX "User_stripeCustomerId_idx" ON "User"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_tenantId_key" ON "User"("email", "tenantId");

-- CreateIndex
CREATE INDEX "Job_tenantId_idx" ON "Job"("tenantId");

-- CreateIndex
CREATE INDEX "Job_tenantId_isPublished_idx" ON "Job"("tenantId", "isPublished");

-- CreateIndex
CREATE INDEX "Job_department_idx" ON "Job"("department");

-- CreateIndex
CREATE INDEX "Job_location_idx" ON "Job"("location");

-- CreateIndex
CREATE UNIQUE INDEX "Job_slug_tenantId_key" ON "Job"("slug", "tenantId");

-- CreateIndex
CREATE INDEX "Application_jobId_idx" ON "Application"("jobId");

-- CreateIndex
CREATE INDEX "Application_tenantId_idx" ON "Application"("tenantId");

-- CreateIndex
CREATE INDEX "Application_tenantId_status_idx" ON "Application"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Application_tenantId_stageId_idx" ON "Application"("tenantId", "stageId");

-- CreateIndex
CREATE INDEX "Application_email_tenantId_idx" ON "Application"("email", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Application_tenantId_jobId_email_key" ON "Application"("tenantId", "jobId", "email");

-- CreateIndex
CREATE INDEX "ApplicationComment_applicationId_idx" ON "ApplicationComment"("applicationId");

-- CreateIndex
CREATE INDEX "ApplicationComment_tenantId_idx" ON "ApplicationComment"("tenantId");

-- CreateIndex
CREATE INDEX "ApplicationEvent_tenantId_applicationId_idx" ON "ApplicationEvent"("tenantId", "applicationId");

-- CreateIndex
CREATE INDEX "ApplicationEvent_tenantId_type_idx" ON "ApplicationEvent"("tenantId", "type");

-- CreateIndex
CREATE INDEX "Interview_tenantId_applicationId_idx" ON "Interview"("tenantId", "applicationId");

-- CreateIndex
CREATE INDEX "Interview_tenantId_status_idx" ON "Interview"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Interview_interviewerId_idx" ON "Interview"("interviewerId");

-- CreateIndex
CREATE INDEX "Scorecard_tenantId_applicationId_idx" ON "Scorecard"("tenantId", "applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "Scorecard_tenantId_applicationId_interviewerId_key" ON "Scorecard"("tenantId", "applicationId", "interviewerId");

-- CreateIndex
CREATE INDEX "ScorecardRating_scorecardId_idx" ON "ScorecardRating"("scorecardId");

-- CreateIndex
CREATE INDEX "Offer_tenantId_applicationId_idx" ON "Offer"("tenantId", "applicationId");

-- CreateIndex
CREATE INDEX "Offer_tenantId_status_idx" ON "Offer"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Offer_approverId_idx" ON "Offer"("approverId");

-- CreateIndex
CREATE INDEX "Notification_tenantId_recipientType_recipientId_readAt_idx" ON "Notification"("tenantId", "recipientType", "recipientId", "readAt");

-- CreateIndex
CREATE INDEX "Notification_tenantId_recipientType_recipientId_createdAt_idx" ON "Notification"("tenantId", "recipientType", "recipientId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EeoSelfId_applicationId_key" ON "EeoSelfId"("applicationId");

-- CreateIndex
CREATE INDEX "EeoSelfId_tenantId_idx" ON "EeoSelfId"("tenantId");

-- CreateIndex
CREATE INDEX "Consent_tenantId_subjectEmail_type_createdAt_idx" ON "Consent"("tenantId", "subjectEmail", "type", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdverseAction_applicationId_key" ON "AdverseAction"("applicationId");

-- CreateIndex
CREATE INDEX "AdverseAction_tenantId_category_idx" ON "AdverseAction"("tenantId", "category");

-- CreateIndex
CREATE INDEX "AdverseAction_tenantId_kind_idx" ON "AdverseAction"("tenantId", "kind");

-- CreateIndex
CREATE INDEX "PipelineStage_tenantId_idx" ON "PipelineStage"("tenantId");

-- CreateIndex
CREATE INDEX "PipelineStage_tenantId_jobId_order_idx" ON "PipelineStage"("tenantId", "jobId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "PipelineStage_tenantId_jobId_key_key" ON "PipelineStage"("tenantId", "jobId", "key");

-- CreateIndex
CREATE INDEX "Page_tenantId_idx" ON "Page"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Page_slug_tenantId_key" ON "Page"("slug", "tenantId");

-- CreateIndex
CREATE INDEX "PageVersion_pageId_idx" ON "PageVersion"("pageId");

-- CreateIndex
CREATE INDEX "PageVersion_tenantId_idx" ON "PageVersion"("tenantId");

-- CreateIndex
CREATE INDEX "PageVersion_createdAt_idx" ON "PageVersion"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PageVersion_pageId_version_key" ON "PageVersion"("pageId", "version");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_idx" ON "AuditLog"("tenantId");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_action_idx" ON "AuditLog"("tenantId", "action");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_tenantId_type_idx" ON "AnalyticsEvent"("tenantId", "type");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_tenantId_jobId_idx" ON "AnalyticsEvent"("tenantId", "jobId");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_tenantId_createdAt_idx" ON "AnalyticsEvent"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_createdAt_idx" ON "AnalyticsEvent"("createdAt");

-- CreateIndex
CREATE INDEX "Webhook_tenantId_idx" ON "Webhook"("tenantId");

-- CreateIndex
CREATE INDEX "Candidate_tenantId_idx" ON "Candidate"("tenantId");

-- CreateIndex
CREATE INDEX "Candidate_resetTokenHash_idx" ON "Candidate"("resetTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_email_tenantId_key" ON "Candidate"("email", "tenantId");

-- CreateIndex
CREATE INDEX "ApplicationTag_tenantId_idx" ON "ApplicationTag"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationTag_tenantId_label_key" ON "ApplicationTag"("tenantId", "label");

-- CreateIndex
CREATE INDEX "ApplicationTagOnApplication_tenantId_tagId_idx" ON "ApplicationTagOnApplication"("tenantId", "tagId");

-- CreateIndex
CREATE INDEX "ApplicationTagOnApplication_tenantId_applicationId_idx" ON "ApplicationTagOnApplication"("tenantId", "applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationTagOnApplication_applicationId_tagId_key" ON "ApplicationTagOnApplication"("applicationId", "tagId");

-- CreateIndex
CREATE INDEX "SavedView_tenantId_userId_idx" ON "SavedView"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "TalentPool_tenantId_idx" ON "TalentPool"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "TalentPool_tenantId_name_key" ON "TalentPool"("tenantId", "name");

-- CreateIndex
CREATE INDEX "TalentPoolMember_tenantId_poolId_idx" ON "TalentPoolMember"("tenantId", "poolId");

-- CreateIndex
CREATE INDEX "TalentPoolMember_tenantId_candidateEmail_idx" ON "TalentPoolMember"("tenantId", "candidateEmail");

-- CreateIndex
CREATE UNIQUE INDEX "TalentPoolMember_poolId_candidateEmail_key" ON "TalentPoolMember"("poolId", "candidateEmail");

-- CreateIndex
CREATE UNIQUE INDEX "Requisition_jobId_key" ON "Requisition"("jobId");

-- CreateIndex
CREATE INDEX "Requisition_tenantId_idx" ON "Requisition"("tenantId");

-- CreateIndex
CREATE INDEX "Requisition_tenantId_status_idx" ON "Requisition"("tenantId", "status");

