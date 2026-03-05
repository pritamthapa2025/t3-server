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
import { jobStatusEnum, jobTaskStatusEnum } from "../enums/org.enums.js";
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
    jobNumber: varchar("job_number", { length: 100 }).notNull(),

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
    unique("unique_job_per_bid").on(table.bidId),
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
    taskNumber: varchar("task_number", { length: 100 }).notNull(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),

    taskName: varchar("task_name", { length: 255 }).notNull(),
    description: text("description"),
    status: jobTaskStatusEnum("status").notNull().default("backlog"), // backlog, in_progress, in_review, done
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
 * Job Service Calls Table
 * Execution records for service-type jobs: on-site work, diagnostics, sign-off
 */
export const jobServiceCalls = org.table(
  "job_service_calls",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),

    // Scheduling
    callDate: date("call_date"),
    technicianId: integer("technician_id").references(() => employees.id, { onDelete: "set null" }),
    timeIn: varchar("time_in", { length: 10 }),
    timeOut: varchar("time_out", { length: 10 }),
    serviceDescription: text("service_description"),

    // Equipment Tracking
    buildingNumber: varchar("building_number", { length: 100 }),
    unitTag: varchar("unit_tag", { length: 100 }),
    unitLocation: varchar("unit_location", { length: 255 }),
    make: varchar("make", { length: 255 }),
    model: varchar("model", { length: 255 }),
    serial: varchar("serial", { length: 255 }),

    // Temperature Readings
    supplyAirTemp: numeric("supply_air_temp", { precision: 8, scale: 2 }),
    returnAirTemp: numeric("return_air_temp", { precision: 8, scale: 2 }),
    ambientTemp: numeric("ambient_temp", { precision: 8, scale: 2 }),
    coolingSupplyTemp: numeric("cooling_supply_temp", { precision: 8, scale: 2 }),
    coolingReturnTemp: numeric("cooling_return_temp", { precision: 8, scale: 2 }),
    heatingSupplyTemp: numeric("heating_supply_temp", { precision: 8, scale: 2 }),
    heatingReturnTemp: numeric("heating_return_temp", { precision: 8, scale: 2 }),

    // Component Status
    blowerMotorStatus: varchar("blower_motor_status", { length: 50 }),
    compressorStatus: varchar("compressor_status", { length: 50 }),
    heatingCoilCondition: varchar("heating_coil_condition", { length: 50 }),
    coolingCoilCondition: varchar("cooling_coil_condition", { length: 50 }),
    thermostatStatus: varchar("thermostat_status", { length: 50 }),

    // System Verification Checklist
    plumbingSystemCheck: boolean("plumbing_system_check").default(false),
    thermostatCheck: boolean("thermostat_check").default(false),
    hvacSystemCheck: boolean("hvac_system_check").default(false),
    clientCommunicationCheck: boolean("client_communication_check").default(false),
    filterInspected: boolean("filter_inspected").default(false),
    electricalConnectionsCheck: boolean("electrical_connections_check").default(false),
    refrigerantLinesCheck: boolean("refrigerant_lines_check").default(false),
    safetyControlsCheck: boolean("safety_controls_check").default(false),

    // Work Documentation
    workPerformed: text("work_performed"),
    partsReplaced: text("parts_replaced"),
    issuesFound: text("issues_found"),
    recommendations: text("recommendations"),
    priorityLevel: varchar("priority_level", { length: 20 }),

    // Photos (JSON arrays of base64 data URLs or file paths)
    beforePhotos: text("before_photos"),
    afterPhotos: text("after_photos"),
    partsPhotos: text("parts_photos"),
    issuesPhotos: text("issues_photos"),

    // Customer Sign-Off
    customerSignaturePath: text("customer_signature_path"),
    customerName: varchar("customer_name", { length: 255 }),
    customerSignatureDate: date("customer_signature_date"),
    customerDeclinedSignature: boolean("customer_declined_signature").default(false),

    // Status & Metadata
    status: varchar("status", { length: 20 }).default("draft"),
    createdBy: uuid("created_by").references(() => users.id),
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_job_service_calls_job_id").on(table.jobId),
    index("idx_job_service_calls_technician").on(table.technicianId),
    index("idx_job_service_calls_status").on(table.status),
    index("idx_job_service_calls_is_deleted").on(table.isDeleted),
  ],
);

/**
 * Job PM Inspections Table
 * Execution records for preventative-maintenance jobs: unit checks, filter replacement, readings
 */
export const jobPMInspections = org.table(
  "job_pm_inspections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),

    // Unit Identification
    buildingNumber: varchar("building_number", { length: 100 }),
    unitTag: varchar("unit_tag", { length: 100 }),
    unitLocation: varchar("unit_location", { length: 255 }),
    make: varchar("make", { length: 255 }),
    model: varchar("model", { length: 255 }),
    serial: varchar("serial", { length: 255 }),

    // Cabinet / Visual Checklist (boolean)
    cabinetIntegrityCheck: boolean("cabinet_integrity_check").default(false),
    corrosionRustCheck: boolean("corrosion_rust_check").default(false),
    debrisBlockageCheck: boolean("debris_blockage_check").default(false),
    refrigerantLineCheck: boolean("refrigerant_line_check").default(false),
    electricalComponentsCheck: boolean("electrical_components_check").default(false),
    ductingConditionCheck: boolean("ducting_condition_check").default(false),
    condensateLineCheck: boolean("condensate_line_check").default(false),

    // Filter Fields
    filterPresent: boolean("filter_present").default(false),
    filterSize: varchar("filter_size", { length: 100 }),
    filterQuality: varchar("filter_quality", { length: 50 }),
    filterCondition: varchar("filter_condition", { length: 50 }),
    filterReplaced: boolean("filter_replaced").default(false),
    newFilterSize: varchar("new_filter_size", { length: 100 }),
    oldFilterPhotoUrl: text("old_filter_photo_url"),
    newFilterPhotoUrl: text("new_filter_photo_url"),

    // Temperature Readings
    coolingSupplyTemp: numeric("cooling_supply_temp", { precision: 8, scale: 2 }),
    coolingReturnTemp: numeric("cooling_return_temp", { precision: 8, scale: 2 }),
    heatingSupplyTemp: numeric("heating_supply_temp", { precision: 8, scale: 2 }),
    heatingReturnTemp: numeric("heating_return_temp", { precision: 8, scale: 2 }),
    supplyAirTemp: numeric("supply_air_temp", { precision: 8, scale: 2 }),
    returnAirTemp: numeric("return_air_temp", { precision: 8, scale: 2 }),
    ambientTemp: numeric("ambient_temp", { precision: 8, scale: 2 }),

    // Component Status
    blowerMotorStatus: varchar("blower_motor_status", { length: 50 }),
    compressorStatus: varchar("compressor_status", { length: 50 }),
    heatingCoilCondition: varchar("heating_coil_condition", { length: 50 }),
    coolingCoilCondition: varchar("cooling_coil_condition", { length: 50 }),
    thermostatStatus: varchar("thermostat_status", { length: 50 }),

    // Functionality
    coolingFunctionality: varchar("cooling_functionality", { length: 20 }),
    heatingFunctionality: varchar("heating_functionality", { length: 20 }),
    airflowOutput: varchar("airflow_output", { length: 20 }),

    // YesNoNA Additional Checks
    exhaustFansInspected: varchar("exhaust_fans_inspected", { length: 10 }),
    exhaustFanIssues: varchar("exhaust_fan_issues", { length: 10 }),
    exhaustFanIssuesDescription: text("exhaust_fan_issues_description"),
    lockingPanelInGoodCondition: varchar("locking_panel_in_good_condition", { length: 10 }),
    checkForGrimeOnExternalSurfaces: varchar("check_for_grime_on_external_surfaces", { length: 10 }),
    condensatePansCleanedProvidePhotos: varchar("condensate_pans_cleaned_provide_photos", { length: 10 }),
    compressorConnectionsProvidePhotos: varchar("compressor_connections_provide_photos", { length: 10 }),
    coilsSuppressantsApplied: varchar("coils_suppressants_applied", { length: 10 }),
    addCoilsEvapCondensatorRefrigDamaged: varchar("add_coils_evap_condensator_refrig_damaged", { length: 10 }),
    coilsCleanWithPowerWashGoodCondition: varchar("coils_clean_with_power_wash_good_condition", { length: 10 }),
    heatingAndHeatPumpOperatingBelts: varchar("heating_and_heat_pump_operating_belts", { length: 10 }),
    refrigerantLinesLeaksRepaired: varchar("refrigerant_lines_leaks_repaired", { length: 10 }),
    economizeOrExhaustDamperOpenClose: varchar("economize_or_exhaust_damper_open_close", { length: 10 }),
    supercoolWithPowerRefrigerationSafety: varchar("supercool_with_power_refrigeration_safety", { length: 10 }),
    unitSafeGoodWorkingOrder: varchar("unit_safe_good_working_order", { length: 10 }),
    hasRecommendations: boolean("has_recommendations").default(false),

    // Recommendations & Notes
    recommendationInfo: text("recommendation_info"),
    overallPhotoUrl: text("overall_photo_url"),
    inspectionNotes: text("inspection_notes"),
    issuesIdentified: text("issues_identified"),
    recommendedActions: text("recommended_actions"),
    priorityLevel: varchar("priority_level", { length: 20 }),

    // Meta
    technicianId: integer("technician_id").references(() => employees.id, { onDelete: "set null" }),
    inspectionDate: date("inspection_date"),
    status: varchar("status", { length: 20 }).default("draft"),
    createdBy: uuid("created_by").references(() => users.id),
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_job_pm_inspections_job_id").on(table.jobId),
    index("idx_job_pm_inspections_technician").on(table.technicianId),
    index("idx_job_pm_inspections_status").on(table.status),
    index("idx_job_pm_inspections_is_deleted").on(table.isDeleted),
  ],
);

/**
 * Job Plan Spec Records Table
 * Execution records for plan-spec jobs: submittals, RFIs, change orders, notes
 */
export const jobPlanSpecRecords = org.table(
  "job_plan_spec_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id"),

    // Record Type
    recordType: varchar("record_type", { length: 30 }).notNull(), // submittal | rfi | change_order | note

    // Common Fields
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    status: varchar("status", { length: 30 }).default("pending"), // pending | submitted | approved | rejected | closed
    priority: varchar("priority", { length: 20 }).default("medium"), // low | medium | high | urgent
    dateSubmitted: date("date_submitted"),
    dateRequired: date("date_required"),

    // Submittal-specific
    submittalNumber: varchar("submittal_number", { length: 100 }),
    specSection: varchar("spec_section", { length: 255 }),

    // RFI-specific
    rfiNumber: varchar("rfi_number", { length: 100 }),
    question: text("question"),
    response: text("response"),
    respondedBy: varchar("responded_by", { length: 255 }),
    respondedDate: date("responded_date"),

    // Change Order-specific
    changeOrderNumber: varchar("change_order_number", { length: 100 }),
    costImpact: numeric("cost_impact", { precision: 15, scale: 2 }),
    scheduleImpact: varchar("schedule_impact", { length: 255 }),
    approved: boolean("approved"),

    // Attachments (JSON array of file paths/URLs)
    attachments: text("attachments"),

    // Meta
    createdBy: uuid("created_by").references(() => users.id),
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_job_plan_spec_records_job_id").on(table.jobId),
    index("idx_job_plan_spec_records_type").on(table.recordType),
    index("idx_job_plan_spec_records_status").on(table.status),
    index("idx_job_plan_spec_records_is_deleted").on(table.isDeleted),
  ],
);

/**
 * Job Design Build Notes Table
 * Project notes (design phase / construction phase) for design-build jobs
 */
export const jobDesignBuildNotes = org.table(
  "job_design_build_notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id"),

    // Note fields
    date: date("date").notNull(),
    phase: varchar("phase", { length: 20 }).notNull(), // design | construction
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    photos: text("photos"), // JSON array of base64 or URLs
    status: varchar("status", { length: 20 }).default("draft"), // draft | posted

    // Author
    createdBy: uuid("created_by").references(() => users.id),
    authorName: varchar("author_name", { length: 255 }),

    // Meta
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_job_design_build_notes_job_id").on(table.jobId),
    index("idx_job_design_build_notes_phase").on(table.phase),
    index("idx_job_design_build_notes_status").on(table.status),
    index("idx_job_design_build_notes_is_deleted").on(table.isDeleted),
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
    technicianId: integer("technician_id").references(() => employees.id, { onDelete: "set null" }),
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
