import {
  pgSchema,
  uuid,
  serial,
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
import { employees, organizations } from "./org.schema.js";

// Import enums from centralized location
import { jobStatusEnum, jobPriorityEnum } from "../enums/org.enums.js";

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
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, ),
    propertyId: uuid("property_id"), // Will reference properties from org schema
    bidId: uuid("bid_id"), // Will reference bids from bids schema

    // Basic Info
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    status: jobStatusEnum("status").notNull().default("planned"),
    priority: jobPriorityEnum("priority").notNull().default("medium"),

    // Job Type
    jobType: varchar("job_type", { length: 100 }), // Installation, Repair, Maintenance, etc.
    serviceType: varchar("service_type", { length: 100 }), // HVAC, Plumbing, etc.

    // Dates
    scheduledStartDate: date("scheduled_start_date"),
    scheduledEndDate: date("scheduled_end_date"),
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

    // Team Assignment
    projectManager: uuid("project_manager").references(() => users.id),
    leadTechnician: uuid("lead_technician").references(() => users.id),

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
    unique("unique_job_number_per_org").on(
      table.organizationId,
      table.jobNumber
    ),
    index("idx_jobs_org").on(table.organizationId),
    index("idx_jobs_property").on(table.propertyId),
    index("idx_jobs_bid").on(table.bidId),
    index("idx_jobs_status").on(table.status),
    index("idx_jobs_priority").on(table.priority),
    index("idx_jobs_scheduled_start").on(table.scheduledStartDate),
    index("idx_jobs_project_manager").on(table.projectManager),
    index("idx_jobs_lead_technician").on(table.leadTechnician),
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
      .references(() => jobs.id, ),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id, ),

    role: varchar("role", { length: 100 }), // Lead, Assistant, Specialist
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
    index("idx_job_team_role").on(table.role),
  ]
);

/**
 * Job Financial Summary Table
 * Financial tracking for individual jobs
 */
export const jobFinancialSummary = org.table(
  "job_financial_summary",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, ),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, ),
    
    contractValue: numeric("contract_value", {
      precision: 15,
      scale: 2,
    }).notNull(),
    totalInvoiced: numeric("total_invoiced", { precision: 15, scale: 2 })
      .notNull()
      .default("0"),
    totalPaid: numeric("total_paid", { precision: 15, scale: 2 })
      .notNull()
      .default("0"),
    vendorsOwed: numeric("vendors_owed", { precision: 15, scale: 2 })
      .notNull()
      .default("0"),
    laborPaidToDate: numeric("labor_paid_to_date", { precision: 15, scale: 2 })
      .notNull()
      .default("0"),
    jobCompletionRate: numeric("job_completion_rate", {
      precision: 5,
      scale: 2,
    }),
    profitability: numeric("profitability", { precision: 5, scale: 2 }),
    profitMargin: numeric("profit_margin", { precision: 5, scale: 2 }),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    unique("unique_job_financial").on(table.jobId),
    index("idx_job_financial_org").on(table.organizationId),
    index("idx_job_financial_updated").on(table.updatedAt),
  ]
);
