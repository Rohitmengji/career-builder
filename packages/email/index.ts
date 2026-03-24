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
  ApplicationConfirmationData,
  ApplicationNotificationData,
  StatusUpdateData,
  SendResult,
} from "./types";

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
  ): Promise<SendResult> {
    const { subject, html, text } = applicationConfirmation(data);
    return getProvider().send({
      to: { email: data.candidateEmail, name: `${data.candidateFirstName} ${data.candidateLastName}` },
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
  ): Promise<SendResult> {
    const config = getConfig();
    if (!config.adminEmail) {
      console.log("[email] No admin email configured — skipping notification");
      return { success: true, messageId: "no-admin-email" };
    }

    const { subject, html, text } = applicationNotification(data);
    return getProvider().send({
      to: { email: config.adminEmail },
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
} from "./types";
