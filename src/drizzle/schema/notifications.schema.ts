import {
  pgSchema,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  jsonb,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { users } from "./auth.schema.js";

export const notificationSchema = pgSchema("notifications");

// Notification Categories
export type NotificationCategory =
  | "job"
  | "dispatch"
  | "financial"
  | "expense"
  | "timesheet"
  | "inventory"
  | "fleet"
  | "safety"
  | "system";

// Notification Priority
export type NotificationPriority = "high" | "medium" | "low";

// Delivery Channels
export type DeliveryChannel = "email" | "sms" | "push";

// Main Notifications Table
export const notifications = notificationSchema.table(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    
    // Notification Content
    category: varchar("category", { length: 50 }).notNull(),
    type: varchar("type", { length: 100 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    message: text("message").notNull(),
    shortMessage: varchar("short_message", { length: 255 }),
    
    // Priority
    priority: varchar("priority", { length: 20 }).notNull().default("medium"),
    
    // Read Status
    read: boolean("read").default(false).notNull(),
    readAt: timestamp("read_at"),
    
    // Related Entity (for navigation)
    relatedEntityType: varchar("related_entity_type", { length: 50 }),
    relatedEntityId: varchar("related_entity_id", { length: 100 }),
    relatedEntityName: varchar("related_entity_name", { length: 255 }),
    
    // Metadata
    createdBy: varchar("created_by", { length: 255 }),
    actionUrl: varchar("action_url", { length: 500 }),
    additionalNotes: text("additional_notes"),
    
    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => ({
    userReadIdx: index("notifications_user_read_idx").on(
      table.userId,
      table.read,
      table.createdAt
    ),
    createdAtIdx: index("notifications_created_at_idx").on(table.createdAt),
    categoryIdx: index("notifications_category_idx").on(table.category),
    typeIdx: index("notifications_type_idx").on(table.type),
  })
);

// Notification Preferences Table
export const notificationPreferences = notificationSchema.table(
  "notification_preferences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" })
      .unique(),
    
    // Category-specific preferences (JSONB for flexibility)
    // Structure: { job: { inApp: true, email: true, sms: false }, ... }
    preferences: jsonb("preferences").notNull().default({}),
    
    // Frequency Settings
    realTime: boolean("real_time").default(true).notNull(),
    hourlyDigest: boolean("hourly_digest").default(false).notNull(),
    dailySummary: boolean("daily_summary").default(false).notNull(),
    weeklySummary: boolean("weekly_summary").default(false).notNull(),
    
    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("notification_preferences_user_idx").on(table.userId),
  })
);

// Notification Rules Table (Admin Configuration)
export const notificationRules = notificationSchema.table(
  "notification_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    
    // Rule Identification
    category: varchar("category", { length: 50 }).notNull(),
    eventType: varchar("event_type", { length: 100 }).notNull(),
    description: text("description"),
    
    // Rule Status
    enabled: boolean("enabled").default(true).notNull(),
    priority: varchar("priority", { length: 20 }).notNull(),
    
    // Recipients Configuration (JSONB)
    // Example: ["manager", "executive", "technician"]
    recipientRoles: jsonb("recipient_roles").notNull().default([]),
    
    // Channels (JSONB)
    // Example: ["email", "sms", "push"]
    channels: jsonb("channels").notNull().default([]),
    
    // Conditions (JSONB - for advanced rules)
    // Example: { "amount_threshold": 50000, "days_before": 7 }
    conditions: jsonb("conditions"),
    
    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    eventTypeIdx: index("notification_rules_event_type_idx").on(
      table.eventType
    ),
    enabledIdx: index("notification_rules_enabled_idx").on(table.enabled),
    categoryEventIdx: index("notification_rules_category_event_idx").on(
      table.category,
      table.eventType
    ),
    // Unique constraint to prevent duplicate event types
    uniqueEventType: unique("notification_rules_event_type_unique").on(
      table.eventType
    ),
  })
);

// Notification Delivery Log Table (for tracking sent emails/SMS)
export const notificationDeliveryLog = notificationSchema.table(
  "notification_delivery_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    notificationId: uuid("notification_id").references(() => notifications.id, {
      onDelete: "cascade",
    }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    
    // Delivery Details
    channel: varchar("channel", { length: 20 }).notNull(), // email, sms, push
    status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, sent, failed, bounced
    
    // Provider Response
    providerResponse: text("provider_response"),
    errorMessage: text("error_message"),
    
    // Timestamps
    sentAt: timestamp("sent_at"),
    failedAt: timestamp("failed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    notificationIdx: index("notification_delivery_log_notification_idx").on(
      table.notificationId
    ),
    statusIdx: index("notification_delivery_log_status_idx").on(table.status),
    channelIdx: index("notification_delivery_log_channel_idx").on(
      table.channel
    ),
    userIdx: index("notification_delivery_log_user_idx").on(table.userId),
  })
);

// Type Exports for TypeScript
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;

export type NotificationPreference = typeof notificationPreferences.$inferSelect;
export type NewNotificationPreference = typeof notificationPreferences.$inferInsert;

export type NotificationRule = typeof notificationRules.$inferSelect;
export type NewNotificationRule = typeof notificationRules.$inferInsert;

export type NotificationDelivery = typeof notificationDeliveryLog.$inferSelect;
export type NewNotificationDelivery = typeof notificationDeliveryLog.$inferInsert;
