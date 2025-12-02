import {
  pgSchema,
  pgTable,
  uuid,
  serial,
  text,
  varchar,
  boolean,
  timestamp,
  bigint,
  primaryKey,
  integer,
  index,
} from "drizzle-orm/pg-core";

export const auth = pgSchema("auth");

// Users
export const users = auth.table(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    fullName: varchar("full_name", { length: 150 }).notNull(),
    email: varchar("email", { length: 150 }).notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    phone: varchar("phone", { length: 20 }),
    isActive: boolean("is_active").default(true),
    isVerified: boolean("is_verified").default(false),
    isDeleted: boolean("is_deleted").default(false),
    lastLogin: timestamp("last_login"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    // Index on id for faster lookups (primary key already has index, but explicit for clarity)
    index("idx_users_id").on(table.id),
    // Index on isActive for filtering active users
    index("idx_users_is_active").on(table.isActive),
    // Index on isDeleted for filtering non-deleted users
    index("idx_users_is_deleted").on(table.isDeleted),
    // Composite index for common query pattern: active and not deleted
    index("idx_users_active_not_deleted").on(table.isActive, table.isDeleted),
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

// Permissions
export const permissions = auth.table("permissions", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 100 }).notNull().unique(),
  description: text("description"),
  module: varchar("module", { length: 50 }),
  isDeleted: boolean("is_deleted").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Role Permissions (Many-to-Many)
export const rolePermissions = auth.table(
  "role_permissions",
  {
    roleId: integer("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionId: integer("permission_id")
      .notNull()
      .references(() => permissions.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.roleId, table.permissionId] })]
);

// User Roles (Many-to-Many)
export const userRoles = auth.table(
  "user_roles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: integer("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.userId, table.roleId] })]
);

// Audit Logs
export const auditLogs = auth.table("audit_logs", {
  id: bigint("id", { mode: "number" }).primaryKey().notNull(),
  userId: uuid("user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  eventType: varchar("event_type", { length: 100 }),
  description: text("description"),
  ipAddress: varchar("ip_address", { length: 50 }),
  isDeleted: boolean("is_deleted").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});
