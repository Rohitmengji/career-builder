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
} from "./templates";
import type {
  EmailConfig,
  EmailProvider,
  EmailRecipient,
  ApplicationConfirmationData,
  ApplicationNotificationData,
  StatusUpdateData,
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
  SendResult,
  TenantEmailSettings,
} from "./types";
