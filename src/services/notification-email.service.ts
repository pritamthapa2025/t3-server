import * as brevo from "@getbrevo/brevo";
import { logger } from "../utils/logger.js";
import type { Notification, EmailTemplateData } from "../types/notification.types.js";

const apiKey = process.env.BREVO_API_KEY;
const senderEmail = process.env.BREVO_SENDER_EMAIL || "notifications@t3mechanical.com";
const senderName = "T3 Mechanical";

if (!apiKey) {
  logger.warn("⚠️ BREVO_API_KEY not configured. Email notifications will not be sent.");
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
    notification: Notification
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!apiInstance) {
      logger.warn("Brevo API not initialized. Skipping email notification.");
      return { success: false, error: "Email service not configured" };
    }

    try {
      const actionUrl = notification.actionUrl
        ? `${process.env.CLIENT_URL}${notification.actionUrl}`
        : undefined;
      
      const templateData: EmailTemplateData = {
        recipientName: recipientName || "User",
        title: notification.title,
        message: notification.message,
        ...(actionUrl ? { actionUrl } : {}),
        ...(notification.actionUrl ? { actionText: "View Details" } : {}),
      };

      const htmlContent = this.generateEmailHTML(templateData);

      const sendSmtpEmail = new brevo.SendSmtpEmail();
      sendSmtpEmail.sender = { name: senderName, email: senderEmail };
      sendSmtpEmail.to = [{ email: recipientEmail, name: recipientName }];
      sendSmtpEmail.subject = notification.title;
      sendSmtpEmail.htmlContent = htmlContent;

      const response = await apiInstance.sendTransacEmail(sendSmtpEmail);
      const messageId = response.body?.messageId || response.body?.['messageId'];

      logger.info(
        `✅ Email sent successfully to ${recipientEmail} (MessageId: ${messageId})`
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
      background-color: #F7F7F7;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background-color: #ffffff;
      border-radius: 16px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
      overflow: hidden;
    }
    .header {
      background-color: #46931f;
      color: #ffffff;
      padding: 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
    .content {
      padding: 40px 30px;
    }
    .greeting {
      font-size: 16px;
      margin-bottom: 20px;
      color: #000000;
    }
    .message {
      font-size: 15px;
      color: #333333;
      margin-bottom: 30px;
      line-height: 1.8;
    }
    .button {
      display: inline-block;
      padding: 14px 32px;
      background-color: #46931f;
      color: #ffffff;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 15px;
      margin: 20px 0;
    }
    .button:hover {
      background-color: #3d7d1b;
    }
    .footer {
      background-color: #F7F7F7;
      padding: 20px 30px;
      text-align: center;
      font-size: 13px;
      color: #666666;
      border-top: 1px solid #E2E8F0;
    }
    .footer p {
      margin: 5px 0;
    }
    .divider {
      height: 1px;
      background-color: #E2E8F0;
      margin: 25px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>T3 Mechanical</h1>
    </div>
    <div class="content">
      <div class="greeting">
        <strong>Hi ${data.recipientName},</strong>
      </div>
      <div class="message">
        ${data.message}
      </div>
      ${
        data.actionUrl
          ? `
      <div style="text-align: center;">
        <a href="${data.actionUrl}" class="button">${data.actionText || "View Details"}</a>
      </div>
      `
          : ""
      }
    </div>
    <div class="footer">
      <p>This is an automated notification from T3 Mechanical</p>
      <p>If you have questions, please contact your administrator</p>
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
    }>
  ): Promise<Array<{ email: string; success: boolean; error?: string }>> {
    const results = [];

    for (const item of notifications) {
      const result = await this.sendNotificationEmail(
        item.email,
        item.name,
        item.notification
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
      testNotification
    );

    return result.success;
  }
}
