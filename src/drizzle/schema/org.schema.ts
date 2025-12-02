import {
  pgSchema,
  pgTable,
  uuid,
  serial,
  text,
  varchar,
  boolean,
  timestamp,
  primaryKey,
  integer,
  jsonb,
} from "drizzle-orm/pg-core";
import { users } from "./auth.schema.js";
import { pgEnum } from "drizzle-orm/pg-core";

export const accountTypeEnum = pgEnum("account_type_enum", [
  "savings",
  "current",
  "salary",
  "checking",
  "business",
]);

export const employeeStatusEnum = pgEnum("employee_status_enum", [
  "available",
  "on_leave",
  "in_field",
  "terminated",
  "suspended",
]);

export const org = pgSchema("org");

// Departments table
export const departments = org.table("departments", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Positions table
export const positions = org.table("positions", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  departmentId: integer("department_id").references(() => departments.id, {
    onDelete: "set null",
  }),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Employees table
export const employees = org.table("employees", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  employeeId: varchar("employee_id", { length: 50 }).unique(),
  departmentId: integer("department_id").references(() => departments.id, {
    onDelete: "set null",
  }),
  positionId: integer("position_id").references(() => positions.id, {
    onDelete: "set null",
  }),
  reportsTo: uuid("reports_to").references(() => users.id, {
    onDelete: "set null",
  }),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  performance: integer("performance").default(0), // percentage or score
  violations: integer("violations").default(0), // number of violations
  status: employeeStatusEnum("status").notNull().default("available"),
  isDeleted: boolean("is_deleted").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const userBankAccounts = org.table("user_bank_accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  accountHolderName: varchar("account_holder_name", { length: 150 }).notNull(),
  bankName: varchar("bank_name", { length: 150 }).notNull(),
  accountNumber: varchar("account_number", { length: 100 }).notNull(),
  routingNumber: varchar("routing_number", { length: 100 }),
  accountType: accountTypeEnum("account_type").notNull(),
  branchName: varchar("branch_name", { length: 150 }),
  isPrimary: boolean("is_primary").default(false),
  isVerified: boolean("is_verified").default(false),
  isDeleted: boolean("is_deleted").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const employeeReviews = org.table("employee_reviews", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id), // no cascade, no null
  reviewerId: uuid("reviewer_id").references(() => users.id), // keep reviewer reference
  title: varchar("title", { length: 150 }), // e.g. "Q4 2024 Review"
  reviewDate: timestamp("review_date").defaultNow(),
  ratings: jsonb("ratings").notNull(), // All rating categories
  averageScore: varchar("average_score", { length: 10 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
