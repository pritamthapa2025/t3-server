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
          <td style="padding: 10px 14px; font-size: 13px; color: #111111; border-bottom: 1px solid #F0F0F0;">${value}</td>
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
