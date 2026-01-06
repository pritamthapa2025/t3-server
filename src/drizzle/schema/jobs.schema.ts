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
import { employees, organizations } from "./org.schema.js";
import { bidsTable } from "./bids.schema.js";

// Import enums from centralized location
import { jobStatusEnum, jobPriorityEnum, timelineStatusEnum } from "../enums/org.enums.js";

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
    bidId: uuid("bid_id").references(() => bidsTable.id, ), // Reference to bid if job was converted from bid

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
    
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    unique("unique_job_financial").on(table.jobId),
    index("idx_job_financial_org").on(table.organizationId),
    index("idx_job_financial_updated").on(table.updatedAt),
  ]
);

/**
 * Job Financial Breakdown Table
 * One-to-one financial breakdown for each job (from bid conversion or manual entry)
 */
export const jobFinancialBreakdown = org.table(
  "job_financial_breakdown",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, ),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, )
      .unique(),
    
    materialsEquipment: numeric("materials_equipment", {
      precision: 15,
      scale: 2,
    })
      .notNull()
      .default("0"),
    labor: numeric("labor", { precision: 15, scale: 2 }).notNull().default("0"),
    travel: numeric("travel", { precision: 15, scale: 2 })
      .notNull()
      .default("0"),
    operatingExpenses: numeric("operating_expenses", {
      precision: 15,
      scale: 2,
    })
      .notNull()
      .default("0"),
    totalCost: numeric("total_cost", { precision: 15, scale: 2 })
      .notNull()
      .default("0"),
    
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_job_financial_breakdown_org").on(table.organizationId),
    index("idx_job_financial_breakdown_job_id").on(table.jobId),
  ]
);

/**
 * Job Materials Table
 * One-to-many materials for each job (actual vs. budgeted)
 */
export const jobMaterials = org.table(
  "job_materials",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, ),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, ),
    
    description: text("description").notNull(),
    quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull(),
    unitCost: numeric("unit_cost", { precision: 15, scale: 2 }).notNull(),
    markup: numeric("markup", { precision: 5, scale: 2 })
      .notNull()
      .default("0"),
    totalCost: numeric("total_cost", { precision: 15, scale: 2 }).notNull(),
    
    // Track if this is actual expense or budgeted
    isActual: boolean("is_actual").default(false), // true = actual expense, false = budgeted
    
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_job_materials_org").on(table.organizationId),
    index("idx_job_materials_job_id").on(table.jobId),
    index("idx_job_materials_is_actual").on(table.isActual),
  ]
);

/**
 * Job Labor Table
 * One-to-many labor entries for each job (actual vs. budgeted)
 */
export const jobLabor = org.table(
  "job_labor",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, ),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, ),
    
    employeeId: integer("employee_id").references(() => employees.id, ),
    role: varchar("role", { length: 100 }).notNull(),
    quantity: integer("quantity").notNull(),
    days: integer("days").notNull(),
    hoursPerDay: numeric("hours_per_day", { precision: 5, scale: 2 }).notNull(),
    totalHours: numeric("total_hours", { precision: 8, scale: 2 }).notNull(),
    costRate: numeric("cost_rate", { precision: 10, scale: 2 }).notNull(),
    billableRate: numeric("billable_rate", {
      precision: 10,
      scale: 2,
    }).notNull(),
    totalCost: numeric("total_cost", { precision: 15, scale: 2 }).notNull(),
    totalPrice: numeric("total_price", { precision: 15, scale: 2 }).notNull(),
    
    // Track if this is actual expense or budgeted
    isActual: boolean("is_actual").default(false), // true = actual expense, false = budgeted
    
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_job_labor_org").on(table.organizationId),
    index("idx_job_labor_job_id").on(table.jobId),
    index("idx_job_labor_employee").on(table.employeeId),
    index("idx_job_labor_is_actual").on(table.isActual),
  ]
);

/**
 * Job Travel Table
 * One-to-many travel expenses for each job (actual vs. budgeted)
 */
export const jobTravel = org.table(
  "job_travel",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, ),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, ),
    
    employeeId: integer("employee_id").references(() => employees.id, ),
    employeeName: varchar("employee_name", { length: 255 }),
    vehicleId: uuid("vehicle_id"), // Will reference fleet/vehicles table when available
    vehicleName: varchar("vehicle_name", { length: 255 }),
    roundTripMiles: numeric("round_trip_miles", {
      precision: 10,
      scale: 2,
    }).notNull(),
    mileageRate: numeric("mileage_rate", { precision: 10, scale: 2 }).notNull(),
    vehicleDayRate: numeric("vehicle_day_rate", {
      precision: 10,
      scale: 2,
    }).notNull(),
    days: integer("days").notNull(),
    mileageCost: numeric("mileage_cost", { precision: 15, scale: 2 }).notNull(),
    vehicleCost: numeric("vehicle_cost", { precision: 15, scale: 2 }).notNull(),
    markup: numeric("markup", { precision: 5, scale: 2 })
      .notNull()
      .default("0"),
    totalCost: numeric("total_cost", { precision: 15, scale: 2 }).notNull(),
    totalPrice: numeric("total_price", { precision: 15, scale: 2 }).notNull(),
    
    // Track if this is actual expense or budgeted
    isActual: boolean("is_actual").default(false), // true = actual expense, false = budgeted
    
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_job_travel_org").on(table.organizationId),
    index("idx_job_travel_job_id").on(table.jobId),
    index("idx_job_travel_employee").on(table.employeeId),
    index("idx_job_travel_is_actual").on(table.isActual),
  ]
);

/**
 * Job Operating Expenses Table
 * One-to-one operating expenses calculation for each job
 */
export const jobOperatingExpenses = org.table(
  "job_operating_expenses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, ),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, )
      .unique(),
    
    enabled: boolean("enabled").default(false),
    grossRevenuePreviousYear: numeric("gross_revenue_previous_year", {
      precision: 15,
      scale: 2,
    }).default("0"),
    currentJobAmount: numeric("current_job_amount", {
      precision: 15,
      scale: 2,
    }).default("0"),
    operatingCostPreviousYear: numeric("operating_cost_previous_year", {
      precision: 15,
      scale: 2,
    }).default("0"),
    inflationAdjustedOperatingCost: numeric(
      "inflation_adjusted_operating_cost",
      { precision: 15, scale: 2 }
    ).default("0"),
    inflationRate: numeric("inflation_rate", {
      precision: 5,
      scale: 2,
    }).default("0"),
    utilizationPercentage: numeric("utilization_percentage", {
      precision: 5,
      scale: 2,
    }).default("0"),
    calculatedOperatingCost: numeric("calculated_operating_cost", {
      precision: 15,
      scale: 2,
    }).default("0"),
    applyMarkup: boolean("apply_markup").default(false),
    markupPercentage: numeric("markup_percentage", {
      precision: 5,
      scale: 2,
    }).default("0"),
    operatingPrice: numeric("operating_price", {
      precision: 15,
      scale: 2,
    }).default("0"),
    
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_job_operating_org").on(table.organizationId),
    index("idx_job_operating_job_id").on(table.jobId),
  ]
);

/**
 * Job Timeline Table
 * Timeline and milestones for jobs
 */
export const jobTimeline = org.table(
  "job_timeline",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, ),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, ),
    
    event: varchar("event", { length: 255 }).notNull(),
    eventDate: timestamp("event_date").notNull(),
    status: timelineStatusEnum("status").notNull().default("pending"),
    description: text("description"),
    sortOrder: integer("sort_order").default(0),
    createdBy: uuid("created_by").references(() => users.id, ),
    
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_job_timeline_org").on(table.organizationId),
    index("idx_job_timeline_job_id").on(table.jobId),
    index("idx_job_timeline_status").on(table.status),
    index("idx_job_timeline_event_date").on(table.eventDate),
  ]
);

/**
 * Job Documents Table
 * Documents associated with jobs
 */
export const jobDocuments = org.table(
  "job_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, ),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, ),
    
    fileName: varchar("file_name", { length: 255 }).notNull(),
    filePath: varchar("file_path", { length: 500 }).notNull(),
    fileType: varchar("file_type", { length: 50 }),
    fileSize: integer("file_size"),
    documentType: varchar("document_type", { length: 50 }), // invoice, photo, report, permit, etc.
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => users.id, ),
    
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_job_documents_org").on(table.organizationId),
    index("idx_job_documents_job_id").on(table.jobId),
    index("idx_job_documents_type").on(table.documentType),
    index("idx_job_documents_uploaded_by").on(table.uploadedBy),
  ]
);

/**
 * Job Notes Table
 * Comments and notes for jobs
 */
export const jobNotes = org.table(
  "job_notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, ),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, ),
    
    note: text("note").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, ),
    isInternal: boolean("is_internal").default(true),
    
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_job_notes_org").on(table.organizationId),
    index("idx_job_notes_job_id").on(table.jobId),
    index("idx_job_notes_created_by").on(table.createdBy),
    index("idx_job_notes_internal").on(table.isInternal),
  ]
);

/**
 * Job History Table
 * Audit trail for job changes
 */
export const jobHistory = org.table(
  "job_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, ),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, ),
    
    action: varchar("action", { length: 100 }).notNull(), // status_changed, cost_updated, assigned, etc.
    oldValue: text("old_value"),
    newValue: text("new_value"),
    description: text("description"),
    performedBy: uuid("performed_by")
      .notNull()
      .references(() => users.id, ),
    
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_job_history_org").on(table.organizationId),
    index("idx_job_history_job_id").on(table.jobId),
    index("idx_job_history_performed_by").on(table.performedBy),
    index("idx_job_history_created_at").on(table.createdAt),
    index("idx_job_history_action").on(table.action),
  ]
);

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
      .references(() => organizations.id, ),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, ),
    
    taskName: varchar("task_name", { length: 255 }).notNull(),
    description: text("description"),
    status: varchar("status", { length: 50 }).notNull().default("pending"), // pending, in_progress, completed, cancelled
    priority: varchar("priority", { length: 50 }).default("medium"), // low, medium, high, urgent
    
    assignedTo: uuid("assigned_to").references(() => users.id, ),
    dueDate: date("due_date"),
    completedDate: date("completed_date"),
    
    estimatedHours: numeric("estimated_hours", { precision: 8, scale: 2 }),
    actualHours: numeric("actual_hours", { precision: 8, scale: 2 }),
    
    sortOrder: integer("sort_order").default(0),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, ),
    
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
      .references(() => organizations.id, ),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, ),
    
    expenseType: varchar("expense_type", { length: 100 }).notNull(), // equipment_rental, permit, subcontractor, etc.
    description: text("description").notNull(),
    amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
    expenseDate: date("expense_date").notNull(),
    
    vendorName: varchar("vendor_name", { length: 255 }),
    invoiceNumber: varchar("invoice_number", { length: 100 }),
    receiptPath: varchar("receipt_path", { length: 500 }),
    
    approvedBy: uuid("approved_by").references(() => users.id, ),
    approvedAt: timestamp("approved_at"),
    
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, ),
    
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
