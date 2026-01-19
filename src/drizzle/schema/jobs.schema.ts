import {
  pgSchema,
  uuid,
  text,
  varchar,
  boolean,
  timestamp,
  integer,
  numeric,
  date,
  unique,
  index,
} from "drizzle-orm/pg-core";

// Import related tables
import { users } from "./auth.schema.js";
import { organizations } from "./client.schema.js";
import { employees, positions } from "./org.schema.js";
import { bidsTable } from "./bids.schema.js";

// Import enums from centralized location
import {
  jobStatusEnum,
} from "../enums/org.enums.js";

const org = pgSchema("org");

/**
 * Jobs Table
 * Comprehensive job management system
 */
export const jobs: any = org.table(
  "jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobNumber: varchar("job_number", { length: 100 }).notNull(),

    // Relationships
    bidId: uuid("bid_id")
      .notNull()
      .references(() => bidsTable.id), // Reference to bid - organization and property can be derived from bid

    // Basic Info
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    status: jobStatusEnum("status").notNull().default("planned"),

    // Job Type
    jobType: varchar("job_type", { length: 100 }), // Installation, Repair, Maintenance, etc.
    serviceType: varchar("service_type", { length: 100 }), // HVAC, Plumbing, etc.

    // Dates
    scheduledStartDate: date("scheduled_start_date").notNull(),
    scheduledEndDate: date("scheduled_end_date").notNull(),
    actualStartDate: date("actual_start_date"),
    actualEndDate: date("actual_end_date"),

    // Location
    siteAddress: text("site_address"),
    siteContactName: varchar("site_contact_name", { length: 150 }),
    siteContactPhone: varchar("site_contact_phone", { length: 20 }),
    accessInstructions: text("access_instructions"),

    // Financial
    contractValue: numeric("contract_value", { precision: 15, scale: 2 }),
    actualCost: numeric("actual_cost", { precision: 15, scale: 2 }),

    // Completion
    completionNotes: text("completion_notes"),
    completionPercentage: numeric("completion_percentage", {
      precision: 5,
      scale: 2,
    }).default("0"),

    // Metadata
    createdBy: uuid("created_by").references(() => users.id),
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    unique("unique_job_number_per_bid").on(table.bidId, table.jobNumber),
    index("idx_jobs_bid").on(table.bidId),
    index("idx_jobs_status").on(table.status),
    index("idx_jobs_scheduled_start").on(table.scheduledStartDate),
    index("idx_jobs_is_deleted").on(table.isDeleted),
  ]
);

/**
 * Job Team Members Table
 * Many-to-many relationship between jobs and employees
 */
export const jobTeamMembers = org.table(
  "job_team_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id),

    positionId: integer("position_id").references(() => positions.id),
    assignedDate: date("assigned_date").defaultNow(),
    removedDate: date("removed_date"),

    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    unique("unique_job_employee").on(table.jobId, table.employeeId),
    index("idx_job_team_job").on(table.jobId),
    index("idx_job_team_employee").on(table.employeeId),
    index("idx_job_team_active").on(table.isActive),
    index("idx_job_team_position").on(table.positionId),
  ]
);

// jobFinancialSummary REMOVED - use bidFinancialBreakdown via job.bidId

// jobFinancialBreakdown REMOVED - get planned financial breakdown from bidFinancialBreakdown via job.bidId

// jobMaterials REMOVED - use bidMaterials via job.bidId

// jobLabor REMOVED - use bidLabor via job.bidId

// jobTravel REMOVED - use bidTravel via job.bidId

// jobOperatingExpenses REMOVED - get planned operating expenses from bidOperatingExpenses via job.bidId

// jobTimeline REMOVED - use bidTimeline via job.bidId

// jobDocuments REMOVED - use bidDocuments via job.bidId

// jobNotes REMOVED - use bidNotes via job.bidId

// jobHistory REMOVED - use bidHistory via job.bidId

/**
 * Job Tasks Table
 * Task management within jobs
 */
export const jobTasks = org.table(
  "job_tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id),

    taskName: varchar("task_name", { length: 255 }).notNull(),
    description: text("description"),
    status: varchar("status", { length: 50 }).notNull().default("pending"), // pending, in_progress, completed, cancelled
    priority: varchar("priority", { length: 50 }).default("medium"), // low, medium, high, urgent

    assignedTo: uuid("assigned_to").references(() => users.id),
    dueDate: date("due_date"),
    completedDate: date("completed_date"),

    estimatedHours: numeric("estimated_hours", { precision: 8, scale: 2 }),
    actualHours: numeric("actual_hours", { precision: 8, scale: 2 }),

    sortOrder: integer("sort_order").default(0),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),

    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_job_tasks_org").on(table.organizationId),
    index("idx_job_tasks_job_id").on(table.jobId),
    index("idx_job_tasks_status").on(table.status),
    index("idx_job_tasks_assigned_to").on(table.assignedTo),
    index("idx_job_tasks_due_date").on(table.dueDate),
  ]
);

/**
 * Job Expenses Table
 * Actual expenses incurred on jobs (separate from budgeted materials/labor/travel)
 */
export const jobExpenses = org.table(
  "job_expenses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id),

    expenseType: varchar("expense_type", { length: 100 }).notNull(), // equipment_rental, permit, subcontractor, etc.
    description: text("description").notNull(),
    amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
    expenseDate: date("expense_date").notNull(),

    vendorName: varchar("vendor_name", { length: 255 }),
    invoiceNumber: varchar("invoice_number", { length: 100 }),
    receiptPath: varchar("receipt_path", { length: 500 }),

    approvedBy: uuid("approved_by").references(() => users.id),
    approvedAt: timestamp("approved_at"),

    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),

    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_job_expenses_org").on(table.organizationId),
    index("idx_job_expenses_job_id").on(table.jobId),
    index("idx_job_expenses_type").on(table.expenseType),
    index("idx_job_expenses_date").on(table.expenseDate),
    index("idx_job_expenses_approved_by").on(table.approvedBy),
  ]
);
