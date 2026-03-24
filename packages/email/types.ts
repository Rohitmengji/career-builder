/**
 * @career-builder/email — Types
 *
 * Shared types for the email system. Provider-agnostic so we can
 * swap Resend for SES/SendGrid without touching consumer code.
 */

/* ================================================================== */
/*  Core email types                                                   */
/* ================================================================== */

export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface EmailMessage {
  to: EmailRecipient | EmailRecipient[];
  from?: EmailRecipient;
  replyTo?: EmailRecipient;
  subject: string;
  html: string;
  text?: string;
  tags?: { name: string; value: string }[];
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/* ================================================================== */
/*  Application-specific payloads                                      */
/* ================================================================== */

export interface ApplicationConfirmationData {
  candidateFirstName: string;
  candidateLastName: string;
  candidateEmail: string;
  jobTitle: string;
  companyName: string;
  applicationId: string;
  /** The public-facing careers site URL */
  siteUrl: string;
}

export interface ApplicationNotificationData {
  candidateFirstName: string;
  candidateLastName: string;
  candidateEmail: string;
  candidatePhone?: string;
  candidateLinkedin?: string;
  jobTitle: string;
  jobDepartment: string;
  jobLocation: string;
  companyName: string;
  applicationId: string;
  /** Resume URL/path if provided */
  resumeUrl?: string;
  /** Cover letter text if provided */
  coverLetter?: string;
  /** Admin panel URL */
  adminUrl: string;
}

export interface StatusUpdateData {
  candidateFirstName: string;
  candidateEmail: string;
  jobTitle: string;
  companyName: string;
  newStatus: string;
  /** Optional personal message from the recruiter */
  message?: string;
  siteUrl: string;
}

/* ================================================================== */
/*  Provider interface                                                 */
/* ================================================================== */

export interface EmailProvider {
  send(message: EmailMessage): Promise<SendResult>;
}

/* ================================================================== */
/*  Config                                                             */
/* ================================================================== */

export interface EmailConfig {
  /** Resend API key */
  apiKey: string;
  /** Default "from" address (must be verified with provider) */
  defaultFrom: EmailRecipient;
  /** Where to send admin notifications */
  adminEmail: string;
  /** Whether email is actually enabled (allows graceful disable) */
  enabled: boolean;
}
