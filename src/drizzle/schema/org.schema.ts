import {
  pgSchema,
  uuid,
  serial,
  text,
  varchar,
  boolean,
  timestamp,
  integer,
  jsonb,
  numeric,
  date,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./auth.schema.js";

// Import enums from centralized location
import { accountTypeEnum, employeeStatusEnum } from "../enums/org.enums.js";

export const org = pgSchema("org");

// Departments table - T3 internal departments (not tied to client organizations)
export const departments = org.table(
  "departments",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),

    // Department leadership
    leadId: uuid("lead_id").references(() => users.id, {}),
    contactEmail: varchar("contact_email", { length: 255 }),

    // Operational details
    primaryLocation: varchar("primary_location", { length: 255 }),
    shiftCoverage: varchar("shift_coverage", { length: 100 }),
    utilization: numeric("utilization", { precision: 5, scale: 4 }), // 0.0000 to 1.0000 (0-100%)

    // Status & ordering
    isActive: boolean("is_active").default(true).notNull(),
    sortOrder: integer("sort_order"),
    isDeleted: boolean("is_deleted").default(false),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    // Unique constraint: department names must be unique across T3
    unique("unique_dept_name").on(table.name),
    // Index for active departments
    index("idx_departments_active").on(table.isActive),
    // Index for lead lookup
    index("idx_departments_lead").on(table.leadId),
    // Index for soft delete filtering
    index("idx_departments_deleted").on(table.isDeleted),
  ],
);

// Positions table
export const positions = org.table(
  "positions",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 100 }).notNull(),
    departmentId: integer("department_id").references(() => departments.id, {}),
    description: text("description"),

    // Position compensation
    payRate: numeric("pay_rate", { precision: 10, scale: 2 }).notNull(),
    payType: varchar("pay_type", { length: 20 }).notNull(), // "Hourly" | "Salary"
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),

    notes: text("notes"),

    // Status & ordering
    isActive: boolean("is_active").default(true).notNull(),
    sortOrder: integer("sort_order"),
    isDeleted: boolean("is_deleted").default(false),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    // Unique constraint: position names must be unique within the same department
    unique("unique_position_name_per_dept").on(table.name, table.departmentId),
    // Index for department positions lookup
    index("idx_positions_department").on(table.departmentId),
    // Index for active positions
    index("idx_positions_active").on(table.isActive, table.departmentId),
    // Index for soft delete filtering
    index("idx_positions_deleted").on(table.isDeleted),
  ],
);

// Enhanced Employees table - T3 internal staff
export const employees = org.table(
  "employees",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id").references(() => users.id),
    employeeId: varchar("employee_id", { length: 50 }).unique(), // T3-2025-000001 (auto-expands)

    departmentId: integer("department_id").references(() => departments.id, {}),
    positionId: integer("position_id").references(() => positions.id, {}),
    reportsTo: uuid("reports_to").references(() => users.id, {}),

    // Enhanced Date Fields
    hireDate: date("hire_date"), // Better name than startDate
    terminationDate: date("termination_date"), // Better than endDate

    // Compensation
    hourlyRate: numeric("hourly_rate", { precision: 10, scale: 2 }),
    salary: numeric("salary", { precision: 15, scale: 2 }),
    payType: varchar("pay_type", { length: 20 }), // "hourly", "salary"

    // Certifications & Skills
    certifications: jsonb("certifications"), // Array of certification objects
    skills: jsonb("skills"), // Array of skills
    licenses: jsonb("licenses"), // License numbers, expiration dates

    // Employment Type
    employmentType: varchar("employment_type", { length: 50 }), // full-time, part-time, contractor

    // Legacy fields (keep for compatibility)
    startDate: timestamp("start_date"),
    endDate: timestamp("end_date"),
    performance: integer("performance").default(0), // percentage or score
    violations: integer("violations").default(0), // number of violations
    note: jsonb("note"),
    status: employeeStatusEnum("status").notNull().default("available"),
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    unique("unique_employee_id").on(table.employeeId),
    // Enhanced indexes
    index("idx_employees_user_id").on(table.userId), // CRITICAL: Index for auth JOIN performance
    index("idx_employees_department").on(table.departmentId),
    index("idx_employees_position").on(table.positionId),
    index("idx_employees_status").on(table.status),
    index("idx_employees_reports_to").on(table.reportsTo),
    index("idx_employees_pay_type").on(table.payType),
    index("idx_employees_employment_type").on(table.employmentType),
    // Composite index for KPI queries (filters by isDeleted and status)
    index("idx_employees_deleted_status").on(table.isDeleted, table.status),
    // Composite index for active employee queries (isDeleted + user join optimization)
    index("idx_employees_deleted").on(table.isDeleted),
  ],
);

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
  isDeleted: boolean("is_deleted").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/**
 * Employee Documents Table
 * Documents for employees (resume, certifications, ID, W4, etc.)
 */
export const employeeDocuments = org.table(
  "employee_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id),

    // File Information
    fileName: varchar("file_name", { length: 255 }).notNull(),
    filePath: varchar("file_path", { length: 500 }).notNull(),
    fileType: varchar("file_type", { length: 50 }), // pdf, jpg, etc.
    fileSize: integer("file_size"), // Size in bytes

    // Document Classification
    documentType: varchar("document_type", { length: 50 }), // resume, certification, id, w4, i9, etc.
    description: text("description"),

    // Expiration (for time-sensitive documents e.g. certifications, licenses)
    expirationDate: date("expiration_date"),

    // Metadata
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => users.id),
    isStarred: boolean("is_starred").default(false),
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_employee_documents_employee").on(table.employeeId),
    index("idx_employee_documents_type").on(table.documentType),
    index("idx_employee_documents_expiration").on(table.expirationDate),
    index("idx_employee_documents_uploaded_by").on(table.uploadedBy),
    index("idx_employee_documents_starred").on(table.isStarred),
    index("idx_employee_documents_is_deleted").on(table.isDeleted),
  ],
);
