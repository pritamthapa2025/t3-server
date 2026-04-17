import { sql } from "drizzle-orm";
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
  jsonb,
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
    bidNumber: varchar("bid_number", { length: 100 }).notNull(),
    parentBidId: uuid("parent_bid_id").references(() => bidsTable.id),
    rootBidId: uuid("root_bid_id").references(() => bidsTable.id),
    versionNumber: integer("version_number").notNull().default(1),

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
    estimatedDuration: integer("estimated_duration"), // days
    profitMargin: numeric("profit_margin", { precision: 5, scale: 2 }), // %

    // Terms & Conditions
    paymentTerms: text("payment_terms"),
    warrantyPeriod: varchar("warranty_period", { length: 50 }),
    warrantyPeriodLabor: varchar("warranty_period_labor", { length: 50 }),
    warrantyDetails: text("warranty_details"),
    specialTerms: text("special_terms"),
    exclusions: text("exclusions"),
    /** Ordered basis lines; each entry may include internal newlines (not separate items). */
    proposalBasisItems: jsonb("proposal_basis_items")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    referenceDate: varchar("reference_date", { length: 50 }),
    templateSelection: varchar("template_selection", { length: 100 }),

    // Team Assignment
    supervisorManager: integer("supervisor_manager").references(
      () => employees.id,
    ),
    primaryTechnicianId: integer("technician_id").references(
      () => employees.id,
    ),

    // Additional Project Fields
    industryClassification: varchar("industry_classification", { length: 255 }),
    scheduledDateTime: timestamp("scheduled_date_time"),
    termsTemplateSelection: varchar("terms_template_selection", {
      length: 100,
    }),
    siteContactName: varchar("site_contact_name", { length: 255 }),
    siteContactPhone: varchar("site_contact_phone", { length: 50 }),
    accessInstructions: text("access_instructions"),

    // Lifecycle / Post-Decision Fields
    finalBidAmount: numeric("final_bid_amount", { precision: 15, scale: 2 }),
    actualCost: numeric("actual_cost", { precision: 15, scale: 2 }),
    submittedDate: date("submitted_date"),
    decisionDate: date("decision_date"),
    convertedToJobId: uuid("converted_to_job_id"),
    conversionDate: date("conversion_date"),
    lostReason: text("lost_reason"),
    rejectionReason: text("rejection_reason"),

    // Metadata
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    assignedTo: uuid("assigned_to").references(() => users.id, {}),
    qtyNumber: varchar("qty_number", { length: 50 }),
    marked: varchar("marked", { length: 20 }),
    convertToJob: boolean("convert_to_job").default(false),

    isDeleted: boolean("is_deleted").default(false),
    deletedAt: timestamp("deleted_at"),
    deletedBy: uuid("deleted_by").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),

    /** All-day (or timed) reminder on assignee/creator calendar for bid end date. */
    googleCalendarEndDateEventId: varchar("google_calendar_end_date_event_id", {
      length: 512,
    }),
    /** User whose calendar holds `googleCalendarEndDateEventId` (for delete/update). */
    googleCalendarEndDateOwnerUserId: uuid(
      "google_calendar_end_date_owner_user_id",
    ).references(() => users.id),
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
      .references(() => bidsTable.id, { onDelete: "cascade" })
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

    // Actual (billed) totals - updated when job/change orders modify amounts; initial fields stay as bid
    actualMaterialsEquipment: numeric("actual_materials_equipment", {
      precision: 15,
      scale: 2,
    })
      .notNull()
      .default("0"),
    actualLabor: numeric("actual_labor", { precision: 15, scale: 2 })
      .notNull()
      .default("0"),
    actualTravel: numeric("actual_travel", { precision: 15, scale: 2 })
      .notNull()
      .default("0"),
    actualOperatingExpenses: numeric("actual_operating_expenses", {
      precision: 15,
      scale: 2,
    })
      .notNull()
      .default("0"),
    actualTotalCost: numeric("actual_total_cost", {
      precision: 15,
      scale: 2,
    })
      .notNull()
      .default("0"),
    actualTotalPrice: numeric("actual_total_price", {
      precision: 15,
      scale: 2,
    })
      .notNull()
      .default("0"),
    actualGrossProfit: numeric("actual_gross_profit", {
      precision: 15,
      scale: 2,
    })
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
      .references(() => bidsTable.id, { onDelete: "cascade" }),
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
    totalPrice: numeric("total_price", { precision: 15, scale: 2 })
      .notNull()
      .default("0"),

    // Actual (billed) - updated when job/change orders modify line; initial fields stay as bid
    actualQuantity: numeric("actual_quantity", { precision: 10, scale: 2 }),
    actualUnitCost: numeric("actual_unit_cost", { precision: 15, scale: 2 }),
    actualMarkup: numeric("actual_markup", { precision: 5, scale: 2 }),
    actualTotalCost: numeric("actual_total_cost", { precision: 15, scale: 2 }),
    actualTotalPrice: numeric("actual_total_price", {
      precision: 15,
      scale: 2,
    }),

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
      .references(() => bidsTable.id, { onDelete: "cascade" }),
    positionId: integer("position_id").references(() => positions.id),
    customRole: varchar("custom_role", { length: 255 }), // Free-text role when no positionId
    quantity: integer("quantity").notNull().default(1), // Number of workers for this position
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

    // Actual (billed) - updated when job/change orders modify line; initial fields stay as bid
    actualDays: integer("actual_days"),
    actualHoursPerDay: numeric("actual_hours_per_day", {
      precision: 5,
      scale: 2,
    }),
    actualTotalHours: numeric("actual_total_hours", {
      precision: 8,
      scale: 2,
    }),
    actualCostRate: numeric("actual_cost_rate", { precision: 10, scale: 2 }),
    actualBillableRate: numeric("actual_billable_rate", {
      precision: 10,
      scale: 2,
    }),
    actualTotalCost: numeric("actual_total_cost", {
      precision: 15,
      scale: 2,
    }),
    actualTotalPrice: numeric("actual_total_price", {
      precision: 15,
      scale: 2,
    }),

    // Assigned employee when bid is converted to a job (set at conversion time)
    assignedEmployeeId: integer("assigned_employee_id").references(
      () => employees.id,
    ),

    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_bid_labor_bid_id").on(table.bidId),
    index("idx_bid_labor_position_id").on(table.positionId),
    index("idx_bid_labor_assigned_employee_id").on(table.assignedEmployeeId),
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
      .references(() => bidLabor.id, { onDelete: "cascade" }),

    // Travel origin — the starting address used to calculate round-trip miles
    originAddressId: uuid("origin_address_id"),
    originAddress: text("origin_address"),

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

    // Actual (billed) - updated when job/change orders modify line; initial fields stay as bid
    actualRoundTripMiles: numeric("actual_round_trip_miles", {
      precision: 10,
      scale: 2,
    }),
    actualMileageRate: numeric("actual_mileage_rate", {
      precision: 10,
      scale: 2,
    }),
    actualVehicleDayRate: numeric("actual_vehicle_day_rate", {
      precision: 10,
      scale: 2,
    }),
    actualDays: integer("actual_days"),
    actualMileageCost: numeric("actual_mileage_cost", {
      precision: 15,
      scale: 2,
    }),
    actualVehicleCost: numeric("actual_vehicle_cost", {
      precision: 15,
      scale: 2,
    }),
    actualMarkup: numeric("actual_markup", { precision: 5, scale: 2 }),
    actualTotalCost: numeric("actual_total_cost", {
      precision: 15,
      scale: 2,
    }),
    actualTotalPrice: numeric("actual_total_price", {
      precision: 15,
      scale: 2,
    }),

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
      .references(() => bidsTable.id, { onDelete: "cascade" })
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
      precision: 10,
      scale: 2,
    }).default("0"),
    utilizationPercentage: numeric("utilization_percentage", {
      precision: 10,
      scale: 2,
    }).default("0"),
    calculatedOperatingCost: numeric("calculated_operating_cost", {
      precision: 15,
      scale: 2,
    }).default("0"),
    applyMarkup: boolean("apply_markup").default(false),
    markupPercentage: numeric("markup_percentage", {
      precision: 10,
      scale: 2,
    }).default("0"),
    operatingPrice: numeric("operating_price", {
      precision: 15,
      scale: 2,
    }).default("0"),

    // Actual (billed) - formula applied to actual direct cost; initial fields stay as bid
    actualCurrentBidAmount: numeric("actual_current_bid_amount", {
      precision: 15,
      scale: 2,
    }).default("0"),
    actualCalculatedOperatingCost: numeric("actual_calculated_operating_cost", {
      precision: 15,
      scale: 2,
    }).default("0"),
    actualInflationAdjustedOperatingCost: numeric(
      "actual_inflation_adjusted_operating_cost",
      { precision: 15, scale: 2 },
    ).default("0"),
    actualOperatingPrice: numeric("actual_operating_price", {
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
      .references(() => bidsTable.id, { onDelete: "cascade" })
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
    .references(() => bidsTable.id, { onDelete: "cascade" })
    .unique(),

  // New survey bid fields
  surveyType: varchar("survey_type", { length: 50 }), // new-installation, existing-assessment, energy-audit, feasibility-study
  numberOfBuildings: integer("number_of_buildings"),
  expectedUnitsToSurvey: integer("expected_units_to_survey"),
  buildingNumbers: text("building_numbers"), // JSON array
  unitTypes: text("unit_types"), // JSON array: RTU, AHU, Chiller, Boiler, Split System, Exhaust Fan, Other
  includePhotoDocumentation: boolean("include_photo_documentation").default(
    false,
  ),
  includePerformanceTesting: boolean("include_performance_testing").default(
    false,
  ),
  includeEnergyAnalysis: boolean("include_energy_analysis").default(false),
  includeRecommendations: boolean("include_recommendations").default(false),
  schedulingConstraints: text("scheduling_constraints"),
  technicianId: integer("technician_id").references(() => employees.id),

  // Pricing
  pricingModel: varchar("pricing_model", { length: 50 }), // flat_fee, per_unit, time_materials
  flatSurveyFee: numeric("flat_survey_fee", { precision: 15, scale: 2 }),
  pricePerUnit: numeric("price_per_unit", { precision: 15, scale: 2 }),
  estimatedHours: numeric("estimated_hours", { precision: 10, scale: 2 }),
  hourlyRate: numeric("hourly_rate", { precision: 15, scale: 2 }),
  estimatedExpenses: numeric("estimated_expenses", { precision: 15, scale: 2 }),
  totalSurveyFee: numeric("total_survey_fee", { precision: 15, scale: 2 }),

  // Additional survey metadata
  surveyDate: date("survey_date"),
  surveyBy: varchar("survey_by", { length: 255 }),
  surveyNotes: text("survey_notes"),
  accessRequirements: text("access_requirements"),
  utilityLocations: text("utility_locations"),
  existingEquipment: text("existing_equipment"),
  measurements: text("measurements"),
  photos: text("photos"), // JSON array of photo paths

  // Shared notes fields
  siteAccessNotes: text("site_access_notes"),
  additionalNotes: text("additional_notes"),
  clientRequirements: text("client_requirements"),
  termsAndConditions: text("terms_and_conditions"),

  // Legacy fields (kept for backward compatibility)
  buildingNumber: varchar("building_number", { length: 100 }),
  siteLocation: text("site_location"),
  workType: varchar("work_type", { length: 50 }),
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
  siteConditions: text("site_conditions"),
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
      .references(() => bidsTable.id, { onDelete: "cascade" })
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
    approvalMilestones: text("approval_milestones"),
    designRevisionLimit: integer("design_revision_limit"),

    // Design Costs
    designFeeBasis: varchar("design_fee_basis", { length: 50 }), // fixed, hourly, percentage, lump_sum
    designPrice: numeric("design_price", { precision: 15, scale: 2 }).default(
      "0",
    ),
    designCost: numeric("design_cost", { precision: 15, scale: 2 }).default(
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
 * Bid Service Data Table
 * One-to-one service data for service-type bids
 */
export const bidServiceData = org.table(
  "bid_service_data",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bidId: uuid("bid_id")
      .notNull()
      .references(() => bidsTable.id, { onDelete: "cascade" })
      .unique(),

    // Bid-creation fields: service scope & classification
    serviceType: varchar("service_type", { length: 50 }), // emergency_repair, scheduled_repair, diagnostic, installation, other
    equipmentType: varchar("equipment_type", { length: 100 }), // rooftop_unit, split_system, boiler, chiller, air_handler, other
    issueCategory: varchar("issue_category", { length: 100 }), // cooling, heating, ventilation, controls, electrical, plumbing, other
    reportedIssue: text("reported_issue"),
    preliminaryAssessment: text("preliminary_assessment"),
    estimatedWorkScope: text("estimated_work_scope"),

    // Bid-creation fields: assigned technicians
    leadTechnicianId: integer("lead_technician_id").references(
      () => employees.id,
    ),
    helperTechnicianId: integer("helper_technician_id").references(
      () => employees.id,
    ),

    // Bid-creation fields: pricing
    pricingModel: varchar("pricing_model", { length: 50 }), // time_materials, flat_rate, diagnostic_repair
    numberOfTechs: integer("number_of_techs"),
    laborHours: numeric("labor_hours", { precision: 10, scale: 2 }),
    laborRate: numeric("labor_rate", { precision: 15, scale: 2 }),
    materialsCost: numeric("materials_cost", { precision: 15, scale: 2 }),
    travelCost: numeric("travel_cost", { precision: 15, scale: 2 }),
    serviceMarkup: numeric("service_markup", { precision: 5, scale: 2 }),
    flatRatePrice: numeric("flat_rate_price", { precision: 15, scale: 2 }),
    diagnosticFee: numeric("diagnostic_fee", { precision: 15, scale: 2 }),
    estimatedRepairCost: numeric("estimated_repair_cost", {
      precision: 15,
      scale: 2,
    }),
    pricingNotes: text("pricing_notes"),

    // Execution-phase fields (populated post-bid during job)
    serviceCallTechnician: integer("service_call_technician").references(
      () => employees.id,
    ),
    timeIn: varchar("time_in", { length: 50 }),
    timeOut: varchar("time_out", { length: 50 }),
    serviceDescription: text("service_description"),

    // Checklist Items (execution phase)
    plumbingSystemCheck: boolean("plumbing_system_check").default(false),
    thermostatCheck: boolean("thermostat_check").default(false),
    hvacSystemCheck: boolean("hvac_system_check").default(false),
    clientCommunicationCheck: boolean("client_communication_check").default(
      false,
    ),

    // Customer Signature (execution phase)
    customerSignaturePath: varchar("customer_signature_path", { length: 500 }),
    customerSignatureDate: timestamp("customer_signature_date"),

    // Additional Notes (execution phase)
    serviceNotes: text("service_notes"),

    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [index("idx_bid_service_data_bid_id").on(table.bidId)],
);

/**
 * Bid Preventative Maintenance Data Table
 * One-to-one PM data for preventative-maintenance-type bids
 */
export const bidPreventativeMaintenanceData = org.table(
  "bid_preventative_maintenance_data",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bidId: uuid("bid_id")
      .notNull()
      .references(() => bidsTable.id, { onDelete: "cascade" })
      .unique(),

    // PM Type & Scope
    pmType: varchar("pm_type", { length: 100 }), // new_pm_bid, existing_pm_renewal
    maintenanceFrequency: varchar("maintenance_frequency", { length: 50 }), // quarterly, semi_annual, annual
    numberOfBuildings: integer("number_of_buildings"),
    numberOfUnits: integer("number_of_units"),

    // Expected Inspection Scope (stored as JSON text)
    buildingNumbers: text("building_numbers"),
    expectedUnitTags: text("expected_unit_tags"),

    // PM Services Included
    filterReplacementIncluded: boolean("filter_replacement_included").default(
      false,
    ),
    coilCleaningIncluded: boolean("coil_cleaning_included").default(false),
    temperatureReadingsIncluded: boolean(
      "temperature_readings_included",
    ).default(false),
    visualInspectionIncluded: boolean("visual_inspection_included").default(
      false,
    ),

    // Planning Details
    serviceScope: text("service_scope"),
    specialRequirements: text("special_requirements"),
    clientPmRequirements: text("client_pm_requirements"),

    // Renewal tracking
    previousPmJobId: varchar("previous_pm_job_id", { length: 100 }),

    // Pricing
    pricingModel: varchar("pricing_model", { length: 50 }), // per_unit, flat_rate, annual_contract
    pricePerUnit: numeric("price_per_unit", { precision: 15, scale: 2 }),
    flatRatePerVisit: numeric("flat_rate_per_visit", {
      precision: 15,
      scale: 2,
    }),
    annualContractValue: numeric("annual_contract_value", {
      precision: 15,
      scale: 2,
    }),
    includeFilterReplacement: boolean("include_filter_replacement").default(
      false,
    ),
    filterReplacementCost: numeric("filter_replacement_cost", {
      precision: 15,
      scale: 2,
    }),
    includeCoilCleaning: boolean("include_coil_cleaning").default(false),
    coilCleaningCost: numeric("coil_cleaning_cost", {
      precision: 15,
      scale: 2,
    }),
    emergencyServiceRate: numeric("emergency_service_rate", {
      precision: 15,
      scale: 2,
    }),
    paymentSchedule: varchar("payment_schedule", { length: 50 }), // annual, per_visit, quarterly
    pricingNotes: text("pricing_notes"),

    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [index("idx_bid_pm_data_bid_id").on(table.bidId)],
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
      .references(() => bidsTable.id, { onDelete: "cascade" }),

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
      .references(() => bidsTable.id, { onDelete: "cascade" }),

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
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_bid_documents_bid_id").on(table.bidId),
    index("idx_bid_documents_type").on(table.documentType),
    index("idx_bid_documents_uploaded_by").on(table.uploadedBy),
    index("idx_bid_documents_starred").on(table.isStarred),
    index("idx_bid_documents_deleted_at").on(table.deletedAt),
  ],
);

/**
 * Bid Document Tags Table
 * Tags for categorizing bid documents (e.g. Client, Vendor, Architect). Scoped per bid.
 */
export const bidDocumentTags = org.table(
  "bid_document_tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bidId: uuid("bid_id")
      .notNull()
      .references(() => bidsTable.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    /** When true this tag was created automatically and cannot be deleted. */
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_bid_document_tags_bid_id").on(table.bidId),
    unique("unique_bid_document_tag_name_per_bid").on(table.bidId, table.name),
  ],
);

/**
 * Bid Document Tag Links (junction table)
 * Many-to-many: documents <-> tags
 */
export const bidDocumentTagLinks = org.table(
  "bid_document_tag_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => bidDocuments.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => bidDocumentTags.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    unique("unique_document_tag").on(table.documentId, table.tagId),
    index("idx_bid_document_tag_links_document").on(table.documentId),
    index("idx_bid_document_tag_links_tag").on(table.tagId),
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
      .references(() => bidsTable.id, { onDelete: "cascade" }),

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
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_bid_media_bid_id").on(table.bidId),
    index("idx_bid_media_type").on(table.mediaType),
    index("idx_bid_media_uploaded_by").on(table.uploadedBy),
    index("idx_bid_media_starred").on(table.isStarred),
    index("idx_bid_media_deleted_at").on(table.deletedAt),
  ],
);

/**
 * Bid walk photos — same shape as bid_media; separate gallery for pre-job walkthrough photos.
 * Apply DB migration separately (org.bid_walk_photos).
 */
export const bidWalkPhotos = org.table(
  "bid_walk_photos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bidId: uuid("bid_id")
      .notNull()
      .references(() => bidsTable.id, { onDelete: "cascade" }),

    fileName: varchar("file_name", { length: 255 }).notNull(),
    filePath: varchar("file_path", { length: 500 }).notNull(),
    fileUrl: varchar("file_url", { length: 500 }),
    fileType: varchar("file_type", { length: 50 }),
    fileSize: integer("file_size"),
    mediaType: varchar("media_type", { length: 50 }),
    thumbnailPath: varchar("thumbnail_path", { length: 500 }),
    thumbnailUrl: varchar("thumbnail_url", { length: 500 }),
    caption: text("caption"),
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => users.id),

    isStarred: boolean("is_starred").default(false),
    isDeleted: boolean("is_deleted").default(false),
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_bid_walk_photos_bid_id").on(table.bidId),
    index("idx_bid_walk_photos_media_type").on(table.mediaType),
    index("idx_bid_walk_photos_uploaded_by").on(table.uploadedBy),
    index("idx_bid_walk_photos_deleted_at").on(table.deletedAt),
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
      .references(() => bidsTable.id, { onDelete: "cascade" }),

    fileType: varchar("file_type", { length: 20 }).notNull(), // "plan" | "spec"
    fileName: varchar("file_name", { length: 255 }).notNull(),
    filePath: varchar("file_path", { length: 500 }).notNull(),
    fileSize: integer("file_size"),
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => users.id),

    isStarred: boolean("is_starred").default(false),
    isDeleted: boolean("is_deleted").default(false),
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_bid_plan_spec_files_org").on(table.organizationId),
    index("idx_bid_plan_spec_files_bid_id").on(table.bidId),
    index("idx_bid_plan_spec_files_type").on(table.fileType),
    index("idx_bid_plan_spec_files_starred").on(table.isStarred),
    index("idx_bid_plan_spec_files_deleted_at").on(table.deletedAt),
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
      .references(() => bidsTable.id, { onDelete: "cascade" }),

    fileName: varchar("file_name", { length: 255 }).notNull(),
    filePath: varchar("file_path", { length: 500 }).notNull(),
    fileSize: integer("file_size"),
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => users.id),

    isStarred: boolean("is_starred").default(false),
    isDeleted: boolean("is_deleted").default(false),
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_bid_design_build_files_org").on(table.organizationId),
    index("idx_bid_design_build_files_bid_id").on(table.bidId),
    index("idx_bid_design_build_files_starred").on(table.isStarred),
    index("idx_bid_design_build_files_deleted_at").on(table.deletedAt),
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
      .references(() => bidsTable.id, { onDelete: "cascade" }),

    note: text("note").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),

    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_bid_notes_bid_id").on(table.bidId),
    index("idx_bid_notes_created_by").on(table.createdBy),
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
    bidId: uuid("bid_id")
      .notNull()
      .references(() => bidsTable.id, { onDelete: "cascade" }),

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
    index("idx_bid_history_bid_id").on(table.bidId),
    index("idx_bid_history_performed_by").on(table.performedBy),
    index("idx_bid_history_created_at").on(table.createdAt),
    index("idx_bid_history_action").on(table.action),
  ],
);
