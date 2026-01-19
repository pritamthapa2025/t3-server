import {
  pgSchema,
  uuid,
  serial,
  text,
  varchar,
  boolean,
  timestamp,
  primaryKey,
  integer,
  index,
  date,
  jsonb,
} from "drizzle-orm/pg-core";

// Import enums from centralized location
import { permissionModuleEnum } from "../enums/auth.enums.js";

export const auth = pgSchema("auth");

// Enhanced Users Table
export const users = auth.table(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    fullName: varchar("full_name", { length: 150 }).notNull(),
    email: varchar("email", { length: 150 }).notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    phone: varchar("phone", { length: 20 }),

    // Address Information
    address: text("address"),
    city: varchar("city", { length: 100 }),
    state: varchar("state", { length: 50 }),
    zipCode: varchar("zip_code", { length: 20 }),

    // Personal Information
    dateOfBirth: date("date_of_birth"),

    // Emergency Contact
    emergencyContactName: varchar("emergency_contact_name", { length: 150 }),
    emergencyContactPhone: varchar("emergency_contact_phone", { length: 20 }),

    profilePicture: varchar("profile_picture", { length: 500 }),

    // Email verification
    emailVerifiedAt: timestamp("email_verified_at"), // Better than boolean

    isActive: boolean("is_active").default(true),
    isVerified: boolean("is_verified").default(false),
    isDeleted: boolean("is_deleted").default(false),
    lastLogin: timestamp("last_login"),

    // Password change tracking
    passwordChangedAt: timestamp("password_changed_at"),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_users_id").on(table.id),
    index("idx_users_is_active").on(table.isActive),
    index("idx_users_is_deleted").on(table.isDeleted),
    index("idx_users_active_not_deleted").on(table.isActive, table.isDeleted),
    index("idx_users_city_state").on(table.city, table.state),
  ]
);

// Roles
export const roles = auth.table("roles", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  description: text("description"),
  isDeleted: boolean("is_deleted").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Enhanced Permissions with Module Categorization
export const permissions = auth.table(
  "permissions",
  {
    id: serial("id").primaryKey(),
    code: varchar("code", { length: 100 }).notNull().unique(),
    description: text("description"),
    module: permissionModuleEnum("module").notNull(), // Use enum instead of varchar
    action: varchar("action", { length: 50 }).notNull(), // create, read, update, delete, export, etc.
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_permissions_module").on(table.module),
    index("idx_permissions_action").on(table.action),
  ]
);

// Role Permissions (Many-to-Many)
export const rolePermissions = auth.table(
  "role_permissions",
  {
    roleId: integer("role_id")
      .notNull()
      .references(() => roles.id),
    permissionId: integer("permission_id")
      .notNull()
      .references(() => permissions.id),
  },
  (table) => [primaryKey({ columns: [table.roleId, table.permissionId] })]
);

// User Roles (One user, one role - many users can share same role)
export const userRoles = auth.table("user_roles", {
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id)
    .primaryKey(), // One user can have only one role
  roleId: integer("role_id")
    .notNull()
    .references(() => roles.id), // Same role can have multiple users
});

// Trusted Devices for 2FA Skip
export const trustedDevices = auth.table(
  "trusted_devices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    deviceToken: varchar("device_token", { length: 255 }).notNull().unique(),
    deviceName: varchar("device_name", { length: 200 }), // Browser info or user-defined name
    ipAddress: varchar("ip_address", { length: 50 }),
    userAgent: text("user_agent"), // Store browser/device info
    lastUsedAt: timestamp("last_used_at").defaultNow(),
    expiresAt: timestamp("expires_at").notNull(),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_trusted_devices_user_id").on(table.userId),
    index("idx_trusted_devices_token").on(table.deviceToken),
    index("idx_trusted_devices_expires_at").on(table.expiresAt),
    index("idx_trusted_devices_active").on(table.isActive),
  ]
);

// Fixed Audit Logs
export const auditLogs = auth.table(
  "audit_logs",
  {
    id: serial("id").primaryKey(), // ✅ Fixed - Now auto-incrementing
    userId: uuid("user_id").references(() => users.id),
    eventType: varchar("event_type", { length: 100 }).notNull(),
    description: text("description"),
    ipAddress: varchar("ip_address", { length: 50 }),
    metadata: jsonb("metadata"), // Additional context
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_audit_logs_user_id").on(table.userId),
    index("idx_audit_logs_event_type").on(table.eventType),
    index("idx_audit_logs_created_at").on(table.createdAt),
  ]
);
