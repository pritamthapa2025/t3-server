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
  index,
  jsonb,
} from "drizzle-orm/pg-core";

// Import related tables
import { users } from "./auth.schema.js";
import { employees } from "./org.schema.js";
import { jobs } from "./jobs.schema.js";
import { dispatchTasks } from "./dispatch.schema.js";

// Import enums
import {
  vehicleStatusEnum,
  vehicleTypeEnum,
  maintenanceStatusEnum,
  repairStatusEnum,
  priorityEnum,
  inspectionStatusEnum,
  inspectionItemStatusEnum,
  fuelTypeEnum,
  checkInOutTypeEnum,
} from "../enums/fleet.enums.js";

const org = pgSchema("org");

/**
 * T3 internal data: Fleet, dispatch, timesheets, payroll, etc. are not scoped by
 * the organizations table. T3 is the team; data lives in employees, positions,
 * and departments (org schema). organizationId on payroll/client tables is for
 * client orgs; T3 uses a placeholder org ID where the schema requires it.
 */

/**
 * ============================================================================
 * VEHICLES TABLE
 * ============================================================================
 * Main vehicles table - Core fleet management
 */
export const vehicles = org.table(
  "vehicles",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // Vehicle Identification
    vehicleId: varchar("vehicle_id", { length: 50 }).notNull().unique(), // VEH-2025-000001 (auto-expands)

    // Basic Vehicle Info
    make: varchar("make", { length: 100 }).notNull(), // Ford, Mercedes, etc.
    model: varchar("model", { length: 100 }).notNull(), // Transit 250, Sprinter, etc.
    year: integer("year").notNull(),
    color: varchar("color", { length: 50 }),
    vin: varchar("vin", { length: 50 }), // Vehicle Identification Number
    licensePlate: varchar("license_plate", { length: 20 }).notNull(),
    type: vehicleTypeEnum("type").notNull(), // truck, van, car, specialized
    fuelType: fuelTypeEnum("fuel_type"), // gasoline, diesel, electric

    // Status & Assignment
    status: vehicleStatusEnum("status").notNull().default("active"),
    assignedToEmployeeId: integer("assigned_to_employee_id").references(
      () => employees.id,
    ), // Current driver assignment
    currentJobId: uuid("current_job_id").references(() => jobs.id), // Currently assigned job
    currentDispatchTaskId: uuid("current_dispatch_task_id").references(
      () => dispatchTasks.id,
    ), // T3 internal: link to dispatch task (no organization; data in employees/positions/departments)

    // Current Metrics
    mileage: numeric("mileage", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    fuelLevel: numeric("fuel_level", { precision: 5, scale: 2 }).default("0"), // Percentage 0-100

    // Maintenance Schedule
    lastService: date("last_service"),
    nextService: date("next_service"),
    nextServiceDue: date("next_service_due"),
    nextServiceDays: integer("next_service_days"), // Days until next service (can be negative for overdue)
    nextInspectionDue: date("next_inspection_due"),
    nextInspectionDays: integer("next_inspection_days"), // Days until next inspection
    oilChangeIntervalMiles: integer("oil_change_interval_miles"), // e.g. 5000
    tireRotationIntervalMiles: integer("tire_rotation_interval_miles"), // e.g. 7500
    brakeInspectionIntervalMiles: integer("brake_inspection_interval_miles"), // e.g. 10000
    safetyInspectionIntervalMonths: integer(
      "safety_inspection_interval_months",
    ), // e.g. 12

    // Notification Settings
    maintenanceRemindersEnabled: boolean(
      "maintenance_reminders_enabled",
    ).default(true),
    overdueRepairsAlertsEnabled: boolean(
      "overdue_repairs_alerts_enabled",
    ).default(true),
    safetyInspectionRemindersEnabled: boolean(
      "safety_inspection_reminders_enabled",
    ).default(true),

    // Financial Information - Purchase
    purchaseDate: date("purchase_date"),
    purchaseCost: numeric("purchase_cost", { precision: 15, scale: 2 }),
    dealer: varchar("dealer", { length: 255 }),
    monthlyPayment: numeric("monthly_payment", { precision: 10, scale: 2 }),
    loanBalance: numeric("loan_balance", { precision: 15, scale: 2 }),
    estimatedValue: numeric("estimated_value", { precision: 15, scale: 2 }),

    // Insurance Information
    insuranceProvider: varchar("insurance_provider", { length: 255 }),
    insurancePolicyNumber: varchar("insurance_policy_number", { length: 100 }),
    insuranceCoverage: varchar("insurance_coverage", { length: 100 }),
    insuranceExpiration: date("insurance_expiration"),
    insuranceAnnualPremium: numeric("insurance_annual_premium", {
      precision: 10,
      scale: 2,
    }),

    // Registration Information
    registrationState: varchar("registration_state", { length: 50 }),
    registrationNumber: varchar("registration_number", { length: 100 }),
    registrationExpiration: date("registration_expiration"),

    // Billing Rates (for customer billing)
    mileageRate: numeric("mileage_rate", { precision: 10, scale: 4 }).default(
      "0.67",
    ), // Default IRS standard
    vehicleDayRate: numeric("vehicle_day_rate", {
      precision: 10,
      scale: 2,
    }).default("95.00"), // Default day rate

    // Cost Per Mile (CPM) Calculation Fields
    mpg: numeric("mpg", { precision: 5, scale: 2 }), // Miles per gallon
    milesLast12Months: numeric("miles_last_12_months", {
      precision: 10,
      scale: 2,
    }).default("0"),
    serviceHistoryCostLast12Months: numeric(
      "service_history_cost_last_12_months",
      {
        precision: 15,
        scale: 2,
      },
    ).default("0"),

    // Performance Metrics
    deliveryCompleted: integer("delivery_completed").default(0), // Number of deliveries/jobs completed

    // Current Location (for GPS tracking)
    currentLocationLat: numeric("current_location_lat", {
      precision: 10,
      scale: 7,
    }),
    currentLocationLng: numeric("current_location_lng", {
      precision: 10,
      scale: 7,
    }),
    currentLocationAddress: text("current_location_address"),
    currentLocationLastUpdated: timestamp("current_location_last_updated"),

    // Media
    image: varchar("image", { length: 500 }), // Primary vehicle image URL

    // Metadata
    createdBy: uuid("created_by").references(() => users.id),
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_vehicles_status").on(table.status),
    index("idx_vehicles_type").on(table.type),
    index("idx_vehicles_assigned_employee").on(table.assignedToEmployeeId),
    index("idx_vehicles_current_job").on(table.currentJobId),
    index("idx_vehicles_license_plate").on(table.licensePlate),
    index("idx_vehicles_vin").on(table.vin),
    index("idx_vehicles_next_service").on(table.nextServiceDue),
    index("idx_vehicles_next_inspection").on(table.nextInspectionDue),
    index("idx_vehicles_is_deleted").on(table.isDeleted),
    // Composite index for active vehicles
    index("idx_vehicles_active").on(table.status, table.isDeleted),
  ],
);

/**
 * ============================================================================
 * MAINTENANCE RECORDS TABLE
 * ============================================================================
 * Scheduled and completed maintenance for vehicles
 */
export const maintenanceRecords = org.table(
  "maintenance_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    vehicleId: uuid("vehicle_id")
      .notNull()
      .references(() => vehicles.id),

    // Maintenance Details
    type: varchar("type", { length: 100 }).notNull(), // Oil Change, Tire Rotation, etc.
    description: text("description").notNull(),
    status: maintenanceStatusEnum("status").notNull().default("scheduled"),
    priority: priorityEnum("priority").default("low"),

    // Financial
    cost: numeric("cost", { precision: 15, scale: 2 }).notNull().default("0"),

    // Dates & Mileage
    date: date("date").notNull(),
    mileage: varchar("mileage", { length: 50 }), // "15,000 mi"
    scheduledDate: date("scheduled_date"),
    estimatedDuration: varchar("estimated_duration", { length: 50 }), // "2 hours", "1 day"

    // Service Provider
    vendor: varchar("vendor", { length: 255 }),
    performedBy: varchar("performed_by", { length: 255 }), // Name of person/company who performed

    // Assignment
    assignedToEmployeeId: integer("assigned_to_employee_id").references(
      () => employees.id,
    ),

    // Approval Workflow
    needsApproval: boolean("needs_approval").default(false),
    approvedBy: uuid("approved_by").references(() => users.id),
    approvedDate: timestamp("approved_date"),
    approvalComments: text("approval_comments"),
    rejectedBy: uuid("rejected_by").references(() => users.id),
    rejectedDate: timestamp("rejected_date"),
    rejectionReason: text("rejection_reason"),

    // Notes
    note: text("note"),

    // Metadata
    createdBy: uuid("created_by").references(() => users.id),
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_maintenance_vehicle").on(table.vehicleId),
    index("idx_maintenance_status").on(table.status),
    index("idx_maintenance_priority").on(table.priority),
    index("idx_maintenance_date").on(table.date),
    index("idx_maintenance_scheduled_date").on(table.scheduledDate),
    index("idx_maintenance_needs_approval").on(table.needsApproval),
    index("idx_maintenance_assigned_employee").on(table.assignedToEmployeeId),
    index("idx_maintenance_is_deleted").on(table.isDeleted),
    // Composite index for overdue maintenance
    index("idx_maintenance_overdue").on(table.status, table.scheduledDate),
  ],
);

/**
 * ============================================================================
 * REPAIR RECORDS TABLE
 * ============================================================================
 * Repairs and issues for vehicles
 */
export const repairRecords = org.table(
  "repair_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    vehicleId: uuid("vehicle_id")
      .notNull()
      .references(() => vehicles.id),

    // Repair Details
    type: varchar("type", { length: 100 }).notNull(), // Brake System Repair, Engine Diagnostics, etc.
    description: text("description").notNull(),
    status: repairStatusEnum("status").notNull().default("scheduled"),
    priority: priorityEnum("priority").notNull().default("medium"),

    // Financial
    cost: numeric("cost", { precision: 15, scale: 2 }).notNull().default("0"),

    // Dates & Mileage
    date: date("date").notNull(),
    mileage: varchar("mileage", { length: 50 }), // "32,100 mi"
    scheduledDate: date("scheduled_date"),
    completedDate: date("completed_date"),
    estimatedDuration: varchar("estimated_duration", { length: 50 }), // "2-3 hours", "1 day"

    // Reporting & Service
    reportedBy: varchar("reported_by", { length: 255 }).notNull(), // Who reported the issue
    vendor: varchar("vendor", { length: 255 }), // Repair shop/vendor
    performedBy: varchar("performed_by", { length: 255 }), // Who performed the repair

    // Assignment
    assignedToEmployeeId: integer("assigned_to_employee_id").references(
      () => employees.id,
    ),

    // Linking
    linkedMaintenanceId: uuid("linked_maintenance_id").references(
      () => maintenanceRecords.id,
    ), // Link to related maintenance
    linkedInspectionId: uuid("linked_inspection_id").references(
      () => safetyInspections.id,
    ), // Link to inspection

    // Approval Workflow
    needsApproval: boolean("needs_approval").default(false),
    approvedBy: uuid("approved_by").references(() => users.id),
    approvedDate: timestamp("approved_date"),
    approvalComments: text("approval_comments"),
    rejectedBy: uuid("rejected_by").references(() => users.id),
    rejectedDate: timestamp("rejected_date"),
    rejectionReason: text("rejection_reason"),

    // Notes
    notes: text("notes"),

    // Metadata
    createdBy: uuid("created_by").references(() => users.id),
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_repair_vehicle").on(table.vehicleId),
    index("idx_repair_status").on(table.status),
    index("idx_repair_priority").on(table.priority),
    index("idx_repair_date").on(table.date),
    index("idx_repair_scheduled_date").on(table.scheduledDate),
    index("idx_repair_needs_approval").on(table.needsApproval),
    index("idx_repair_reported_by").on(table.reportedBy),
    index("idx_repair_assigned_employee").on(table.assignedToEmployeeId),
    index("idx_repair_linked_maintenance").on(table.linkedMaintenanceId),
    index("idx_repair_linked_inspection").on(table.linkedInspectionId),
    index("idx_repair_is_deleted").on(table.isDeleted),
    // Composite index for critical repairs
    index("idx_repair_critical").on(table.status, table.priority),
  ],
);

/**
 * ============================================================================
 * SAFETY INSPECTIONS TABLE
 * ============================================================================
 * Safety inspection records for vehicles
 */
export const safetyInspections = org.table(
  "safety_inspections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    vehicleId: uuid("vehicle_id")
      .notNull()
      .references(() => vehicles.id),

    // Inspection Details
    date: date("date").notNull(),
    mileage: varchar("mileage", { length: 50 }), // "15,200 mi"
    performedBy: varchar("performed_by", { length: 255 }),
    overallStatus: inspectionStatusEnum("overall_status").notNull(), // passed, failed, conditional_pass, scheduled, overdue
    inspectionNotes: text("inspection_notes"),

    // Inspection Data
    checklist: jsonb("checklist"), // JSON checklist data
    isTeamMember: boolean("is_team_member").notNull(),
    employeeId: integer("employee_id").references(() => employees.id),
    exteriorPhotos: jsonb("exterior_photos"), // Array of photo URLs
    interiorPhotos: jsonb("interior_photos"), // Array of photo URLs

    // Metadata
    createdBy: uuid("created_by").references(() => users.id),
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_inspections_vehicle").on(table.vehicleId),
    index("idx_inspections_date").on(table.date),
    index("idx_inspections_status").on(table.overallStatus),
    index("idx_inspections_performed_by").on(table.performedBy),
    index("idx_inspections_employee").on(table.employeeId),
    index("idx_inspections_is_team_member").on(table.isTeamMember),
    index("idx_inspections_is_deleted").on(table.isDeleted),
    // Composite index for recent inspections
    index("idx_inspections_vehicle_date").on(table.vehicleId, table.date),
  ],
);

/**
 * ============================================================================
 * SAFETY INSPECTION ITEMS TABLE
 * ============================================================================
 * Individual inspection checklist items
 */
export const safetyInspectionItems = org.table(
  "safety_inspection_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    inspectionId: uuid("inspection_id")
      .notNull()
      .references(() => safetyInspections.id),

    // Item Details
    category: varchar("category", { length: 100 }).notNull(), // Lights, Fluids, Tires, Brakes
    item: varchar("item", { length: 255 }).notNull(), // Headlights, Engine Oil, Front Left Tire, etc.
    status: inspectionItemStatusEnum("status").notNull(), // passed, failed
    notes: text("notes"),

    // Metadata
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_inspection_items_inspection").on(table.inspectionId),
    index("idx_inspection_items_category").on(table.category),
    index("idx_inspection_items_status").on(table.status),
    index("idx_inspection_items_is_deleted").on(table.isDeleted),
  ],
);

/**
 * ============================================================================
 * FUEL RECORDS TABLE
 * ============================================================================
 * Fuel purchase and tracking records
 */
export const fuelRecords = org.table(
  "fuel_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    vehicleId: uuid("vehicle_id")
      .notNull()
      .references(() => vehicles.id),

    // Fuel Details
    date: date("date").notNull(),
    odometer: numeric("odometer", { precision: 10, scale: 2 }).notNull(),
    gallons: numeric("gallons", { precision: 10, scale: 3 }).notNull(),
    costPerGallon: numeric("cost_per_gallon", {
      precision: 10,
      scale: 4,
    }).notNull(),
    totalCost: numeric("total_cost", { precision: 15, scale: 2 }).notNull(),

    // Location & Type
    location: varchar("location", { length: 255 }), // Gas station name/location
    fuelType: fuelTypeEnum("fuel_type").notNull(), // gasoline, diesel, electric

    // Employee Tracking
    employeeId: integer("employee_id").references(() => employees.id), // Who fueled
    employeeName: varchar("employee_name", { length: 255 }),

    // Notes
    notes: text("notes"),

    // Metadata
    createdBy: uuid("created_by").references(() => users.id),
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_fuel_vehicle").on(table.vehicleId),
    index("idx_fuel_date").on(table.date),
    index("idx_fuel_employee").on(table.employeeId),
    index("idx_fuel_type").on(table.fuelType),
    index("idx_fuel_is_deleted").on(table.isDeleted),
    // Composite index for vehicle fuel history
    index("idx_fuel_vehicle_date").on(table.vehicleId, table.date),
  ],
);

/**
 * ============================================================================
 * CHECK-IN/OUT RECORDS TABLE
 * ============================================================================
 * Vehicle check-in and check-out tracking
 */
export const checkInOutRecords = org.table(
  "check_in_out_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    vehicleId: uuid("vehicle_id")
      .notNull()
      .references(() => vehicles.id),

    // Record Type
    type: checkInOutTypeEnum("type").notNull(), // check_in, check_out

    // Date & Time
    date: date("date").notNull(),
    time: varchar("time", { length: 20 }), // "08:00 AM", "05:30 PM"
    timestamp: timestamp("timestamp").notNull().defaultNow(),

    // Vehicle Metrics
    odometer: numeric("odometer", { precision: 10, scale: 2 }).notNull(),
    fuelLevel: numeric("fuel_level", { precision: 5, scale: 2 }).notNull(), // Percentage

    // Job (references jobs.id)
    jobId: uuid("job_id").references(() => jobs.id),

    // Notes
    notes: text("notes"),

    // Metadata
    createdBy: uuid("created_by").references(() => users.id),
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_check_in_out_vehicle").on(table.vehicleId),
    index("idx_check_in_out_type").on(table.type),
    index("idx_check_in_out_date").on(table.date),
    index("idx_check_in_out_timestamp").on(table.timestamp),
    index("idx_check_in_out_is_deleted").on(table.isDeleted),
    // Composite index for vehicle check-in/out history
    index("idx_check_in_out_vehicle_date").on(table.vehicleId, table.date),
  ],
);

/**
 * ============================================================================
 * ASSIGNMENT HISTORY TABLE
 * ============================================================================
 * Historical record of vehicle-driver assignments
 */
export const assignmentHistory = org.table(
  "assignment_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    vehicleId: uuid("vehicle_id")
      .notNull()
      .references(() => vehicles.id),
    employeeId: integer("employee_id").references(() => employees.id), // Driver assigned for this period
    jobId: uuid("job_id").references(() => jobs.id), // Job the driver was assigned to for this period

    // Assignment Period
    startDate: date("start_date").notNull(),
    endDate: date("end_date"), // null if currently active

    // Metrics
    mileageDriven: numeric("mileage_driven", {
      precision: 10,
      scale: 2,
    }).default("0"),

    // Status
    status: varchar("status", { length: 50 }).notNull().default("active"), // active, completed

    // Metadata
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_assignment_history_vehicle").on(table.vehicleId),
    index("idx_assignment_history_employee").on(table.employeeId),
    index("idx_assignment_history_job").on(table.jobId),
    index("idx_assignment_history_status").on(table.status),
    index("idx_assignment_history_start_date").on(table.startDate),
    index("idx_assignment_history_is_deleted").on(table.isDeleted),
    // Composite index for active assignments
    index("idx_assignment_history_active").on(table.vehicleId, table.status),
  ],
);

/**
 * ============================================================================
 * VEHICLE MEDIA TABLE
 * ============================================================================
 * Photos and media files for vehicles
 */
export const vehicleMedia = org.table(
  "vehicle_media",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    vehicleId: uuid("vehicle_id")
      .notNull()
      .references(() => vehicles.id),

    // File Information
    name: varchar("name", { length: 255 }).notNull(), // File name
    type: varchar("type", { length: 100 }), // MIME type: image/jpeg, etc.
    size: numeric("size", { precision: 10, scale: 2 }), // Size in MB
    url: varchar("url", { length: 500 }), // Full URL
    thumbnailUrl: varchar("thumbnail_url", { length: 500 }), // Thumbnail URL

    // Organization
    tags: jsonb("tags"), // Array of tags: ["exterior", "front"], ["interior", "cargo"]

    // Metadata
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => users.id),
    uploadedDate: date("uploaded_date").notNull().defaultNow(),
    isStarred: boolean("is_starred").default(false),
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_vehicle_media_vehicle").on(table.vehicleId),
    index("idx_vehicle_media_type").on(table.type),
    index("idx_vehicle_media_uploaded_by").on(table.uploadedBy),
    index("idx_vehicle_media_starred").on(table.isStarred),
    index("idx_vehicle_media_is_deleted").on(table.isDeleted),
  ],
);

/**
 * ============================================================================
 * VEHICLE DOCUMENTS TABLE
 * ============================================================================
 * Documents for vehicles (registration, insurance, etc.)
 */
export const vehicleDocuments = org.table(
  "vehicle_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    vehicleId: uuid("vehicle_id")
      .notNull()
      .references(() => vehicles.id),

    // File Information
    fileName: varchar("file_name", { length: 255 }).notNull(),
    filePath: varchar("file_path", { length: 500 }).notNull(),
    fileType: varchar("file_type", { length: 50 }), // pdf, jpg, etc.
    fileSize: integer("file_size"), // Size in bytes

    // Document Classification
    documentType: varchar("document_type", { length: 50 }), // registration, insurance, maintenance_record, etc.
    description: text("description"),

    // Expiration (for time-sensitive documents)
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
    index("idx_vehicle_documents_vehicle").on(table.vehicleId),
    index("idx_vehicle_documents_type").on(table.documentType),
    index("idx_vehicle_documents_expiration").on(table.expirationDate),
    index("idx_vehicle_documents_uploaded_by").on(table.uploadedBy),
    index("idx_vehicle_documents_starred").on(table.isStarred),
    index("idx_vehicle_documents_is_deleted").on(table.isDeleted),
  ],
);

/**
 * ============================================================================
 * VEHICLE METRICS TABLE
 * ============================================================================
 * Calculated metrics and analytics for vehicles
 */
export const vehicleMetrics = org.table(
  "vehicle_metrics",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    vehicleId: uuid("vehicle_id")
      .notNull()
      .references(() => vehicles.id)
      .unique(), // One metrics record per vehicle

    // Performance Metrics
    utilizationRate: numeric("utilization_rate", {
      precision: 5,
      scale: 2,
    }).default("0"), // Percentage of days assigned
    costPerMile: numeric("cost_per_mile", { precision: 10, scale: 4 }).default(
      "0",
    ), // Total costs / miles driven
    averageMPG: numeric("average_mpg", { precision: 5, scale: 2 }).default("0"),
    maintenanceAdherence: numeric("maintenance_adherence", {
      precision: 5,
      scale: 2,
    }).default("0"), // Percentage of on-time maintenance

    // Financial Metrics
    monthlyOperatingCost: numeric("monthly_operating_cost", {
      precision: 15,
      scale: 2,
    }).default("0"), // (maintenance + fuel) / 12
    totalMilesDriven: numeric("total_miles_driven", {
      precision: 10,
      scale: 2,
    }).default("0"),
    totalFuelCost: numeric("total_fuel_cost", {
      precision: 15,
      scale: 2,
    }).default("0"),
    totalMaintenanceCost: numeric("total_maintenance_cost", {
      precision: 15,
      scale: 2,
    }).default("0"),

    // Period
    periodStart: date("period_start"), // Start of calculation period
    periodEnd: date("period_end"), // End of calculation period

    // Metadata
    isDeleted: boolean("is_deleted").default(false),
    calculatedAt: timestamp("calculated_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_vehicle_metrics_vehicle").on(table.vehicleId),
    index("idx_vehicle_metrics_period").on(table.periodStart, table.periodEnd),
    index("idx_vehicle_metrics_is_deleted").on(table.isDeleted),
  ],
);

/**
 * ============================================================================
 * VEHICLE HISTORY TABLE
 * ============================================================================
 * Audit trail for vehicle changes
 */
export const vehicleHistory = org.table(
  "vehicle_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    vehicleId: uuid("vehicle_id")
      .notNull()
      .references(() => vehicles.id),

    // Change Details
    action: varchar("action", { length: 100 }).notNull(), // status_changed, assigned, maintenance_scheduled, etc.
    fieldChanged: varchar("field_changed", { length: 100 }), // Field name that changed
    oldValue: text("old_value"),
    newValue: text("new_value"),
    description: text("description"),

    // Metadata
    performedBy: uuid("performed_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at").defaultNow(),
    // Note: History/audit tables do NOT have isDeleted - they are immutable records
  },
  (table) => [
    index("idx_vehicle_history_vehicle").on(table.vehicleId),
    index("idx_vehicle_history_action").on(table.action),
    index("idx_vehicle_history_performed_by").on(table.performedBy),
    index("idx_vehicle_history_created_at").on(table.createdAt),
    // Composite index for vehicle audit trail
    index("idx_vehicle_history_vehicle_date").on(
      table.vehicleId,
      table.createdAt,
    ),
  ],
);
