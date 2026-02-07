import { db } from "../config/db.js";
import {
  notifications,
  notificationPreferences,
  notificationRules,
  notificationDeliveryLog,
  type Notification,
  type NewNotification,
  type NotificationRule,
  type NotificationDelivery,
  type NewNotificationDelivery,
} from "../drizzle/schema/notifications.schema.js";
import { eq, and, desc, count, isNull, gte, lte } from "drizzle-orm";
import { logger } from "../utils/logger.js";
import type {
  NotificationFilters,
  PaginatedNotifications,
  UserPreferencesData,
  CategoryPreferences,
  DeliveryChannel,
} from "../types/notification.types.js";

export class NotificationRepository {
  /**
   * Create a new notification
   */
  async createNotification(data: NewNotification): Promise<Notification> {
    try {
      const [notification] = await db
        .insert(notifications)
        .values(data)
        .returning();
      if (!notification) {
        throw new Error("Failed to create notification");
      }
      return notification;
    } catch (error) {
      logger.error("Error creating notification:", error);
      throw error;
    }
  }

  /**
   * Create multiple notifications (bulk insert)
   */
  async createNotifications(data: NewNotification[]): Promise<Notification[]> {
    try {
      const createdNotifications = await db
        .insert(notifications)
        .values(data)
        .returning();
      return createdNotifications;
    } catch (error) {
      logger.error("Error creating notifications:", error);
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
    try {
      const offset = (page - 1) * limit;
      const conditions = [
        eq(notifications.userId, userId),
        isNull(notifications.deletedAt),
      ];

      // Apply filters
      if (filters?.category) {
        conditions.push(eq(notifications.category, filters.category));
      }
      if (filters?.priority) {
        conditions.push(eq(notifications.priority, filters.priority));
      }
      if (filters?.read !== undefined) {
        conditions.push(eq(notifications.read, filters.read));
      }
      if (filters?.type) {
        conditions.push(eq(notifications.type, filters.type));
      }
      if (filters?.startDate) {
        conditions.push(gte(notifications.createdAt, filters.startDate));
      }
      if (filters?.endDate) {
        conditions.push(lte(notifications.createdAt, filters.endDate));
      }

      // Get total count
      const [countResult] = await db
        .select({ total: count() })
        .from(notifications)
        .where(and(...conditions));
      const total = countResult?.total || 0;

      // Get notifications
      const notificationsList = await db
        .select()
        .from(notifications)
        .where(and(...conditions))
        .orderBy(desc(notifications.createdAt))
        .limit(limit)
        .offset(offset);

      const totalPages = Math.ceil(total / limit);

      return {
        notifications: notificationsList,
        total,
        page,
        limit,
        totalPages,
        hasMore: page < totalPages,
      };
    } catch (error) {
      logger.error("Error getting user notifications:", error);
      throw error;
    }
  }

  /**
   * Get notification by ID
   */
  async getNotificationById(
    notificationId: string,
    userId: string
  ): Promise<Notification | null> {
    try {
      const [notification] = await db
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.id, notificationId),
            eq(notifications.userId, userId),
            isNull(notifications.deletedAt)
          )
        )
        .limit(1);

      return notification || null;
    } catch (error) {
      logger.error("Error getting notification by ID:", error);
      throw error;
    }
  }

  /**
   * Get unread count for user
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const [countResult] = await db
        .select({ unreadCount: count() })
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, userId),
            eq(notifications.read, false),
            isNull(notifications.deletedAt)
          )
        );

      return countResult?.unreadCount || 0;
    } catch (error) {
      logger.error("Error getting unread count:", error);
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    try {
      await db
        .update(notifications)
        .set({ read: true, readAt: new Date() })
        .where(
          and(
            eq(notifications.id, notificationId),
            eq(notifications.userId, userId)
          )
        );
    } catch (error) {
      logger.error("Error marking notification as read:", error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read for user
   */
  async markAllAsRead(userId: string): Promise<void> {
    try {
      await db
        .update(notifications)
        .set({ read: true, readAt: new Date() })
        .where(
          and(
            eq(notifications.userId, userId),
            eq(notifications.read, false),
            isNull(notifications.deletedAt)
          )
        );
    } catch (error) {
      logger.error("Error marking all notifications as read:", error);
      throw error;
    }
  }

  /**
   * Delete notification (soft delete)
   */
  async deleteNotification(
    notificationId: string,
    userId: string
  ): Promise<void> {
    try {
      await db
        .update(notifications)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(notifications.id, notificationId),
            eq(notifications.userId, userId)
          )
        );
    } catch (error) {
      logger.error("Error deleting notification:", error);
      throw error;
    }
  }

  /**
   * Get user's notification preferences
   */
  async getPreferences(userId: string): Promise<UserPreferencesData> {
    try {
      const [preference] = await db
        .select()
        .from(notificationPreferences)
        .where(eq(notificationPreferences.userId, userId))
        .limit(1);

      if (!preference) {
        // Return default preferences
        return this.getDefaultPreferences();
      }

      return preference.preferences as unknown as UserPreferencesData;
    } catch (error) {
      logger.error("Error getting notification preferences:", error);
      throw error;
    }
  }

  /**
   * Get default notification preferences
   */
  private getDefaultPreferences(): UserPreferencesData {
    const defaultCategoryPrefs: CategoryPreferences = {
      inApp: true,
      email: true,
      sms: false,
    };

    return {
      job: defaultCategoryPrefs,
      dispatch: { ...defaultCategoryPrefs, sms: true },
      financial: defaultCategoryPrefs,
      expense: { ...defaultCategoryPrefs, email: false },
      timesheet: defaultCategoryPrefs,
      inventory: { ...defaultCategoryPrefs, email: false },
      fleet: defaultCategoryPrefs,
      safety: { ...defaultCategoryPrefs, sms: true },
      system: { ...defaultCategoryPrefs, email: false },
    };
  }

  /**
   * Update user's notification preferences
   */
  async updatePreferences(
    userId: string,
    preferences: Partial<UserPreferencesData>
  ): Promise<void> {
    try {
      // Check if preferences exist
      const [existing] = await db
        .select()
        .from(notificationPreferences)
        .where(eq(notificationPreferences.userId, userId))
        .limit(1);

      if (existing) {
        // Update existing preferences
        const currentPrefs = existing.preferences as unknown as UserPreferencesData;
        const updatedPrefs = { ...currentPrefs, ...preferences };

        await db
          .update(notificationPreferences)
          .set({
            preferences: updatedPrefs as any,
            updatedAt: new Date(),
          })
          .where(eq(notificationPreferences.userId, userId));
      } else {
        // Create new preferences
        const defaultPrefs = this.getDefaultPreferences();
        const newPrefs = { ...defaultPrefs, ...preferences };

        await db.insert(notificationPreferences).values({
          userId,
          preferences: newPrefs as any,
        });
      }
    } catch (error) {
      logger.error("Error updating notification preferences:", error);
      throw error;
    }
  }

  /**
   * Get notification rule by event type
   */
  async getRuleByEventType(eventType: string): Promise<NotificationRule | null> {
    try {
      const [rule] = await db
        .select()
        .from(notificationRules)
        .where(
          and(
            eq(notificationRules.eventType, eventType),
            eq(notificationRules.enabled, true)
          )
        )
        .limit(1);

      return rule || null;
    } catch (error) {
      logger.error("Error getting notification rule:", error);
      throw error;
    }
  }

  /**
   * Get all notification rules
   */
  async getAllRules(): Promise<NotificationRule[]> {
    try {
      const rules = await db.select().from(notificationRules);
      return rules;
    } catch (error) {
      logger.error("Error getting all notification rules:", error);
      throw error;
    }
  }

  /**
   * Create notification rule
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
  }): Promise<NotificationRule> {
    try {
      const [rule] = await db
        .insert(notificationRules)
        .values({
          ...data,
          recipientRoles: data.recipientRoles as any,
          channels: data.channels as any,
          conditions: data.conditions as any,
        })
        .returning();

      if (!rule) {
        throw new Error("Failed to create notification rule");
      }

      return rule;
    } catch (error) {
      logger.error("Error creating notification rule:", error);
      throw error;
    }
  }

  /**
   * Update notification rule
   */
  async updateRule(
    ruleId: string,
    data: Partial<NotificationRule>
  ): Promise<void> {
    try {
      await db
        .update(notificationRules)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(notificationRules.id, ruleId));
    } catch (error) {
      logger.error("Error updating notification rule:", error);
      throw error;
    }
  }

  /**
   * Log notification delivery
   */
  async logDelivery(
    data: NewNotificationDelivery
  ): Promise<NotificationDelivery> {
    try {
      const [delivery] = await db
        .insert(notificationDeliveryLog)
        .values(data)
        .returning();

      if (!delivery) {
        throw new Error("Failed to log notification delivery");
      }

      return delivery;
    } catch (error) {
      logger.error("Error logging notification delivery:", error);
      throw error;
    }
  }

  /**
   * Update delivery status
   */
  async updateDeliveryStatus(
    deliveryId: string,
    status: "sent" | "failed" | "bounced",
    response?: string,
    errorMessage?: string
  ): Promise<void> {
    try {
      const updateData: any = { status };

      if (status === "sent") {
        updateData.sentAt = new Date();
      } else if (status === "failed") {
        updateData.failedAt = new Date();
      }

      if (response) {
        updateData.providerResponse = response;
      }

      if (errorMessage) {
        updateData.errorMessage = errorMessage;
      }

      await db
        .update(notificationDeliveryLog)
        .set(updateData)
        .where(eq(notificationDeliveryLog.id, deliveryId));
    } catch (error) {
      logger.error("Error updating delivery status:", error);
      throw error;
    }
  }

  /**
   * Get delivery logs for notification
   */
  async getDeliveryLogs(
    notificationId: string
  ): Promise<NotificationDelivery[]> {
    try {
      const logs = await db
        .select()
        .from(notificationDeliveryLog)
        .where(eq(notificationDeliveryLog.notificationId, notificationId));

      return logs;
    } catch (error) {
      logger.error("Error getting delivery logs:", error);
      throw error;
    }
  }

  /**
   * Clean old notifications (data retention)
   */
  async cleanOldNotifications(daysToKeep: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await db
        .update(notifications)
        .set({ deletedAt: new Date() })
        .where(
          and(
            lte(notifications.createdAt, cutoffDate),
            isNull(notifications.deletedAt)
          )
        );

      // @ts-ignore - result may have rowCount
      const deletedCount = result.rowCount || 0;
      logger.info(`Cleaned ${deletedCount} old notifications`);
      return deletedCount;
    } catch (error) {
      logger.error("Error cleaning old notifications:", error);
      throw error;
    }
  }
}
