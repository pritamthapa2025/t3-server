import * as brevo from "@getbrevo/brevo";
import { logger } from "../utils/logger.js";
import type {
  Notification,
  EmailTemplateData,
} from "../types/notification.types.js";

const logoUrl = `https://t3-mechanical.sfo3.cdn.digitaloceanspaces.com/t3_logo-white.png`;
const logoHeader = `<img src="${logoUrl}" alt="T3 Mechanical" style="max-height: 64px; width: auto;" />`;

const apiKey = process.env.BREVO_API_KEY;
const senderEmail =
  process.env.BREVO_SENDER_EMAIL || "notifications@t3mechanical.com";
const senderName = "T3 Mechanical";

if (!apiKey) {
  logger.warn(
    "⚠️ BREVO_API_KEY not configured. Email notifications will not be sent.",
  );
}

// Initialize Brevo API client
let apiInstance: brevo.TransactionalEmailsApi | null = null;

if (apiKey) {
  apiInstance = new brevo.TransactionalEmailsApi();
  apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, apiKey);
}

export class NotificationEmailService {
  /**
   * Send notification email
   */
  async sendNotificationEmail(
    recipientEmail: string,
    recipientName: string,
    notification: Notification,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!apiInstance) {
      logger.warn("Brevo API not initialized. Skipping email notification.");
      return { success: false, error: "Email service not configured" };
    }

    try {
      const actionUrl = notification.actionUrl
        ? `${process.env.CLIENT_URL}${notification.actionUrl}`
        : undefined;

      // Parse additionalNotes as JSON for the info card (set by services when triggering events)
      let additionalInfo: Record<string, string> | undefined;
      if (notification.additionalNotes) {
        try {
          const parsed = JSON.parse(notification.additionalNotes);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            additionalInfo = parsed as Record<string, string>;
          }
        } catch {
          // additionalNotes is plain text, not JSON — skip the info card
        }
      }

      const templateData: EmailTemplateData = {
        recipientName: recipientName || "User",
        title: notification.title,
        message: notification.message,
        ...(actionUrl ? { actionUrl } : {}),
        ...(notification.actionUrl ? { actionText: "View Details" } : {}),
        ...(additionalInfo ? { additionalInfo } : {}),
      };

      const htmlContent = this.generateEmailHTML(templateData);

      const sendSmtpEmail = new brevo.SendSmtpEmail();
      sendSmtpEmail.sender = { name: senderName, email: senderEmail };
      sendSmtpEmail.to = [{ email: recipientEmail, name: recipientName }];
      sendSmtpEmail.subject = `[T3 Mechanical] ${notification.title}`;
      sendSmtpEmail.htmlContent = htmlContent;

      const response = await apiInstance.sendTransacEmail(sendSmtpEmail);
      const messageId =
        response.body?.messageId || response.body?.["messageId"];

      logger.info(
        `✅ Email sent successfully to ${recipientEmail} (MessageId: ${messageId})`,
      );

      return { success: true, messageId: messageId as string };
    } catch (error: any) {
      logger.error(`❌ Failed to send email to ${recipientEmail}:`, error);
      return {
        success: false,
        error: error.message || "Failed to send email",
      };
    }
  }

  /**
   * Generate HTML email template
   */
  private generateEmailHTML(data: EmailTemplateData): string {
    const infoCardRows = data.additionalInfo
      ? Object.entries(data.additionalInfo)
          .filter(([, v]) => v && v.toString().trim() !== "")
          .map(
            ([label, value]) => `
        <tr>
          <td style="padding: 10px 14px; font-size: 13px; font-weight: 600; color: #555555; white-space: nowrap; width: 38%; border-bottom: 1px solid #F0F0F0;">${label}</td>
          <td style="padding: 10px 14px; font-size: 13px; color: #111111; border-bottom: 1px solid #F0F0F0;">${
            String(value).startsWith("http://") || String(value).startsWith("https://")
              ? `<a href="${value}" target="_blank" rel="noopener noreferrer" style="color:#46931f; text-decoration:underline;">Open link</a>`
              : value
          }</td>
        </tr>`,
          )
          .join("")
      : null;

    const infoCardHtml = infoCardRows
      ? `
      <div style="margin: 28px 0;">
        <p style="font-size: 12px; font-weight: 700; color: #999999; text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 10px 0;">Details</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; border: 1px solid #E8E8E8; border-radius: 8px; overflow: hidden;">
          <tbody>
            ${infoCardRows}
          </tbody>
        </table>
      </div>`
      : "";

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.title}</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #000000;
      background-color: #F4F4F5;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background-color: #ffffff;
      border-radius: 16px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      overflow: hidden;
    }
    .header {
      background-color: #CC1F1F;
      padding: 28px 30px;
      text-align: center;
    }
    .title-bar {
      background-color: #F9F9F9;
      padding: 18px 30px;
      border-bottom: 1px solid #EBEBEB;
    }
    .title-bar h2 {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
      color: #111111;
    }
    .content {
      padding: 32px 30px 24px;
    }
    .greeting {
      font-size: 15px;
      margin-bottom: 16px;
      color: #111111;
    }
    .message {
      font-size: 15px;
      color: #444444;
      margin-bottom: 4px;
      line-height: 1.8;
    }
    .button {
      display: inline-block;
      padding: 13px 32px;
      background-color: #46931f;
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 14px;
      margin: 8px 0 4px;
    }
    .footer {
      background-color: #F4F4F5;
      padding: 18px 30px;
      text-align: center;
      font-size: 12px;
      color: #888888;
      border-top: 1px solid #E8E8E8;
    }
    .footer p {
      margin: 4px 0;
    }
  </style>
</head>
<body>
  <div class="container">

    <div class="header">
      ${logoHeader}
    </div>

    <div class="title-bar">
      <h2>${data.title}</h2>
    </div>

    <div class="content">
      <p class="greeting">Hi <strong>${data.recipientName}</strong>,</p>
      <p class="message">${data.message}</p>

      ${infoCardHtml}

      ${
        data.actionUrl
          ? `<div style="text-align: center; margin-top: 28px;">
               <a href="${data.actionUrl}" class="button">${data.actionText || "View Details"}</a>
             </div>`
          : ""
      }
    </div>

    <div class="footer">
      <p>This is an automated notification from <strong>T3 Mechanical</strong>.</p>
      <p>For questions, contact your administrator or support team.</p>
      <p style="margin-top: 10px; font-size: 11px; color: #BBBBBB;">If you did not expect this email, please verify your account security.</p>
    </div>

  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Send bulk notification emails
   */
  /**
   * Send a direct email to an external recipient (e.g. client contacts who have no system user account).
   * Does NOT require a Notification DB record — builds the email from raw fields.
   */
  async sendDirectEmail(
    recipientEmail: string,
    recipientName: string,
    title: string,
    message: string,
    options?: {
      actionUrl?: string;
      additionalInfo?: Record<string, string>;
    },
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!apiInstance) {
      logger.warn("Brevo API not initialized. Skipping direct email.");
      return { success: false, error: "Email service not configured" };
    }

    try {
      const actionUrl = options?.actionUrl
        ? `${process.env.CLIENT_URL}${options.actionUrl}`
        : undefined;

      const templateData: EmailTemplateData = {
        recipientName: recipientName || "Valued Client",
        title,
        message,
        ...(actionUrl ? { actionUrl, actionText: "View Details" } : {}),
        ...(options?.additionalInfo ? { additionalInfo: options.additionalInfo } : {}),
      };

      const htmlContent = this.generateEmailHTML(templateData);
      const sendSmtpEmail = new brevo.SendSmtpEmail();
      sendSmtpEmail.sender = { name: senderName, email: senderEmail };
      sendSmtpEmail.to = [{ email: recipientEmail, name: recipientName }];
      sendSmtpEmail.subject = `[T3 Mechanical] ${title}`;
      sendSmtpEmail.htmlContent = htmlContent;

      const response = await apiInstance.sendTransacEmail(sendSmtpEmail);
      const messageId = response.body?.messageId || response.body?.["messageId"];

      logger.info(`✅ Direct email sent to ${recipientEmail} (MessageId: ${messageId})`);
      return { success: true, messageId: messageId as string };
    } catch (error: any) {
      logger.error(`❌ Failed to send direct email to ${recipientEmail}:`, error);
      return { success: false, error: error.message || "Failed to send email" };
    }
  }

  async sendBulkEmails(
    notifications: Array<{
      email: string;
      name: string;
      notification: Notification;
    }>,
  ): Promise<Array<{ email: string; success: boolean; error?: string }>> {
    const results = [];

    for (const item of notifications) {
      const result = await this.sendNotificationEmail(
        item.email,
        item.name,
        item.notification,
      );
      results.push({
        email: item.email,
        success: result.success,
        ...(result.error ? { error: result.error } : {}),
      });

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return results;
  }

  /**
   * Send a digest (summary table) email to multiple recipients.
   * Each recipient gets one email with all records in an HTML table —
   * instead of N individual emails for N records.
   */
  async sendDigestEmail(params: {
    recipients: Array<{ email: string; name: string }>;
    title: string;
    intro: string;
    columns: string[];
    rows: string[][];
    hasMore?: boolean;
    actionUrl?: string;
    actionLabel?: string;
  }): Promise<{ sent: number; errors: number }> {
    if (!apiInstance) {
      logger.warn("Brevo API not initialized. Skipping digest email.");
      return { sent: 0, errors: 0 };
    }

    let sent = 0;
    let errors = 0;

    for (const recipient of params.recipients) {
      try {
        const htmlContent = this.generateDigestEmailHTML({
          recipientName: recipient.name || "User",
          title: params.title,
          intro: params.intro,
          columns: params.columns,
          rows: params.rows,
          ...(params.hasMore ? { hasMore: params.hasMore } : {}),
          ...(params.actionUrl ? { actionUrl: params.actionUrl } : {}),
          ...(params.actionLabel ? { actionLabel: params.actionLabel } : {}),
        });

        const sendSmtpEmail = new brevo.SendSmtpEmail();
        sendSmtpEmail.sender = { name: senderName, email: senderEmail };
        sendSmtpEmail.to = [{ email: recipient.email, name: recipient.name }];
        sendSmtpEmail.subject = `[T3 Mechanical] ${params.title}`;
        sendSmtpEmail.htmlContent = htmlContent;

        await apiInstance.sendTransacEmail(sendSmtpEmail);
        logger.info(`✅ Digest email sent to ${recipient.email}`);
        sent++;
      } catch (error: any) {
        logger.error(`❌ Failed to send digest email to ${recipient.email}:`, error);
        errors++;
      }
    }

    return { sent, errors };
  }

  private generateDigestEmailHTML(params: {
    recipientName: string;
    title: string;
    intro: string;
    columns: string[];
    rows: string[][];
    hasMore?: boolean;
    actionUrl?: string;
    actionLabel?: string;
  }): string {
    const { recipientName, title, intro, columns, rows, hasMore, actionUrl, actionLabel } = params;

    const theadCells = columns
      .map(
        (c) =>
          `<th style="padding:10px 14px;text-align:left;color:#ffffff;font-weight:600;white-space:nowrap;font-size:12px;">${c}</th>`,
      )
      .join("");

    const tbodyRows = rows
      .map((row, i) => {
        const cells = row
          .map(
            (cell) =>
              `<td style="padding:9px 14px;color:#333333;border-bottom:1px solid #F0F0F0;font-size:13px;">${cell ?? "—"}</td>`,
          )
          .join("");
        return `<tr style="background-color:${i % 2 === 0 ? "#ffffff" : "#F9F9F9"};">${cells}</tr>`;
      })
      .join("");

    const moreNote = hasMore
      ? `<p style="font-size:12px;color:#888888;margin-top:8px;">Showing top 50 records. Check your dashboard for the full list.</p>`
      : "";

    const buttonHtml = actionUrl
      ? `<div style="text-align:center;margin-top:28px;"><a href="${process.env.CLIENT_URL ?? ""}${actionUrl}" style="display:inline-block;padding:13px 32px;background-color:#46931f;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">${actionLabel ?? "View Dashboard"}</a></div>`
      : "";

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;line-height:1.6;color:#000000;background-color:#F4F4F5;margin:0;padding:0;">
  <div style="max-width:700px;margin:40px auto;background-color:#ffffff;border-radius:16px;box-shadow:0 2px 8px rgba(0,0,0,0.08);overflow:hidden;">

    <div style="background-color:#CC1F1F;padding:28px 30px;text-align:center;">
      ${logoHeader}
    </div>

    <div style="background-color:#F9F9F9;padding:18px 30px;border-bottom:1px solid #EBEBEB;">
      <h2 style="margin:0;font-size:18px;font-weight:700;color:#111111;">${title}</h2>
    </div>

    <div style="padding:32px 30px 24px;">
      <p style="font-size:15px;margin-bottom:16px;color:#111111;">Hi <strong>${recipientName}</strong>,</p>
      <p style="font-size:15px;color:#444444;margin-bottom:20px;line-height:1.8;">${intro}</p>

      <div style="overflow-x:auto;">
        <table width="100%" cellpadding="0" cellspacing="0"
          style="border-collapse:collapse;border:1px solid #E8E8E8;border-radius:8px;overflow:hidden;min-width:500px;">
          <thead>
            <tr style="background-color:#CC1F1F;">
              ${theadCells}
            </tr>
          </thead>
          <tbody>
            ${tbodyRows}
          </tbody>
        </table>
      </div>

      ${moreNote}
      ${buttonHtml}
    </div>

    <div style="background-color:#F4F4F5;padding:18px 30px;text-align:center;font-size:12px;color:#888888;border-top:1px solid #E8E8E8;">
      <p style="margin:4px 0;">This is an automated notification from <strong>T3 Mechanical</strong>.</p>
      <p style="margin:4px 0;">For questions, contact your administrator or support team.</p>
    </div>

  </div>
</body>
</html>`.trim();
  }

  /**
   * Send test email
   */
  async sendTestEmail(recipientEmail: string): Promise<boolean> {
    const testNotification: Notification = {
      id: "test-notification",
      userId: "test-user",
      category: "system",
      type: "test",
      title: "Test Notification",
      message:
        "This is a test notification from T3 Mechanical notification system. If you received this, email notifications are working correctly!",
      shortMessage: "Test notification",
      priority: "low",
      read: false,
      createdAt: new Date(),
      createdBy: null,
      additionalNotes: null,
      readAt: null,
      relatedEntityType: null,
      relatedEntityId: null,
      relatedEntityName: null,
      actionUrl: null,
      deletedAt: null,
    };

    const result = await this.sendNotificationEmail(
      recipientEmail,
      "Test User",
      testNotification,
    );

    return result.success;
  }
}
