/**
 * @career-builder/email — Resend Provider
 *
 * Thin wrapper around the Resend SDK that conforms to our
 * EmailProvider interface. Handles graceful degradation when
 * the API key is missing (logs instead of sending).
 */

import { Resend } from "resend";
import type { EmailProvider, EmailMessage, SendResult, EmailConfig } from "./types";

export function createResendProvider(config: EmailConfig): EmailProvider {
  const resend = config.enabled && config.apiKey ? new Resend(config.apiKey) : null;

  return {
    async send(message: EmailMessage): Promise<SendResult> {
      if (!resend || !config.enabled) {
        // Graceful fallback — log the email instead of failing
        console.log(
          `[email] DISABLED — would have sent to: ${
            Array.isArray(message.to)
              ? message.to.map((r) => r.email).join(", ")
              : message.to.email
          } | subject: "${message.subject}"`,
        );
        return { success: true, messageId: "disabled-noop" };
      }

      try {
        const from = message.from || config.defaultFrom;
        const toAddresses = Array.isArray(message.to)
          ? message.to.map((r) => (r.name ? `${r.name} <${r.email}>` : r.email))
          : [message.to.name ? `${message.to.name} <${message.to.email}>` : message.to.email];

        const { data, error } = await resend.emails.send({
          from: from.name ? `${from.name} <${from.email}>` : from.email,
          to: toAddresses,
          replyTo: message.replyTo
            ? (message.replyTo.name
              ? `${message.replyTo.name} <${message.replyTo.email}>`
              : message.replyTo.email)
            : undefined,
          subject: message.subject,
          html: message.html,
          text: message.text,
          tags: message.tags,
        });

        if (error) {
          console.error("[email] Resend error:", error);
          return { success: false, error: error.message };
        }

        return { success: true, messageId: data?.id };
      } catch (err: any) {
        console.error("[email] Send failed:", err.message);
        return { success: false, error: err.message };
      }
    },
  };
}
