import { NotificationRepository } from "../repositories/notification.repository.js";
import { queueNotification } from "../queues/notification.queue.js";
import { sendNotificationToUser } from "../config/socket.js";
import {
  resolveRecipients,
  evaluateConditions,
  generateNotificationTitle,
  generateNotificationMessage,
  generateActionUrl,
} from "../utils/notification-helpers.js";
import { logger } from "../utils/logger.js";
import type {
  NotificationEvent,
  NotificationFilters,
  PaginatedNotifications,
  UserPreferencesData,
  DeliveryChannel,
} from "../types/notification.types.js";
import type { Notification, NewNotification } from "../drizzle/schema/notifications.schema.js";

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
    event: NotificationEvent
  ): Promise<{ createdCount: number; reason?: "no_rule" | "conditions_not_met" | "no_recipients" }> {
    try {
      logger.info(`📢 Triggering notification event: ${event.type}`);

      // 1. Get notification rule for this event type
      const rule = await this.repository.getRuleByEventType(event.type);

      if (!rule || !rule.enabled) {
        logger.warn(
          `No active notification rule found for event type: ${event.type}`
        );
        return { createdCount: 0, reason: "no_rule" };
      }

      // 2. Evaluate conditions (if any)
      const conditions = rule.conditions as any;
      if (conditions && !evaluateConditions(event.data, conditions)) {
        logger.info(
          `Conditions not met for notification event: ${event.type}`
        );
        return { createdCount: 0, reason: "conditions_not_met" };
      }

      // 3. Resolve recipients based on rule
      const recipients = await resolveRecipients(event, rule);

      if (recipients.length === 0) {
        logger.warn(`No recipients resolved for event type: ${event.type}`);
        return { createdCount: 0, reason: "no_recipients" };
      }

      logger.info(
        `Resolved ${recipients.length} recipient(s) for event: ${event.type}`
      );

      // 4. Generate notification content
      const title =
        event.data.title || generateNotificationTitle(event.type);
      const { message, shortMessage } = event.data.message
        ? {
            message: event.data.message,
            shortMessage: event.data.shortMessage || event.data.message,
          }
        : generateNotificationMessage(event.type, event.data);

      const actionUrl =
        event.data.actionUrl ||
        generateActionUrl(event.data.entityType, event.data.entityId);

      // 5. Create notifications for each recipient
      const notificationsToCreate: NewNotification[] = recipients.map(
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
        })
      );

      const createdNotifications = await this.repository.createNotifications(
        notificationsToCreate
      );

      logger.info(
        `Created ${createdNotifications.length} notification(s) in database`
      );

      // 6. Queue for delivery and send real-time updates
      const channels = (rule.channels as unknown as DeliveryChannel[]) || [];

      for (let i = 0; i < createdNotifications.length; i++) {
        const notification = createdNotifications[i];
        const recipient = recipients[i];

        if (!notification || !recipient) {
          logger.warn(`Skipping notification delivery for index ${i}: missing data`);
          continue;
        }

        // Send real-time push notification via Socket.IO (if push is enabled)
        if (channels.includes("push")) {
          sendNotificationToUser(recipient.id, notification);
        }

        // Queue for email/SMS delivery
        if (channels.includes("email") || channels.includes("sms")) {
          await queueNotification({
            userId: recipient.id,
            notificationId: notification.id,
            channels: channels.filter((c) => c !== "push"), // Email and SMS only
            data: notification,
          });
        }
      }

      logger.info(
        `✅ Successfully processed notification event: ${event.type}`
      );
      return { createdCount: createdNotifications.length };
    } catch (error) {
      logger.error(`❌ Error triggering notification event: ${event.type}`, error);
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
    filters?: NotificationFilters
  ): Promise<PaginatedNotifications> {
    return await this.repository.getUserNotifications(
      userId,
      page,
      limit,
      filters
    );
  }

  /**
   * Get notification by ID
   */
  async getNotificationById(
    notificationId: string,
    userId: string
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
    userId: string
  ): Promise<void> {
    await this.repository.deleteNotification(notificationId, userId);

    // Broadcast deletion via Socket.IO
    const { broadcastNotificationDeleted } = await import("../config/socket.js");
    broadcastNotificationDeleted(userId, notificationId);

    // Update unread count
    const newUnreadCount = await this.repository.getUnreadCount(userId);
    const { updateUnreadCount } = await import("../config/socket.js");
    updateUnreadCount(userId, newUnreadCount);
  }

  /**
   * Get user's notification preferences
   */
  async getPreferences(userId: string): Promise<UserPreferencesData> {
    return await this.repository.getPreferences(userId);
  }

  /**
   * Update user's notification preferences
   */
  async updatePreferences(
    userId: string,
    preferences: Partial<UserPreferencesData>
  ): Promise<void> {
    await this.repository.updatePreferences(userId, preferences);
  }

  /**
   * Get all notification rules (admin only)
   */
  async getAllRules() {
    return await this.repository.getAllRules();
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
