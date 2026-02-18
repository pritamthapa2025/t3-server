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
  jsonb,
} from "drizzle-orm/pg-core";

// Import related tables
import { users } from "./auth.schema.js";
import { employees, positions } from "./org.schema.js";
import { bidsTable } from "./bids.schema.js";

// Import enums from centralized location
import { jobStatusEnum } from "../enums/org.enums.js";
import { expenseCategoryEnum } from "../enums/expenses.enums.js";

const org = pgSchema("org");

/**
 * Jobs Table
 * Comprehensive job management system
 */
export const jobs: any = org.table(
  "jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobNumber: varchar("job_number", { length: 100 }).notNull(), // JOB-2025-0001 (name-year-4digit, auto-expands)

    // Relationships
    bidId: uuid("bid_id")
      .notNull()
      .references(() => bidsTable.id, { onDelete: "cascade" }), // Reference to bid - organization and property can be derived from bid

    // Basic Info
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
    deletedAt: timestamp("deleted_at"),
    deletedBy: uuid("deleted_by").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    unique("unique_job_number_per_bid").on(table.bidId, table.jobNumber),
    index("idx_jobs_bid").on(table.bidId),
    index("idx_jobs_status").on(table.status),
    index("idx_jobs_scheduled_start").on(table.scheduledStartDate),
    index("idx_jobs_is_deleted").on(table.isDeleted),
  ],
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
      .references(() => jobs.id, { onDelete: "cascade" }),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),

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
  ],
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
    taskNumber: varchar("task_number", { length: 100 }).notNull(), // TASK-2025-0001 (auto-generated, name-year-4digit)
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),

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
    index("idx_job_tasks_job_id").on(table.jobId),
    index("idx_job_tasks_status").on(table.status),
    index("idx_job_tasks_assigned_to").on(table.assignedTo),
    index("idx_job_tasks_due_date").on(table.dueDate),
  ],
);

/**
 * Task Comments Table
 * One task, many comments (referenced to job_tasks)
 */
export const taskComments = org.table(
  "task_comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobTaskId: uuid("job_task_id")
      .notNull()
      .references(() => jobTasks.id, { onDelete: "cascade" }),

    comment: text("comment").notNull(),

    createdBy: uuid("created_by").references(() => users.id),

    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_task_comments_job_task_id").on(table.jobTaskId),
    index("idx_task_comments_created_by").on(table.createdBy),
    index("idx_task_comments_is_deleted").on(table.isDeleted),
  ],
);

/**
 * Job Expenses Table
 * Actual expenses incurred on jobs (separate from budgeted materials/labor/travel)
 */
export const jobExpenses = org.table(
  "job_expenses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),

    expenseType: varchar("expense_type", { length: 100 }),
    category: expenseCategoryEnum("category").notNull(),
    description: text("description").notNull(),
    quantity: integer("quantity").default(1),
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
    index("idx_job_expenses_job_id").on(table.jobId),
    index("idx_job_expenses_type").on(table.expenseType),
    index("idx_job_expenses_date").on(table.expenseDate),
    index("idx_job_expenses_approved_by").on(table.approvedBy),
  ],
);

/**
 * Job Surveys Table
 * Survey/assessment data for a job (unit info, condition, filter/blower, cooling/heating, photos, notes, status)
 */
export const jobSurveys = org.table(
  "job_surveys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),

    // Survey Information (Create New Survey)
    buildingNumber: varchar("building_number", { length: 100 }),
    unitTagLabel: varchar("unit_tag_label", { length: 100 }),
    unitLocation: varchar("unit_location", { length: 255 }),
    technicianId: integer("technician_id").references(() => employees.id, { onDelete: "cascade" }),
    make: varchar("make", { length: 255 }),
    modelNumber: varchar("model_number", { length: 255 }),
    serialNumber: varchar("serial_number", { length: 255 }),
    systemType: varchar("system_type", { length: 100 }),
    powerStatus: varchar("power_status", { length: 100 }),
    voltagePhase: varchar("voltage_phase", { length: 100 }),

    // Unit Condition Assessment
    overallUnitCondition: varchar("overall_unit_condition", { length: 100 }),
    physicalConditionNotes: text("physical_condition_notes"),
    corrosionOrRust: boolean("corrosion_or_rust").default(false),
    debrisOrBlockage: boolean("debris_or_blockage").default(false),
    refrigerantLineCondition: varchar("refrigerant_line_condition", {
      length: 255,
    }),
    electricalComponentsCondition: varchar("electrical_components_condition", {
      length: 255,
    }),
    ductingCondition: varchar("ducting_condition", { length: 255 }),
    condensateLineCondition: varchar("condensate_line_condition", {
      length: 100,
    }),
    cabinetIntegrity: varchar("cabinet_integrity", { length: 255 }),

    // Filter Assessment & Blower Motor & Airflow
    filterPresent: boolean("filter_present").default(false),
    filterSize: varchar("filter_size", { length: 100 }),
    filterCondition: varchar("filter_condition", { length: 100 }),
    blowerMotorStatus: varchar("blower_motor_status", { length: 255 }),
    blowerMotorCondition: varchar("blower_motor_condition", { length: 255 }),
    airflowOutput: varchar("airflow_output", { length: 100 }),
    beltCondition: varchar("belt_condition", { length: 255 }),

    // Cooling Performance Data
    temperatureSplitSupplyF: numeric("temperature_split_supply_f", {
      precision: 8,
      scale: 2,
    }),
    temperatureSplitReturnF: numeric("temperature_split_return_f", {
      precision: 8,
      scale: 2,
    }),
    coolingCoilCondition: varchar("cooling_coil_condition", { length: 255 }),
    compressorStatus: varchar("compressor_status", { length: 255 }),
    refrigerantLineTemperatureF: numeric("refrigerant_line_temperature_f", {
      precision: 8,
      scale: 2,
    }),
    coolingFunctionality: varchar("cooling_functionality", { length: 100 }),

    // Heating Performance Data
    heatingFunctionality: varchar("heating_functionality", { length: 100 }),
    gasValveCondition: varchar("gas_valve_condition", { length: 255 }),
    heatingCoilCondition: varchar("heating_coil_condition", { length: 255 }),

    // Photos & Media (array of file refs/URLs), Detailed Notes, Status
    photosMedia: jsonb("photos_media"), // Array of file paths/IDs
    pros: text("pros"),
    cons: text("cons"),
    status: varchar("status", { length: 50 }).default("draft"), // draft, submitted, completed

    createdBy: uuid("created_by").references(() => users.id),
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_job_surveys_job_id").on(table.jobId),
    index("idx_job_surveys_technician").on(table.technicianId),
    index("idx_job_surveys_status").on(table.status),
    index("idx_job_surveys_is_deleted").on(table.isDeleted),
  ],
);
