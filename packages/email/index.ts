/**
 * @career-builder/email — Main entry point
 *
 * Usage:
 *   import { emailService } from "@career-builder/email";
 *   await emailService.sendApplicationConfirmation({ ... });
 */

import { createResendProvider } from "./provider";
import {
  applicationConfirmation,
  applicationNotification,
  statusUpdate,
  interviewInvitation,
  offerExtended,
  offerDecision,
  talentPoolReengagement,
} from "./templates";
import type {
  EmailConfig,
  EmailProvider,
  EmailRecipient,
  ApplicationConfirmationData,
  ApplicationNotificationData,
  StatusUpdateData,
  InterviewInvitationData,
  OfferExtendedData,
  OfferDecisionData,
  SendResult,
  TenantEmailSettings,
} from "./types";

/**
 * Resolve the per-send sender + admin address. A tenant's own from-address is
 * used only when verified (R8); otherwise the platform default. Env is read
 * fresh per send so config changes / per-tenant overrides both apply.
 */
export function resolveSender(sender?: TenantEmailSettings): {
  from?: EmailRecipient;
  adminEmail: string;
} {
  const envFromName = process.env.EMAIL_FROM_NAME || "Career Builder";
  const envAdmin = process.env.EMAIL_ADMIN || process.env.EMAIL_FROM || "";

  // undefined `from` → provider falls back to its verified platform default.
  const from: EmailRecipient | undefined =
    sender?.senderVerified && sender.fromEmail
      ? { email: sender.fromEmail, name: sender.fromName || envFromName }
      : undefined;

  return { from, adminEmail: sender?.adminEmail || envAdmin };
}

/* ================================================================== */
/*  Email Service — singleton with lazy init                           */
/* ================================================================== */

let _provider: EmailProvider | null = null;
let _config: EmailConfig | null = null;

function getConfig(): EmailConfig {
  if (_config) return _config;

  const apiKey = process.env.RESEND_API_KEY || "";
  const fromEmail = process.env.EMAIL_FROM || "noreply@example.com";
  const fromName = process.env.EMAIL_FROM_NAME || "Career Builder";
  const adminEmail = process.env.EMAIL_ADMIN || process.env.EMAIL_FROM || "";

  _config = {
    apiKey,
    defaultFrom: { email: fromEmail, name: fromName },
    adminEmail,
    enabled: !!apiKey && apiKey !== "re_placeholder",
  };

  return _config;
}

function getProvider(): EmailProvider {
  if (_provider) return _provider;
  _provider = createResendProvider(getConfig());
  return _provider;
}

/* ================================================================== */
/*  Public API                                                         */
/* ================================================================== */

export const emailService = {
  /**
   * Send application confirmation to the candidate.
   * Called after a successful application submission.
   */
  async sendApplicationConfirmation(
    data: ApplicationConfirmationData,
    sender?: TenantEmailSettings,
  ): Promise<SendResult> {
    const { from } = resolveSender(sender);
    const { subject, html, text } = applicationConfirmation(data);
    return getProvider().send({
      to: { email: data.candidateEmail, name: `${data.candidateFirstName} ${data.candidateLastName}` },
      from,
      subject,
      html,
      text,
      tags: [
        { name: "type", value: "application-confirmation" },
        { name: "applicationId", value: data.applicationId },
      ],
    });
  },

  /**
   * Notify admin/recruiter of a new application.
   */
  async sendApplicationNotification(
    data: ApplicationNotificationData,
    sender?: TenantEmailSettings,
  ): Promise<SendResult> {
    const { from, adminEmail } = resolveSender(sender);
    if (!adminEmail) {
      console.log("[email] No admin email configured — skipping notification");
      return { success: true, messageId: "no-admin-email" };
    }

    const { subject, html, text } = applicationNotification(data);
    return getProvider().send({
      to: { email: adminEmail },
      from,
      replyTo: { email: data.candidateEmail, name: `${data.candidateFirstName} ${data.candidateLastName}` },
      subject,
      html,
      text,
      tags: [
        { name: "type", value: "application-notification" },
        { name: "applicationId", value: data.applicationId },
      ],
    });
  },

  /**
   * Send status update to candidate (reviewing, interview, offer, hired, rejected).
   */
  async sendStatusUpdate(data: StatusUpdateData): Promise<SendResult> {
    const { subject, html, text } = statusUpdate(data);
    return getProvider().send({
      to: { email: data.candidateEmail, name: data.candidateFirstName },
      subject,
      html,
      text,
      tags: [
        { name: "type", value: "status-update" },
        { name: "status", value: data.newStatus },
      ],
    });
  },

  /** Interview invitation (or cancellation) to a candidate. Per-tenant sender. */
  async sendInterviewInvitation(
    data: InterviewInvitationData,
    sender?: TenantEmailSettings,
  ): Promise<SendResult> {
    const { from } = resolveSender(sender);
    const { subject, html, text } = interviewInvitation(data);
    return getProvider().send({
      from,
      to: { email: data.candidateEmail, name: data.candidateFirstName },
      subject,
      html,
      text,
      tags: [{ name: "type", value: data.cancelled ? "interview-cancelled" : "interview-invite" }],
    });
  },

  /** Offer extended to a candidate (accept/decline from their applications page). Per-tenant sender. */
  async sendOfferExtended(
    data: OfferExtendedData,
    sender?: TenantEmailSettings,
  ): Promise<SendResult> {
    const { from } = resolveSender(sender);
    const { subject, html, text } = offerExtended(data);
    return getProvider().send({
      from,
      to: { email: data.candidateEmail, name: data.candidateFirstName },
      subject,
      html,
      text,
      tags: [{ name: "type", value: "offer-extended" }],
    });
  },

  /** Internal notification to the hiring team when a candidate accepts/declines. */
  async sendOfferDecision(
    data: OfferDecisionData,
    sender?: TenantEmailSettings,
  ): Promise<SendResult> {
    const { from, adminEmail } = resolveSender(sender);
    if (!adminEmail) {
      console.log("[email] No admin email configured — skipping offer-decision notification");
      return { success: true, messageId: "no-admin-email" };
    }
    const { subject, html, text } = offerDecision(data);
    return getProvider().send({
      to: { email: adminEmail },
      from,
      subject,
      html,
      text,
      tags: [
        { name: "type", value: "offer-decision" },
        { name: "decision", value: data.decision },
      ],
    });
  },

  /**
   * Send a password-reset link to a candidate. The URL is HTML-escaped and the
   * token is URL-encoded to prevent attribute/markup injection.
   */
  async sendPasswordReset(data: {
    email: string;
    firstName?: string;
    resetUrl: string;
    companyName?: string;
    expiresInMinutes?: number;
  }): Promise<SendResult> {
    const esc = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const company = esc(data.companyName || "Our Careers Team");
    const name = esc(data.firstName || "there");
    const url = esc(data.resetUrl);
    const mins = data.expiresInMinutes ?? 60;
    const subject = `Reset your password`;
    const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#111827;max-width:520px;margin:0 auto;padding:24px">
      <h1 style="font-size:20px;margin:0 0 16px">Reset your password</h1>
      <p>Hi ${name},</p>
      <p>We received a request to reset your password. Click the button below to choose a new one. This link expires in ${mins} minutes.</p>
      <p style="margin:24px 0"><a href="${url}" style="background:#2563eb;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">Reset Password</a></p>
      <p style="color:#6b7280;font-size:13px">If you didn't request this, you can safely ignore this email — your password won't change.</p>
      <p style="color:#6b7280;font-size:13px">Or paste this link into your browser:<br>${url}</p>
      <p style="color:#9ca3af;font-size:12px;margin-top:24px">${company}</p>
    </body></html>`;
    const text = `Hi ${data.firstName || "there"},\n\nReset your password using this link (expires in ${mins} minutes):\n${data.resetUrl}\n\nIf you didn't request this, ignore this email.\n\n${data.companyName || "Our Careers Team"}`;
    return getProvider().send({
      to: { email: data.email, name: data.firstName },
      subject,
      html,
      text,
      tags: [{ name: "type", value: "password-reset" }],
    });
  },

  /**
   * Notify a teammate they were @mentioned on an application comment. Internal
   * notification — all interpolated values are HTML-escaped + subject is
   * single-lined (header-injection safe).
   */
  async sendMentionNotification(
    data: {
      to: string;
      mentionedFirstName?: string;
      actorName: string;
      candidateName: string;
      jobTitle: string;
      excerpt: string;
      url: string;
    },
    sender?: TenantEmailSettings,
  ): Promise<SendResult> {
    const esc = (s: string) =>
      String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const oneLine = (s: string) => String(s ?? "").replace(/[\r\n]+/g, " ").trim();
    const { from } = resolveSender(sender);
    const name = esc(data.mentionedFirstName || "there");
    const actor = esc(data.actorName);
    const candidate = esc(data.candidateName);
    const job = esc(data.jobTitle);
    const excerpt = esc(data.excerpt.slice(0, 400));
    const url = esc(data.url);
    const subject = oneLine(`${data.actorName} mentioned you on ${data.candidateName}`);
    const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#111827;max-width:520px;margin:0 auto;padding:24px">
      <h1 style="font-size:18px;margin:0 0 12px">You were mentioned</h1>
      <p><strong>${actor}</strong> mentioned you on <strong>${candidate}</strong>'s application for <strong>${job}</strong>:</p>
      <blockquote style="margin:16px 0;padding:12px 16px;border-left:3px solid #2563eb;background:#f8fafc;color:#374151">${excerpt}</blockquote>
      <p style="margin:20px 0"><a href="${url}" style="background:#2563eb;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">View the application</a></p>
    </body></html>`;
    const text = `${data.actorName} mentioned you on ${data.candidateName}'s application for ${data.jobTitle}:\n\n${data.excerpt.slice(0, 400)}\n\n${data.url}`;
    return getProvider().send({
      to: { email: data.to, name: data.mentionedFirstName },
      from,
      subject,
      html,
      text,
      tags: [{ name: "type", value: "mention-notification" }],
    });
  },

  /**
   * Consent-gated talent-pool re-engagement to ONE candidate (ADR-0018). The route
   * sends only to candidates with marketing consent; this just renders + sends.
   */
  async sendTalentPoolReengagement(
    data: { to: string; companyName: string; subject: string; message: string },
    sender?: TenantEmailSettings,
  ): Promise<SendResult> {
    const { from } = resolveSender(sender);
    const { subject, html, text } = talentPoolReengagement({
      companyName: data.companyName,
      subject: data.subject,
      message: data.message,
    });
    return getProvider().send({
      to: { email: data.to },
      from,
      subject,
      html,
      text,
      tags: [{ name: "type", value: "talent-pool-reengagement" }],
    });
  },
};

/* ================================================================== */
/*  Re-exports                                                         */
/* ================================================================== */

export type {
  EmailConfig,
  EmailProvider,
  ApplicationConfirmationData,
  ApplicationNotificationData,
  StatusUpdateData,
  InterviewInvitationData,
  SendResult,
  TenantEmailSettings,
} from "./types";
