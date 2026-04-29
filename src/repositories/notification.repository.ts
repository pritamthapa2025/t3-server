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
import {
  eq,
  and,
  desc,
  asc,
  count,
  isNull,
  gte,
  lte,
  or,
  ilike,
  type SQL,
} from "drizzle-orm";
import { logger } from "../utils/logger.js";
import type {
  NotificationFilters,
  PaginatedNotifications,
  UserPreferencesData,
  CategoryPreferences,
  DeliveryChannel,
  FullUserPreferencesData,
  UserNotificationPreferencesApi,
  UserNotificationPreferencesUpdate,
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
  async markAllAsRead(userId: string): Promise<number> {
    try {
      const result = await db
        .update(notifications)
        .set({ read: true, readAt: new Date() })
        .where(
          and(
            eq(notifications.userId, userId),
            eq(notifications.read, false),
            isNull(notifications.deletedAt)
          )
        )
        .returning({ id: notifications.id });
      return result.length;
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
   * Merge stored JSONB with defaults so every category has inApp/email/sms.
   */
  private mergePreferenceJson(
    stored: UserPreferencesData | Record<string, unknown> | null | undefined,
  ): FullUserPreferencesData {
    const defaults = this.getDefaultPreferences() as FullUserPreferencesData;
    if (!stored || typeof stored !== "object") {
      return defaults;
    }
    const s = stored as UserPreferencesData;
    const out: FullUserPreferencesData = { ...defaults };
    (Object.keys(defaults) as (keyof FullUserPreferencesData)[]).forEach((cat) => {
      if (s[cat]) {
        out[cat] = { ...defaults[cat], ...s[cat]! };
      }
    });
    return out;
  }

  /**
   * Get user's notification preferences (JSONB + frequency columns).
   */
  async getPreferences(userId: string): Promise<UserNotificationPreferencesApi> {
    try {
      const [row] = await db
        .select()
        .from(notificationPreferences)
        .where(eq(notificationPreferences.userId, userId))
        .limit(1);

      if (!row) {
        return {
          id: "",
          userId,
          preferences: this.mergePreferenceJson({}),
          realTime: true,
          hourlyDigest: false,
          dailySummary: false,
          weeklySummary: false,
        };
      }

      return {
        id: row.id,
        userId: row.userId,
        preferences: this.mergePreferenceJson(
          row.preferences as unknown as UserPreferencesData,
        ),
        realTime: row.realTime,
        hourlyDigest: row.hourlyDigest,
        dailySummary: row.dailySummary,
        weeklySummary: row.weeklySummary,
      };
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
   * Update user's notification preferences (deep-merge categories; optional frequency columns).
   */
  async updatePreferences(
    userId: string,
    body: UserNotificationPreferencesUpdate,
  ): Promise<void> {
    try {
      const [existing] = await db
        .select()
        .from(notificationPreferences)
        .where(eq(notificationPreferences.userId, userId))
        .limit(1);

      const base = existing
        ? this.mergePreferenceJson(
            existing.preferences as unknown as UserPreferencesData,
          )
        : this.mergePreferenceJson({});

      let nextPrefs = base;
      if (body.preferences) {
        nextPrefs = { ...base };
        (Object.keys(body.preferences) as (keyof UserPreferencesData)[]).forEach(
          (cat) => {
            const patch = body.preferences![cat];
            if (patch && nextPrefs[cat]) {
              nextPrefs[cat] = { ...nextPrefs[cat], ...patch };
            }
          },
        );
      }

      const setPayload: Record<string, unknown> = {
        preferences: nextPrefs as any,
        updatedAt: new Date(),
      };
      if (body.realTime !== undefined) setPayload.realTime = body.realTime;
      if (body.hourlyDigest !== undefined) setPayload.hourlyDigest = body.hourlyDigest;
      if (body.dailySummary !== undefined) setPayload.dailySummary = body.dailySummary;
      if (body.weeklySummary !== undefined)
        setPayload.weeklySummary = body.weeklySummary;

      if (existing) {
        await db
          .update(notificationPreferences)
          .set(setPayload as any)
          .where(eq(notificationPreferences.userId, userId));
      } else {
        await db.insert(notificationPreferences).values({
          userId,
          preferences: nextPrefs as any,
          realTime: body.realTime ?? true,
          hourlyDigest: body.hourlyDigest ?? false,
          dailySummary: body.dailySummary ?? false,
          weeklySummary: body.weeklySummary ?? false,
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
   * Lookup rule by event type regardless of enabled (for logging / diagnostics).
   */
  async getRuleByEventTypeRegardlessOfEnabled(
    eventType: string,
  ): Promise<NotificationRule | null> {
    try {
      const [rule] = await db
        .select()
        .from(notificationRules)
        .where(eq(notificationRules.eventType, eventType))
        .limit(1);
      return rule || null;
    } catch (error) {
      logger.error("Error getting notification rule by event type:", error);
      throw error;
    }
  }

  async getRuleById(ruleId: string): Promise<NotificationRule | null> {
    try {
      const [rule] = await db
        .select()
        .from(notificationRules)
        .where(eq(notificationRules.id, ruleId))
        .limit(1);
      return rule || null;
    } catch (error) {
      logger.error("Error getting notification rule by id:", error);
      throw error;
    }
  }

  /**
   * Get all notification rules (no filters; prefer getRulesPage for admin UI).
   */
  async getAllRules(): Promise<NotificationRule[]> {
    try {
      const rules = await db
        .select()
        .from(notificationRules)
        .orderBy(
          asc(notificationRules.category),
          asc(notificationRules.eventType),
        );
      return rules;
    } catch (error) {
      logger.error("Error getting all notification rules:", error);
      throw error;
    }
  }

  /**
   * Paginated notification rules with optional search and filters.
   * Search matches eventType or description (case-insensitive).
   */
  async getRulesPage(params: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    enabled?: boolean;
    priority?: string;
  }): Promise<{
    rules: NotificationRule[];
    total: number;
    enabledCount: number;
    disabledCount: number;
  }> {
    try {
      const page = Math.max(1, params.page ?? 1);
      const limit = Math.min(100, Math.max(1, params.limit ?? 20));
      const offset = (page - 1) * limit;

      const conditions: SQL[] = [];
      const q = params.search?.trim();
      if (q) {
        const pattern = `%${q}%`;
        conditions.push(
          or(
            ilike(notificationRules.eventType, pattern),
            ilike(notificationRules.description, pattern),
          )!,
        );
      }
      if (params.category) {
        conditions.push(eq(notificationRules.category, params.category));
      }
      if (params.enabled !== undefined) {
        conditions.push(eq(notificationRules.enabled, params.enabled));
      }
      if (params.priority) {
        conditions.push(eq(notificationRules.priority, params.priority));
      }

      const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined;

      const orderBy = [
        asc(notificationRules.category),
        asc(notificationRules.eventType),
      ];

      const rules = whereClause
        ? await db
            .select()
            .from(notificationRules)
            .where(whereClause)
            .orderBy(...orderBy)
            .limit(limit)
            .offset(offset)
        : await db
            .select()
            .from(notificationRules)
            .orderBy(...orderBy)
            .limit(limit)
            .offset(offset);

      const countBase = db.select({ value: count() }).from(notificationRules);
      const [totalRow] = whereClause
        ? await countBase.where(whereClause)
        : await countBase;
      const total = Number(totalRow?.value ?? 0);

      const [enabledRow] = whereClause
        ? await db
            .select({ value: count() })
            .from(notificationRules)
            .where(and(whereClause, eq(notificationRules.enabled, true)))
        : await db
            .select({ value: count() })
            .from(notificationRules)
            .where(eq(notificationRules.enabled, true));
      const enabledCount = Number(enabledRow?.value ?? 0);

      const [disabledRow] = whereClause
        ? await db
            .select({ value: count() })
            .from(notificationRules)
            .where(and(whereClause, eq(notificationRules.enabled, false)))
        : await db
            .select({ value: count() })
            .from(notificationRules)
            .where(eq(notificationRules.enabled, false));
      const disabledCount = Number(disabledRow?.value ?? 0);

      return {
        rules,
        total,
        enabledCount,
        disabledCount,
      };
    } catch (error) {
      logger.error("Error getting paginated notification rules:", error);
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
   * Normalize PATCH body: only known columns, coerce `enabled` from string/boolean.
   */
  private buildRuleUpdatePayload(
    data: Record<string, unknown>,
  ): Record<string, unknown> {
    const out: Record<string, unknown> = { updatedAt: new Date() };
    const keys = [
      "enabled",
      "description",
      "priority",
      "recipientRoles",
      "channels",
      "conditions",
      "category",
      "eventType",
    ] as const;

    for (const key of keys) {
      if (!(key in data) || data[key] === undefined) continue;
      const v = data[key];
      if (key === "enabled") {
        if (typeof v === "boolean") {
          out[key] = v;
        } else if (v === "true" || v === 1 || v === "1") {
          out[key] = true;
        } else if (v === "false" || v === 0 || v === "0") {
          out[key] = false;
        } else {
          out[key] = Boolean(v);
        }
        continue;
      }
      out[key] = v;
    }
    return out;
  }

  /**
   * Update notification rule
   */
  async updateRule(ruleId: string, data: Partial<NotificationRule>): Promise<void> {
    try {
      const payload = this.buildRuleUpdatePayload(data as Record<string, unknown>);
      await db
        .update(notificationRules)
        .set(payload as any)
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
