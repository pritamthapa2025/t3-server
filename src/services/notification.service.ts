import { NotificationRepository } from "../repositories/notification.repository.js";
import { sendNotificationToUser } from "../config/socket.js";
import { NotificationEmailService } from "./notification-email.service.js";
import { NotificationSMSService } from "./notification-sms.service.js";
import { db } from "../config/db.js";
import { users } from "../drizzle/schema/auth.schema.js";
import { notificationDeliveryLog } from "../drizzle/schema/notifications.schema.js";
import { eq } from "drizzle-orm";
import {
  resolveRecipients,
  evaluateConditions,
  generateNotificationTitle,
  generateNotificationMessage,
  generateActionUrl,
} from "../utils/notification-helpers.js";
import { logger } from "../utils/logger.js";
import { isMandatoryNotificationEventType } from "../constants/mandatory-notification-rules.js";
import { MandatoryNotificationRuleError } from "../utils/mandatory-notification-rule.error.js";
import type {
  NotificationEvent,
  NotificationFilters,
  PaginatedNotifications,
  UserNotificationPreferencesApi,
  UserNotificationPreferencesUpdate,
  DeliveryChannel,
} from "../types/notification.types.js";
import type {
  Notification,
  NewNotification,
} from "../drizzle/schema/notifications.schema.js";

export class NotificationService {
  private repository: NotificationRepository;

  constructor() {
    this.repository = new NotificationRepository();
  }

  /**
   * Main entry point: Trigger a notification event
   * This is called when something happens in the system that requires notification
   * @returns createdCount and optional reason when 0
   */
  async triggerNotification(
    event: NotificationEvent,
  ): Promise<{
    createdCount: number;
    reason?: "no_rule" | "conditions_not_met" | "no_recipients";
  }> {
    try {
      logger.info(`📢 Triggering notification event: ${event.type}`);

      // 1. Get notification rule for this event type (only enabled rules)
      const rule = await this.repository.getRuleByEventType(event.type);

      if (!rule) {
        const anyRule =
          await this.repository.getRuleByEventTypeRegardlessOfEnabled(
            event.type,
          );
        if (anyRule && !anyRule.enabled) {
          logger.info(
            `[Notification] Skipped ${event.type}: rule exists but is disabled (ruleId=${anyRule.id})`,
          );
        } else {
          logger.warn(
            `No notification rule found for event type: ${event.type} (seed or create rule in admin)`,
          );
        }
        return { createdCount: 0, reason: "no_rule" };
      }

      // 2. Evaluate conditions (if any)
      const conditions = rule.conditions as any;
      if (conditions && !evaluateConditions(event.data, conditions)) {
        logger.info(`Conditions not met for notification event: ${event.type}`);
        return { createdCount: 0, reason: "conditions_not_met" };
      }

      // 3. Resolve recipients based on rule
      const recipients = await resolveRecipients(event, rule);

      // Separate internal (auth users) from external (client contacts, email-only)
      const internalRecipients = recipients.filter((r) => !r.isExternal);
      const externalRecipients = recipients.filter((r) => r.isExternal && r.email);

      if (internalRecipients.length === 0 && externalRecipients.length === 0) {
        logger.warn(`No recipients resolved for event type: ${event.type}`);
        return { createdCount: 0, reason: "no_recipients" };
      }

      logger.info(
        `Resolved ${internalRecipients.length} internal + ${externalRecipients.length} external recipient(s) for event: ${event.type}`,
      );

      // 4. Generate notification content
      const title = event.data.title || generateNotificationTitle(event.type);
      const { message, shortMessage } = event.data.message
        ? {
            message: event.data.message,
            shortMessage: event.data.shortMessage || event.data.message,
          }
        : generateNotificationMessage(event.type, event.data);

      const actionUrl =
        event.data.actionUrl ||
        generateActionUrl(event.data.entityType, event.data.entityId);

      // 5. Create in-app notifications only for internal (auth) recipients
      const notificationsToCreate: NewNotification[] = internalRecipients.map(
        (recipient) => ({
          userId: recipient.id,
          category: event.category,
          type: event.type,
          title,
          message,
          shortMessage,
          priority: event.priority,
          read: false,
          relatedEntityType: event.data.entityType,
          relatedEntityId: event.data.entityId,
          relatedEntityName: event.data.entityName,
          createdBy: event.triggeredBy || "System",
          actionUrl,
          additionalNotes: event.data.notes,
        }),
      );

      const createdNotifications = notificationsToCreate.length > 0
        ? await this.repository.createNotifications(notificationsToCreate)
        : [];

      logger.info(
        `Created ${createdNotifications.length} notification(s) in database`,
      );

      // 6. Deliver notifications — push instantly, email/SMS in parallel (no external queue)
      const channels = (rule.channels as unknown as DeliveryChannel[]) || [];
      const emailSmsChannels = channels.filter((c) => c !== "push");

      // Build a map from userId → notification so order never matters
      const notificationByUserId = new Map<
        string,
        (typeof createdNotifications)[number]
      >();
      for (const n of createdNotifications) {
        notificationByUserId.set(n.userId, n);
      }

      // Push — fire instantly via Socket.IO for internal recipients only
      if (channels.includes("push")) {
        for (const recipient of internalRecipients) {
          const notification = notificationByUserId.get(recipient.id);
          if (notification) sendNotificationToUser(recipient.id, notification);
        }
      }

      // Email / SMS — fire all in parallel for internal recipients
      if (emailSmsChannels.length > 0) {
        await Promise.allSettled(
          internalRecipients.map(async (recipient) => {
            const notification = notificationByUserId.get(recipient.id);
            if (!notification) {
              logger.warn(
                `No notification record for recipient ${recipient.id} — skipping`,
              );
              return;
            }
            await this.deliverToRecipient(
              recipient.id,
              notification,
              emailSmsChannels,
            );
          }),
        );
      }

      // Email-only for external client contacts (no push, no SMS, no DB record)
      if (channels.includes("email") && externalRecipients.length > 0) {
        const syntheticNotification = {
          id: "external",
          title,
          message,
          shortMessage,
          actionUrl: actionUrl ?? null,
          additionalNotes: event.data.notes ?? null,
          category: event.category,
          type: event.type,
          priority: event.priority,
          read: false,
          userId: "external",
          createdBy: event.triggeredBy || "System",
          createdAt: new Date(),
          updatedAt: new Date(),
          isDeleted: false,
          relatedEntityType: event.data.entityType ?? null,
          relatedEntityId: event.data.entityId ?? null,
          relatedEntityName: event.data.entityName ?? null,
          deletedAt: null,
        } as unknown as Notification;

        await Promise.allSettled(
          externalRecipients.map(async (recipient) => {
            try {
              const emailSvc = new NotificationEmailService();
              await emailSvc.sendNotificationEmail(
                recipient.email!,
                recipient.fullName ?? "",
                syntheticNotification,
              );
              logger.info(
                `[Deliver] ✅ External email sent to ${recipient.email} (${event.type})`,
              );
            } catch (err) {
              logger.error(
                `[Deliver] ❌ External email failed for ${recipient.email}:`,
                err,
              );
            }
          }),
        );
      }

      logger.info(
        `✅ Successfully processed notification event: ${event.type}`,
      );
      return { createdCount: createdNotifications.length + externalRecipients.length };
    } catch (error) {
      logger.error(
        `❌ Error triggering notification event: ${event.type}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get user's notifications with pagination and filters
   */
  async getUserNotifications(
    userId: string,
    page: number = 1,
    limit: number = 20,
    filters?: NotificationFilters,
  ): Promise<PaginatedNotifications> {
    return await this.repository.getUserNotifications(
      userId,
      page,
      limit,
      filters,
    );
  }

  /**
   * Get notification by ID
   */
  async getNotificationById(
    notificationId: string,
    userId: string,
  ): Promise<Notification | null> {
    return await this.repository.getNotificationById(notificationId, userId);
  }

  /**
   * Get unread count for user
   */
  async getUnreadCount(userId: string): Promise<number> {
    return await this.repository.getUnreadCount(userId);
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await this.repository.markAsRead(notificationId, userId);

    // Update unread count via Socket.IO
    const newUnreadCount = await this.repository.getUnreadCount(userId);
    const { updateUnreadCount } = await import("../config/socket.js");
    updateUnreadCount(userId, newUnreadCount);
  }

  /**
   * Mark all notifications as read for user
   */
  async markAllAsRead(userId: string): Promise<void> {
    await this.repository.markAllAsRead(userId);

    // Update unread count via Socket.IO
    const { updateUnreadCount } = await import("../config/socket.js");
    updateUnreadCount(userId, 0);
  }

  /**
   * Delete notification (soft delete)
   */
  async deleteNotification(
    notificationId: string,
    userId: string,
  ): Promise<void> {
    await this.repository.deleteNotification(notificationId, userId);

    // Broadcast deletion via Socket.IO
    const { broadcastNotificationDeleted } =
      await import("../config/socket.js");
    broadcastNotificationDeleted(userId, notificationId);

    // Update unread count
    const newUnreadCount = await this.repository.getUnreadCount(userId);
    const { updateUnreadCount } = await import("../config/socket.js");
    updateUnreadCount(userId, newUnreadCount);
  }

  /**
   * Get user's notification preferences
   */
  async getPreferences(userId: string): Promise<UserNotificationPreferencesApi> {
    return await this.repository.getPreferences(userId);
  }

  /**
   * Update user's notification preferences
   */
  async updatePreferences(
    userId: string,
    body: UserNotificationPreferencesUpdate,
  ): Promise<void> {
    await this.repository.updatePreferences(userId, body);
  }

  /**
   * Get all notification rules (admin only)
   */
  async getAllRules() {
    return await this.repository.getAllRules();
  }

  /**
   * Paginated rules for admin (search + filters).
   */
  async getRulesPage(params: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    enabled?: boolean;
    priority?: string;
  }) {
    return await this.repository.getRulesPage(params);
  }

  /**
   * Create notification rule (admin only)
   */
  async createRule(data: {
    category: string;
    eventType: string;
    description: string;
    enabled: boolean;
    priority: string;
    recipientRoles: string[];
    channels: DeliveryChannel[];
    conditions?: Record<string, any>;
  }) {
    return await this.repository.createRule(data);
  }

  /**
   * Update notification rule (admin only)
   */
  async updateRule(ruleId: string, data: any) {
    if (data && typeof data === "object" && "enabled" in data) {
      const v = (data as { enabled: unknown }).enabled;
      const disabling =
        v === false ||
        v === "false" ||
        v === 0 ||
        v === "0" ||
        (typeof v === "string" && v.toLowerCase() === "false");
      if (disabling) {
        const existing = await this.repository.getRuleById(ruleId);
        if (
          existing?.eventType &&
          isMandatoryNotificationEventType(existing.eventType)
        ) {
          throw new MandatoryNotificationRuleError();
        }
      }
    }
    await this.repository.updateRule(ruleId, data);
  }

  /**
   * Get delivery logs for notification
   */
  async getDeliveryLogs(notificationId: string) {
    return await this.repository.getDeliveryLogs(notificationId);
  }

  /**
   * Clean old notifications (scheduled task)
   */
  async cleanOldNotifications(daysToKeep: number = 90): Promise<number> {
    return await this.repository.cleanOldNotifications(daysToKeep);
  }

  /**
   * Deliver email/SMS to a single internal recipient (no queue, no retry).
   * If a channel fails it is logged as "failed" in notification_delivery_log
   * and the failure is discarded. The system will NOT attempt to resend.
   */
  private async deliverToRecipient(
    userId: string,
    notification: Notification,
    channels: DeliveryChannel[],
  ) {
    const [userRow] = await db
      .select({
        email: users.email,
        phone: users.phone,
        fullName: users.fullName,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!userRow) {
      logger.warn(`[Deliver] No user found for userId=${userId}`);
      return;
    }

    // Respect per-user channel preferences
    const prefRow = await this.repository.getPreferences(userId);
    const prefs = prefRow.preferences;
    const categoryPrefs = prefs[notification.category as keyof typeof prefs] as
      | { email?: boolean; sms?: boolean; inApp?: boolean }
      | undefined;
    const emailEnabled = categoryPrefs?.email !== false;
    const smsEnabled = categoryPrefs?.sms !== false;

    logger.info(
      `[Deliver] user=${userId} (${userRow.email}) category=${notification.category} emailEnabled=${emailEnabled} smsEnabled=${smsEnabled}`,
    );

    await Promise.allSettled([
      channels.includes("email") && userRow.email && emailEnabled
        ? (async () => {
            try {
              const emailSvc = new NotificationEmailService();
              await emailSvc.sendNotificationEmail(
                userRow.email!,
                userRow.fullName ?? "",
                notification,
              );
              logger.info(
                `[Deliver] ✅ Email sent to ${userRow.email} (notification ${notification.id})`,
              );
              await db.insert(notificationDeliveryLog).values({
                notificationId: notification.id,
                userId,
                channel: "email",
                status: "sent",
                sentAt: new Date(),
              });
            } catch (err) {
              logger.error(
                `[Deliver] ❌ Email failed for ${userRow.email}:`,
                err,
              );
              await db.insert(notificationDeliveryLog).values({
                notificationId: notification.id,
                userId,
                channel: "email",
                status: "failed",
                failedAt: new Date(),
                errorMessage: err instanceof Error ? err.message : String(err),
              });
            }
          })()
        : Promise.resolve(),

      channels.includes("sms") && userRow.phone && smsEnabled
        ? (async () => {
            try {
              const smsSvc = new NotificationSMSService();
              await smsSvc.sendNotificationSMS(
                userRow.phone!,
                userRow.fullName ?? "",
                notification,
              );
              logger.info(
                `[Deliver] ✅ SMS sent to ${userRow.phone} (notification ${notification.id})`,
              );
              await db.insert(notificationDeliveryLog).values({
                notificationId: notification.id,
                userId,
                channel: "sms",
                status: "sent",
                sentAt: new Date(),
              });
            } catch (err) {
              logger.error(
                `[Deliver] ❌ SMS failed for ${userRow.phone}:`,
                err,
              );
              await db.insert(notificationDeliveryLog).values({
                notificationId: notification.id,
                userId,
                channel: "sms",
                status: "failed",
                failedAt: new Date(),
                errorMessage: err instanceof Error ? err.message : String(err),
              });
            }
          })()
        : Promise.resolve(),
    ]);
  }

  /**
   * Get notification statistics for user
   */
  async getNotificationStats(userId: string) {
    try {
      const [allNotifications, unreadCount] = await Promise.all([
        this.repository.getUserNotifications(userId, 1, 1000), // Get up to 1000
        this.repository.getUnreadCount(userId),
      ]);

      const byCategory: Record<string, number> = {};
      const byPriority: Record<string, number> = {};
      const recentDate = new Date();
      recentDate.setHours(recentDate.getHours() - 24);
      let recentCount = 0;

      allNotifications.notifications.forEach((notif) => {
        // Count by category
        byCategory[notif.category] = (byCategory[notif.category] || 0) + 1;

        // Count by priority
        byPriority[notif.priority] = (byPriority[notif.priority] || 0) + 1;

        // Count recent (last 24 hours)
        if (new Date(notif.createdAt) >= recentDate) {
          recentCount++;
        }
      });

      return {
        totalNotifications: allNotifications.total,
        unreadCount,
        byCategory,
        byPriority,
        recentCount,
      };
    } catch (error) {
      logger.error("Error getting notification stats:", error);
      throw error;
    }
  }
}
