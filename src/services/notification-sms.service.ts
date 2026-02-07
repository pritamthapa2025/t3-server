import twilio from "twilio";
import { logger } from "../utils/logger.js";
import type { Notification } from "../types/notification.types.js";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

let twilioClient: ReturnType<typeof twilio> | null = null;

if (accountSid && authToken && twilioPhoneNumber) {
  twilioClient = twilio(accountSid, authToken);
  logger.info("✅ Twilio SMS service initialized");
} else {
  logger.warn(
    "⚠️ Twilio credentials not fully configured. SMS notifications will not be sent."
  );
}

export class NotificationSMSService {
  /**
   * Send notification SMS
   */
  async sendNotificationSMS(
    recipientPhone: string,
    recipientName: string,
    notification: Notification
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!twilioClient || !twilioPhoneNumber) {
      logger.warn("Twilio not initialized. Skipping SMS notification.");
      return { success: false, error: "SMS service not configured" };
    }

    try {
      // Clean up phone number (remove spaces, dashes)
      const cleanPhone = this.formatPhoneNumber(recipientPhone);
      
      if (!cleanPhone) {
        logger.warn(`Invalid phone number format: ${recipientPhone}`);
        return { success: false, error: "Invalid phone number format" };
      }

      // Generate SMS content (keep it short - 160 chars ideal)
      const smsBody = this.generateSMSContent(notification);

      // Send SMS via Twilio
      const message = await twilioClient.messages.create({
        body: smsBody,
        from: twilioPhoneNumber,
        to: cleanPhone,
      });

      logger.info(
        `✅ SMS sent successfully to ${recipientPhone} (SID: ${message.sid})`
      );

      return { success: true, messageId: message.sid };
    } catch (error: any) {
      logger.error(`❌ Failed to send SMS to ${recipientPhone}:`, error);
      return {
        success: false,
        error: error.message || "Failed to send SMS",
      };
    }
  }

  /**
   * Format phone number to E.164 format
   */
  private formatPhoneNumber(phone: string): string | null {
    // Remove all non-numeric characters
    const cleaned = phone.replace(/\D/g, "");

    // Check if it's a valid US/Canada number (10 digits)
    if (cleaned.length === 10) {
      return `+1${cleaned}`;
    }

    // Check if it already has country code
    if (cleaned.length === 11 && cleaned.startsWith("1")) {
      return `+${cleaned}`;
    }

    // If it starts with +, assume it's already formatted
    if (phone.startsWith("+")) {
      return phone;
    }

    // Invalid format
    return null;
  }

  /**
   * Generate SMS content (short version of notification)
   */
  private generateSMSContent(notification: Notification): string {
    // SMS should be concise (160 chars ideal, 1600 max)
    let smsContent = "";

    // Priority indicator
    if (notification.priority === "high") {
      smsContent += "[URGENT] ";
    }

    // Use short message if available, otherwise truncate message
    smsContent += notification.shortMessage || notification.message;

    // Truncate if too long
    if (smsContent.length > 140) {
      smsContent = smsContent.substring(0, 137) + "...";
    }

    // Add action URL if available (shortened)
    if (notification.actionUrl) {
      const shortUrl = `${process.env.CLIENT_URL}${notification.actionUrl}`;
      // Only add if there's room
      if (smsContent.length + shortUrl.length + 10 < 160) {
        smsContent += `\n${shortUrl}`;
      }
    }

    // Add signature
    if (smsContent.length < 145) {
      smsContent += "\n- T3 Mechanical";
    }

    return smsContent;
  }

  /**
   * Send bulk SMS messages
   */
  async sendBulkSMS(
    messages: Array<{
      phone: string;
      name: string;
      notification: Notification;
    }>
  ): Promise<Array<{ phone: string; success: boolean; error?: string }>> {
    const results = [];

    for (const item of messages) {
      const result = await this.sendNotificationSMS(
        item.phone,
        item.name,
        item.notification
      );
      results.push({
        phone: item.phone,
        success: result.success,
        ...(result.error ? { error: result.error } : {}),
      });

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    return results;
  }

  /**
   * Send test SMS
   */
  async sendTestSMS(recipientPhone: string): Promise<boolean> {
    const testNotification: Notification = {
      id: "test-sms",
      userId: "test-user",
      category: "system",
      type: "test",
      title: "Test SMS",
      message: "This is a test SMS from T3 Mechanical notification system.",
      shortMessage: "Test SMS from T3 Mechanical",
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

    const result = await this.sendNotificationSMS(
      recipientPhone,
      "Test User",
      testNotification
    );

    return result.success;
  }

  /**
   * Validate phone number format
   */
  validatePhoneNumber(phone: string): boolean {
    const formatted = this.formatPhoneNumber(phone);
    return formatted !== null;
  }

  /**
   * Check Twilio account balance (optional utility)
   */
  async getAccountBalance(): Promise<{ balance: string; currency: string } | null> {
    if (!twilioClient) {
      return null;
    }

    try {
      const account = await twilioClient.api.v2010.accounts(accountSid!).fetch();
      const balance = await account.balance();
      return {
        balance: typeof balance === 'string' ? balance : "0",
        currency: (account as any).currency || "USD",
      };
    } catch (error) {
      logger.error("Error fetching Twilio account balance:", error);
      return null;
    }
  }
}
