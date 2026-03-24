/**
 * @career-builder/email — Templates
 *
 * Clean, responsive HTML email templates. Inline-styled for maximum
 * client compatibility (Gmail, Outlook, Apple Mail, etc.).
 *
 * Every template returns { subject, html, text } so both rich and
 * plain-text versions are always sent.
 */

import type {
  ApplicationConfirmationData,
  ApplicationNotificationData,
  StatusUpdateData,
} from "./types";

/* ================================================================== */
/*  Shared layout                                                      */
/* ================================================================== */

function layout(body: string, companyName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;">
<tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
<tr><td style="padding:32px 32px 0;">
  <div style="font-size:18px;font-weight:700;color:#111827;margin-bottom:4px;">${escapeHtml(companyName)}</div>
  <div style="height:1px;background:#e5e7eb;margin:16px 0;"></div>
</td></tr>
<tr><td style="padding:0 32px 32px;">
${body}
</td></tr>
</table>
<p style="margin:24px 0 0;font-size:12px;color:#9ca3af;text-align:center;">
  © ${new Date().getFullYear()} ${escapeHtml(companyName)}. All rights reserved.
</p>
</td></tr>
</table>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function btn(text: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;background:#2563eb;color:#ffffff;font-weight:600;font-size:14px;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:16px;">${escapeHtml(text)}</a>`;
}

/* ================================================================== */
/*  1. Application Confirmation (sent to candidate)                    */
/* ================================================================== */

export function applicationConfirmation(data: ApplicationConfirmationData) {
  const subject = `Application received — ${data.jobTitle} at ${data.companyName}`;

  const html = layout(
    `<h2 style="margin:0 0 8px;font-size:20px;color:#111827;">Thanks for applying, ${escapeHtml(data.candidateFirstName)}!</h2>
<p style="margin:0 0 16px;font-size:15px;color:#4b5563;line-height:1.6;">
  We've received your application for <strong>${escapeHtml(data.jobTitle)}</strong> at ${escapeHtml(data.companyName)}.
  Our team will review it and get back to you soon.
</p>
<div style="background:#f9fafb;border-radius:8px;padding:16px;margin:16px 0;">
  <p style="margin:0;font-size:13px;color:#6b7280;">Application ID</p>
  <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:#111827;">${escapeHtml(data.applicationId)}</p>
</div>
<p style="margin:16px 0 0;font-size:14px;color:#4b5563;">
  In the meantime, explore more open roles:
</p>
${btn("View Open Positions", data.siteUrl + "/jobs")}
<p style="margin:24px 0 0;font-size:13px;color:#9ca3af;">
  If you didn't submit this application, you can safely ignore this email.
</p>`,
    data.companyName,
  );

  const text = `Thanks for applying, ${data.candidateFirstName}!

We've received your application for ${data.jobTitle} at ${data.companyName}.
Our team will review it and get back to you soon.

Application ID: ${data.applicationId}

View more roles: ${data.siteUrl}/jobs

If you didn't submit this application, you can safely ignore this email.`;

  return { subject, html, text };
}

/* ================================================================== */
/*  2. New Application Notification (sent to admin/recruiter)          */
/* ================================================================== */

export function applicationNotification(data: ApplicationNotificationData) {
  const subject = `📩 New application: ${data.candidateFirstName} ${data.candidateLastName} → ${data.jobTitle}`;

  const detailRow = (label: string, value: string) =>
    value
      ? `<tr><td style="padding:6px 12px;font-size:13px;color:#6b7280;white-space:nowrap;">${label}</td><td style="padding:6px 12px;font-size:13px;color:#111827;">${escapeHtml(value)}</td></tr>`
      : "";

  const html = layout(
    `<h2 style="margin:0 0 8px;font-size:20px;color:#111827;">New Application Received</h2>
<p style="margin:0 0 16px;font-size:15px;color:#4b5563;line-height:1.6;">
  <strong>${escapeHtml(data.candidateFirstName)} ${escapeHtml(data.candidateLastName)}</strong> applied for
  <strong>${escapeHtml(data.jobTitle)}</strong>.
</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f9fafb;border-radius:8px;margin:16px 0;">
  ${detailRow("Email", data.candidateEmail)}
  ${detailRow("Phone", data.candidatePhone || "—")}
  ${detailRow("LinkedIn", data.candidateLinkedin || "—")}
  ${detailRow("Department", data.jobDepartment)}
  ${detailRow("Location", data.jobLocation)}
  ${detailRow("App ID", data.applicationId)}
</table>
${data.coverLetter ? `<div style="background:#f9fafb;border-radius:8px;padding:16px;margin:16px 0;">
  <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#374151;">Cover Letter</p>
  <p style="margin:0;font-size:13px;color:#4b5563;line-height:1.5;white-space:pre-wrap;">${escapeHtml(data.coverLetter.slice(0, 2000))}</p>
</div>` : ""}
${btn("Review Application", data.adminUrl + "/applications/" + data.applicationId)}`,
    data.companyName,
  );

  const text = `New Application: ${data.candidateFirstName} ${data.candidateLastName} → ${data.jobTitle}

Email: ${data.candidateEmail}
Phone: ${data.candidatePhone || "—"}
LinkedIn: ${data.candidateLinkedin || "—"}
Department: ${data.jobDepartment}
Location: ${data.jobLocation}

${data.coverLetter ? `Cover Letter:\n${data.coverLetter.slice(0, 2000)}` : ""}

Review: ${data.adminUrl}/applications/${data.applicationId}`;

  return { subject, html, text };
}

/* ================================================================== */
/*  3. Application Status Update (sent to candidate)                   */
/* ================================================================== */

export function statusUpdate(data: StatusUpdateData) {
  const statusLabels: Record<string, string> = {
    reviewing: "Under Review",
    interview: "Interview Stage",
    offer: "Offer Extended",
    hired: "Congratulations — You're Hired!",
    rejected: "Update on Your Application",
  };

  const statusLabel = statusLabels[data.newStatus] || data.newStatus;
  const subject = `Application update: ${statusLabel} — ${data.jobTitle}`;

  const statusMessages: Record<string, string> = {
    reviewing:
      "Good news! Your application is now being reviewed by our hiring team. We'll be in touch with next steps soon.",
    interview:
      "Great news! We'd like to move forward with an interview. Our team will reach out to schedule a time that works for you.",
    offer:
      "Congratulations! We're excited to extend an offer for this role. Keep an eye on your inbox for the details.",
    hired:
      "Welcome to the team! 🎉 We're thrilled to have you on board. Expect onboarding details shortly.",
    rejected:
      "Thank you for your interest and the time you invested in the application process. After careful consideration, we've decided to move forward with other candidates for this role. We encourage you to apply for future openings.",
  };

  const statusMsg = statusMessages[data.newStatus] || "Your application status has been updated.";

  const html = layout(
    `<h2 style="margin:0 0 8px;font-size:20px;color:#111827;">${escapeHtml(statusLabel)}</h2>
<p style="margin:0 0 16px;font-size:15px;color:#4b5563;line-height:1.6;">
  Hi ${escapeHtml(data.candidateFirstName)},
</p>
<p style="margin:0 0 16px;font-size:15px;color:#4b5563;line-height:1.6;">
  ${statusMsg}
</p>
<div style="background:#f9fafb;border-radius:8px;padding:16px;margin:16px 0;">
  <p style="margin:0;font-size:13px;color:#6b7280;">Role</p>
  <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:#111827;">${escapeHtml(data.jobTitle)}</p>
</div>
${data.message ? `<div style="background:#eff6ff;border-radius:8px;padding:16px;margin:16px 0;border-left:3px solid #2563eb;">
  <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#1d4ed8;">Message from the team</p>
  <p style="margin:0;font-size:14px;color:#1e40af;line-height:1.5;">${escapeHtml(data.message)}</p>
</div>` : ""}
${btn("View Open Positions", data.siteUrl + "/jobs")}`,
    data.companyName,
  );

  const text = `${statusLabel}

Hi ${data.candidateFirstName},

${statusMsg}

Role: ${data.jobTitle}

${data.message ? `Message from the team:\n${data.message}\n` : ""}
View more roles: ${data.siteUrl}/jobs`;

  return { subject, html, text };
}
