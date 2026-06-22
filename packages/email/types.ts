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

export interface InterviewInvitationData {
  candidateFirstName: string;
  candidateEmail: string;
  jobTitle: string;
  companyName: string;
  siteUrl: string;
  /** Pre-formatted local date/time incl. timezone, e.g. "Mon, Jun 30 · 2:30 PM PDT". */
  whenText: string;
  /** "phone" | "video" | "onsite" — human label resolved by the template. */
  interviewType: string;
  interviewerName?: string;
  location?: string;
  meetingUrl?: string;
  /** false = cancellation email instead of an invitation. */
  cancelled?: boolean;
}

export interface OfferExtendedData {
  candidateFirstName: string;
  candidateEmail: string;
  jobTitle: string;
  companyName: string;
  siteUrl: string;
  /** Pre-formatted compensation, e.g. "$145,000 / yr". */
  compText: string;
  /** Pre-formatted start date, e.g. "Aug 1, 2026". */
  startText?: string;
  /** Pre-formatted expiry, e.g. "Respond by Jul 1, 2026". */
  expiresText?: string;
  /** Candidate-visible additional terms. */
  terms?: string;
}

export interface OfferDecisionData {
  decision: "accepted" | "declined";
  candidateFirstName: string;
  candidateLastName: string;
  jobTitle: string;
  companyName: string;
  /** Admin app base URL; the template links to the application. */
  adminUrl: string;
  applicationId: string;
  /** The candidate's optional note (internal-facing). */
  note?: string;
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

/**
 * Per-tenant email overrides (from Tenant.settings.email). Lets each client
 * send from its own address and route notifications to its own inbox while
 * sharing one provider/API key.
 */
export interface TenantEmailSettings {
  /** Tenant's preferred from-address. Used only when senderVerified is true. */
  fromEmail?: string;
  /** Display name for the from-address. */
  fromName?: string;
  /** Where this tenant's new-application notifications go. */
  adminEmail?: string;
  /**
   * Whether fromEmail's domain is verified with the email provider. R8: an
   * unverified tenant address would bounce / hurt deliverability, so we fall
   * back to the platform default sender unless this is true.
   */
  senderVerified?: boolean;
}
