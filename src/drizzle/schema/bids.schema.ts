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
  time,
  unique,
  index,
} from "drizzle-orm/pg-core";

// Import related tables
import { users } from "./auth.schema.js";
import { organizations, clientContacts, properties } from "./client.schema.js";
import { employees, positions } from "./org.schema.js";
import { inventoryItems } from "./inventory.schema.js";

// Import enums from centralized location
import {
  bidStatusEnum,
  bidPriorityEnum,
  bidJobTypeEnum,
} from "../enums/org.enums.js";

const org = pgSchema("org");

/**
 * Main Bids Table
 * Central table for bid management
 */
export const bidsTable: any = org.table(
  "bids",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bidNumber: varchar("bid_number", { length: 100 }).notNull(), // BID-2025-0001 (name-year-4digit, auto-expands)

    // Basic Information
    jobType: bidJobTypeEnum("job_type").notNull(),
    status: bidStatusEnum("status").notNull().default("draft"),
    priority: bidPriorityEnum("priority").notNull().default("medium"),

    // Client
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    primaryContactId: uuid("primary_contact_id").references(
      () => clientContacts.id,
    ),
    propertyId: uuid("property_id").references(() => properties.id),

    // Project Details
    projectName: varchar("project_name", { length: 255 }).notNull(),
    siteAddress: text("site_address"),
    buildingSuiteNumber: varchar("building_suite_number", { length: 100 }),
    acrossValuations: varchar("across_valuations", { length: 255 }),
    scopeOfWork: text("scope_of_work"),
    specialRequirements: text("special_requirements"),
    description: text("description"),

    // Dates
    endDate: date("end_date"),
    plannedStartDate: date("planned_start_date"),
    estimatedCompletion: date("estimated_completion"),
    createdDate: timestamp("created_date").defaultNow(),
    removalDate: date("removal_date"),

    // Financial
    bidAmount: numeric("bid_amount", {
      precision: 15,
      scale: 2,
    })
      .notNull()
      .default("0"),
    estimatedDuration: integer("estimated_duration"), // days
    profitMargin: numeric("profit_margin", { precision: 5, scale: 2 }), // %

    // Terms & Conditions
    paymentTerms: text("payment_terms"),
    warrantyPeriod: varchar("warranty_period", { length: 50 }),
    warrantyPeriodLabor: varchar("warranty_period_labor", { length: 50 }),
    warrantyDetails: text("warranty_details"),
    specialTerms: text("special_terms"),
    exclusions: text("exclusions"),
    proposalBasis: text("proposal_basis"),
    referenceDate: varchar("reference_date", { length: 50 }),
    templateSelection: varchar("template_selection", { length: 100 }),

    // Team Assignment
    supervisorManager: integer("supervisor_manager").references(
      () => employees.id,
    ),
    primaryTechnicianId: integer("technician_id").references(
      () => employees.id,
    ),

    // Metadata
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    assignedTo: uuid("assigned_to").references(() => users.id, {}),
    qtyNumber: varchar("qty_number", { length: 50 }),
    marked: varchar("marked", { length: 20 }), // "won" | "lost"
    convertToJob: boolean("convert_to_job").default(false),

    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    // Unique constraint: bidNumber unique per organization
    unique("unique_bid_number_per_org").on(
      table.organizationId,
      table.bidNumber,
    ),
    // Indexes for performance
    index("idx_bids_org").on(table.organizationId),
    index("idx_bids_status").on(table.status),
    index("idx_bids_org_status").on(table.organizationId, table.status),
    index("idx_bids_created_by").on(table.createdBy),
    index("idx_bids_job_type").on(table.jobType),
    index("idx_bids_priority").on(table.priority),
    index("idx_bids_is_deleted").on(table.isDeleted),
    index("idx_bids_created_at").on(table.createdAt),
  ],
);

/**
 * Bid Financial Breakdown Table
 * One-to-one financial breakdown for each bid
 */
export const bidFinancialBreakdown = org.table(
  "bid_financial_breakdown",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bidId: uuid("bid_id")
      .notNull()
      .references(() => bidsTable.id)
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
    totalPrice: numeric("total_price", { precision: 15, scale: 2 })
      .notNull()
      .default("0"),
    grossProfit: numeric("gross_profit", { precision: 15, scale: 2 })
      .notNull()
      .default("0"),

    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (_table) => [],
);

/**
 * Bid Materials Table
 * One-to-many materials for each bid
 */
export const bidMaterials = org.table(
  "bid_materials",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bidId: uuid("bid_id")
      .notNull()
      .references(() => bidsTable.id),
    inventoryItemId: uuid("inventory_item_id").references(
      () => inventoryItems.id,
    ),
    customName: text("custom_name"),

    description: text("description"),
    quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull(),
    unitCost: numeric("unit_cost", { precision: 15, scale: 2 }).notNull(),
    markup: numeric("markup", { precision: 5, scale: 2 })
      .notNull()
      .default("0"),
    totalCost: numeric("total_cost", { precision: 15, scale: 2 }).notNull(),

    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [index("idx_bid_materials_bid_id").on(table.bidId)],
);

/**
 * Bid Labor Table
 * One-to-many labor entries for each bid
 */
export const bidLabor = org.table(
  "bid_labor",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bidId: uuid("bid_id")
      .notNull()
      .references(() => bidsTable.id),
    positionId: integer("position_id")
      .notNull()
      .references(() => positions.id),
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

    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_bid_labor_bid_id").on(table.bidId),
    index("idx_bid_labor_position_id").on(table.positionId),
  ],
);

/**
 * Bid Travel Table
 * One-to-many travel expenses for each bid
 */
export const bidTravel = org.table(
  "bid_travel",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bidLaborId: uuid("bid_labor_id")
      .notNull()
      .references(() => bidLabor.id),

    // Note: vehicleName removed - can be derived from bidLabor → positionId → employee → assigned vehicle
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

    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [index("idx_bid_travel_labor_id").on(table.bidLaborId)],
);

/**
 * Bid Operating Expenses Table
 * One-to-one operating expenses calculation for each bid
 */
export const bidOperatingExpenses = org.table(
  "bid_operating_expenses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bidId: uuid("bid_id")
      .notNull()
      .references(() => bidsTable.id)
      .unique(),

    enabled: boolean("enabled").default(false),
    grossRevenuePreviousYear: numeric("gross_revenue_previous_year", {
      precision: 15,
      scale: 2,
    }).default("0"),
    currentBidAmount: numeric("current_bid_amount", {
      precision: 15,
      scale: 2,
    }).default("0"),
    operatingCostPreviousYear: numeric("operating_cost_previous_year", {
      precision: 15,
      scale: 2,
    }).default("0"),
    inflationAdjustedOperatingCost: numeric(
      "inflation_adjusted_operating_cost",
      { precision: 15, scale: 2 },
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
  (table) => [index("idx_bid_operating_bid_id").on(table.bidId)],
);

/**
 * Bid Plan Spec Data Table
 * One-to-one plan spec data for plan-spec type bids
 */
export const bidPlanSpecData = org.table(
  "bid_plan_spec_data",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bidId: uuid("bid_id")
      .notNull()
      .references(() => bidsTable.id)
      .unique(),

    // Plans Information
    plansReceivedDate: date("plans_received_date"),
    planRevision: varchar("plan_revision", { length: 100 }),
    planReviewNotes: text("plan_review_notes"),

    // Specifications Information
    specificationsReceivedDate: date("specifications_received_date"),
    specificationRevision: varchar("specification_revision", { length: 100 }),
    specificationReviewNotes: text("specification_review_notes"),

    // Compliance & Addenda
    complianceRequirements: text("compliance_requirements"),
    codeComplianceStatus: varchar("code_compliance_status", { length: 50 }), // pending, compliant, non_compliant, under_review
    addendaReceived: boolean("addenda_received").default(false),
    addendaCount: integer("addenda_count").default(0),
    addendaNotes: text("addenda_notes"),

    // Legacy fields (kept for backward compatibility)
    specifications: text("specifications"),
    designRequirements: text("design_requirements"),

    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [index("idx_bid_plan_spec_bid_id").on(table.bidId)],
);

/**
 * Bid Survey Data Table
 * One-to-one survey data for survey-type bids
 */
export const bidSurveyData = org.table("bid_survey_data", {
  id: uuid("id").defaultRandom().primaryKey(),
  bidId: uuid("bid_id")
    .notNull()
    .references(() => bidsTable.id)
    .unique(),

  buildingNumber: varchar("building_number", { length: 100 }),
  siteLocation: text("site_location"),
  workType: varchar("work_type", { length: 50 }), // new-installation, existing-unit-assessment, site-condition-check
  hasExistingUnit: boolean("has_existing_unit").default(false),
  unitTag: varchar("unit_tag", { length: 100 }),
  unitLocation: varchar("unit_location", { length: 255 }),
  make: varchar("make", { length: 100 }),
  model: varchar("model", { length: 100 }),
  serial: varchar("serial", { length: 100 }),
  systemType: varchar("system_type", { length: 100 }),
  powerStatus: varchar("power_status", { length: 50 }),
  voltagePhase: varchar("voltage_phase", { length: 50 }),
  overallCondition: varchar("overall_condition", { length: 100 }),
  siteAccessNotes: text("site_access_notes"),
  additionalNotes: text("additional_notes"), //optional
  siteConditions: text("site_conditions"),
  clientRequirements: text("client_requirements"),
  termsAndConditions: text("terms_and_conditions"), //optional
  dateOfSurvey: date("date_of_survey"),
  timeOfSurvey: time("time_of_survey"),
  isDeleted: boolean("is_deleted").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/**
 * Bid Design Build Data Table
 * One-to-one design build data for design-build type bids
 */
export const bidDesignBuildData = org.table(
  "bid_design_build_data",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bidId: uuid("bid_id")
      .notNull()
      .references(() => bidsTable.id)
      .unique(),

    // Design Phase Information
    designPhase: varchar("design_phase", { length: 50 }), // conceptual, schematic, design_development, construction_documents, bidding, construction_admin
    designStartDate: date("design_start_date"),
    designCompletionDate: date("design_completion_date"),

    // Design Team (stored as JSON array of employee IDs)
    designTeamMembers: text("design_team_members"), // JSON array of employee IDs

    // Design Scope & Requirements
    conceptDescription: text("concept_description"),
    designRequirements: text("design_requirements"),
    designDeliverables: text("design_deliverables"),

    // Client Approval
    clientApprovalRequired: boolean("client_approval_required").default(false),

    // Design Costs
    designFeeBasis: varchar("design_fee_basis", { length: 50 }), // fixed, hourly, percentage, lump_sum
    designFees: numeric("design_fees", { precision: 15, scale: 2 }).default(
      "0",
    ),

    // Legacy/Construction fields
    buildSpecifications: text("build_specifications"),

    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [index("idx_bid_design_build_bid_id").on(table.bidId)],
);

/**
 * Bid Timeline Table
 * Timeline and milestones for bids
 */
export const bidTimeline = org.table(
  "bid_timeline",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bidId: uuid("bid_id")
      .notNull()
      .references(() => bidsTable.id),

    event: varchar("event", { length: 255 }).notNull(),
    eventDate: timestamp("event_date").notNull(),
    estimatedDuration: integer("estimated_duration").notNull(),
    durationType: varchar("duration_type", { length: 10 }).notNull(), // 'days' | 'weeks' | 'months'
    isCompleted: boolean("is_completed").default(false),
    description: text("description"),
    sortOrder: integer("sort_order").default(0),
    createdBy: uuid("created_by").references(() => users.id, {}),

    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_bid_timeline_bid_id").on(table.bidId),
    index("idx_bid_timeline_event_date").on(table.eventDate),
    index("idx_bid_timeline_is_completed").on(table.isCompleted),
  ],
);

/**
 * Bid Documents Table
 * General documents associated with bids
 */
export const bidDocuments = org.table(
  "bid_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bidId: uuid("bid_id")
      .notNull()
      .references(() => bidsTable.id),

    fileName: varchar("file_name", { length: 255 }).notNull(),
    filePath: varchar("file_path", { length: 500 }).notNull(),
    fileType: varchar("file_type", { length: 50 }),
    fileSize: integer("file_size"),
    documentType: varchar("document_type", { length: 50 }), // proposal, contract, spec, plan, etc.
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => users.id),

    isStarred: boolean("is_starred").default(false),
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_bid_documents_bid_id").on(table.bidId),
    index("idx_bid_documents_type").on(table.documentType),
    index("idx_bid_documents_uploaded_by").on(table.uploadedBy),
    index("idx_bid_documents_starred").on(table.isStarred),
  ],
);

/**
 * Bid Media Table
 * Stores media files (images, videos, audio) associated with bids
 */
export const bidMedia = org.table(
  "bid_media",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bidId: uuid("bid_id")
      .notNull()
      .references(() => bidsTable.id),

    fileName: varchar("file_name", { length: 255 }).notNull(),
    filePath: varchar("file_path", { length: 500 }).notNull(),
    fileUrl: varchar("file_url", { length: 500 }),
    fileType: varchar("file_type", { length: 50 }), // image/jpeg, image/png, video/mp4, etc.
    fileSize: integer("file_size"),
    mediaType: varchar("media_type", { length: 50 }), // photo, video, audio, etc.
    thumbnailPath: varchar("thumbnail_path", { length: 500 }),
    thumbnailUrl: varchar("thumbnail_url", { length: 500 }),
    caption: text("caption"),
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => users.id),

    isStarred: boolean("is_starred").default(false),
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_bid_media_bid_id").on(table.bidId),
    index("idx_bid_media_type").on(table.mediaType),
    index("idx_bid_media_uploaded_by").on(table.uploadedBy),
    index("idx_bid_media_starred").on(table.isStarred),
  ],
);

/**
 * Bid Plan Spec Files Table
 * Specific files for plan-spec type bids
 */
export const bidPlanSpecFiles = org.table(
  "bid_plan_spec_files",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    bidId: uuid("bid_id")
      .notNull()
      .references(() => bidsTable.id),

    fileType: varchar("file_type", { length: 20 }).notNull(), // "plan" | "spec"
    fileName: varchar("file_name", { length: 255 }).notNull(),
    filePath: varchar("file_path", { length: 500 }).notNull(),
    fileSize: integer("file_size"),
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => users.id),

    isStarred: boolean("is_starred").default(false),
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_bid_plan_spec_files_org").on(table.organizationId),
    index("idx_bid_plan_spec_files_bid_id").on(table.bidId),
    index("idx_bid_plan_spec_files_type").on(table.fileType),
    index("idx_bid_plan_spec_files_starred").on(table.isStarred),
  ],
);

/**
 * Bid Design Build Files Table
 * Specific files for design-build type bids
 */
export const bidDesignBuildFiles = org.table(
  "bid_design_build_files",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    bidId: uuid("bid_id")
      .notNull()
      .references(() => bidsTable.id),

    fileName: varchar("file_name", { length: 255 }).notNull(),
    filePath: varchar("file_path", { length: 500 }).notNull(),
    fileSize: integer("file_size"),
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => users.id),

    isStarred: boolean("is_starred").default(false),
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_bid_design_build_files_org").on(table.organizationId),
    index("idx_bid_design_build_files_bid_id").on(table.bidId),
    index("idx_bid_design_build_files_starred").on(table.isStarred),
  ],
);

/**
 * Bid Notes Table
 * Comments and notes for bids
 */
export const bidNotes = org.table(
  "bid_notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bidId: uuid("bid_id")
      .notNull()
      .references(() => bidsTable.id),

    note: text("note").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    isInternal: boolean("is_internal").default(true),

    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_bid_notes_bid_id").on(table.bidId),
    index("idx_bid_notes_created_by").on(table.createdBy),
    index("idx_bid_notes_internal").on(table.isInternal),
  ],
);

/**
 * Bid History Table
 * Audit trail for bid changes
 */
export const bidHistory = org.table(
  "bid_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    bidId: uuid("bid_id")
      .notNull()
      .references(() => bidsTable.id),

    action: varchar("action", { length: 100 }).notNull(), // status_changed, amount_updated, assigned, etc.
    oldValue: text("old_value"),
    newValue: text("new_value"),
    description: text("description"),
    performedBy: uuid("performed_by")
      .notNull()
      .references(() => users.id),

    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_bid_history_org").on(table.organizationId),
    index("idx_bid_history_bid_id").on(table.bidId),
    index("idx_bid_history_performed_by").on(table.performedBy),
    index("idx_bid_history_created_at").on(table.createdAt),
    index("idx_bid_history_action").on(table.action),
  ],
);
