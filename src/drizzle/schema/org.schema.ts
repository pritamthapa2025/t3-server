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
  numeric,
  date,
  unique,
  index,
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

export const timesheetStatusEnum = pgEnum("timesheet_status_enum", [
  "pending",
  "submitted",
  "approved",
  "rejected",
]);

export const org = pgSchema("org");

// Departments table
export const departments = org.table("departments", {
  id: serial("id").primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  // Unique constraint: department names unique per organization
  unique("unique_dept_per_org").on(table.organizationId, table.name),
]);

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
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  employeeId: varchar("employee_id", { length: 50 }),
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
  note: jsonb("note"),
  status: employeeStatusEnum("status").notNull().default("available"),
  isDeleted: boolean("is_deleted").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  // Unique constraint: employeeId unique per organization
  unique("unique_employee_per_org").on(table.organizationId, table.employeeId),
]);

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

export const timesheets = org.table(
  "timesheets",
  {
    id: serial("id").primaryKey(),

    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id),

    sheetDate: date("sheet_date").notNull(),

    clockIn: timestamp("clock_in").notNull(),
    clockOut: timestamp("clock_out").notNull(),

    breakMinutes: integer("break_minutes").default(0),

    totalHours: numeric("total_hours", { precision: 5, scale: 2 }).default("0"),
    overtimeHours: numeric("overtime_hours", {
      precision: 5,
      scale: 2,
    }).default("0"),

    notes: text("notes"),

    status: timesheetStatusEnum("status").notNull().default("pending"),

    submittedBy: uuid("submitted_by").references(() => users.id),
    approvedBy: uuid("approved_by").references(() => users.id),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    unique("unique_employee_day").on(table.employeeId, table.sheetDate),
  ]
);

export const timesheetApprovals = org.table("timesheet_approvals", {
  id: serial("id").primaryKey(),

  timesheetId: integer("timesheet_id")
    .notNull()
    .references(() => timesheets.id),

  action: varchar("action", { length: 50 }).notNull(),

  performedBy: uuid("performed_by")
    .notNull()
    .references(() => users.id),

  remarks: text("remarks"),

  createdAt: timestamp("created_at").defaultNow(),
});

// Add organizations table first (referenced by financial tables)
export const organizations = org.table("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const jobs = org.table("jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Financial summary tables
export const financialSummary = org.table("financial_summary", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  // Revenue metrics
  totalContractValue: numeric("total_contract_value", {
    precision: 15,
    scale: 2,
  })
    .notNull()
    .default("0"),
  totalInvoiced: numeric("total_invoiced", { precision: 15, scale: 2 })
    .notNull()
    .default("0"),
  totalPaid: numeric("total_paid", { precision: 15, scale: 2 })
    .notNull()
    .default("0"),
  // Expense metrics
  totalJobExpenses: numeric("total_job_expenses", { precision: 15, scale: 2 })
    .notNull()
    .default("0"),
  totalOperatingExpenses: numeric("total_operating_expenses", {
    precision: 15,
    scale: 2,
  })
    .notNull()
    .default("0"),
  totalCost: numeric("total_cost", { precision: 15, scale: 2 })
    .notNull()
    .default("0"),
  // Profit metrics
  projectedProfit: numeric("projected_profit", { precision: 15, scale: 2 })
    .notNull()
    .default("0"),
  actualProfit: numeric("actual_profit", { precision: 15, scale: 2 })
    .notNull()
    .default("0"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const jobFinancialSummary = org.table(
  "job_financial_summary",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
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
  (table) => [unique("unique_job_financial").on(table.jobId)]
);

export const financialCostCategories = org.table("financial_cost_categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  categoryKey: varchar("category_key", { length: 50 }).notNull(),
  categoryLabel: varchar("category_label", { length: 255 }).notNull(),
  spent: numeric("spent", { precision: 15, scale: 2 }).notNull().default("0"),
  budget: numeric("budget", { precision: 15, scale: 2 }).notNull().default("0"),
  percentOfTotal: numeric("percent_of_total", { precision: 5, scale: 2 })
    .notNull()
    .default("0"),
  status: varchar("status", { length: 20 }).notNull().default("on-track"),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const profitTrend = org.table("profit_trend", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  period: varchar("period", { length: 50 }).notNull(),
  periodDate: date("period_date").notNull(),
  revenue: numeric("revenue", { precision: 15, scale: 2 })
    .notNull()
    .default("0"),
  expenses: numeric("expenses", { precision: 15, scale: 2 })
    .notNull()
    .default("0"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const cashFlowProjection = org.table("cash_flow_projection", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  projectionDate: date("projection_date").notNull(),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  projectedIncome: numeric("projected_income", { precision: 15, scale: 2 })
    .notNull()
    .default("0"),
  projectedExpenses: numeric("projected_expenses", { precision: 15, scale: 2 })
    .notNull()
    .default("0"),
  pipelineCoverageMonths: numeric("pipeline_coverage_months", {
    precision: 5,
    scale: 2,
  })
    .notNull()
    .default("0"),
  openInvoicesCount: integer("open_invoices_count").notNull().default(0),
  averageCollectionDays: integer("average_collection_days")
    .notNull()
    .default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const cashFlowScenarios = org.table("cash_flow_scenarios", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  projectionId: uuid("projection_id")
    .notNull()
    .references(() => cashFlowProjection.id, { onDelete: "cascade" }),
  scenarioType: varchar("scenario_type", { length: 20 }).notNull(),
  label: varchar("label", { length: 255 }).notNull(),
  description: text("description"),
  projectedIncome: numeric("projected_income", { precision: 15, scale: 2 })
    .notNull()
    .default("0"),
  projectedExpenses: numeric("projected_expenses", { precision: 15, scale: 2 })
    .notNull()
    .default("0"),
  changeDescription: varchar("change_description", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const revenueForecast = org.table("revenue_forecast", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  month: varchar("month", { length: 10 }).notNull(),
  monthDate: date("month_date").notNull(),
  committed: numeric("committed", { precision: 15, scale: 2 })
    .notNull()
    .default("0"),
  pipeline: numeric("pipeline", { precision: 15, scale: 2 })
    .notNull()
    .default("0"),
  probability: numeric("probability", { precision: 5, scale: 4 })
    .notNull()
    .default("0"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const financialReports = org.table(
  "financial_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    reportKey: varchar("report_key", { length: 50 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    category: varchar("category", { length: 50 }).notNull(),
    reportConfig: jsonb("report_config"),
    updatedAt: timestamp("updated_at").defaultNow(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    unique("unique_org_report").on(table.organizationId, table.reportKey),
  ]
);

// Bid Management System Enums

export const bidStatusEnum = pgEnum("bid_status_enum", [
  "draft",
  "in_progress",
  "pending",
  "submitted",
  "accepted",
  "won",
  "rejected",
  "lost",
  "expired",
  "cancelled",
]);

export const bidPriorityEnum = pgEnum("bid_priority_enum", [
  "low",
  "medium",
  "high",
  "urgent",
]);

export const bidJobTypeEnum = pgEnum("bid_job_type_enum", [
  "survey",
  "plan_spec",
  "design_build",
]);

export const timelineStatusEnum = pgEnum("timeline_status_enum", [
  "completed",
  "pending",
  "in_progress",
  "cancelled",
]);

// Main Bids table

export const bidsTable = org.table(
  "bids",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bidNumber: varchar("bid_number", { length: 100 }).notNull(),
    // Basic Information
    title: varchar("title", { length: 255 }).notNull(),
    jobType: bidJobTypeEnum("job_type").notNull(),
    status: bidStatusEnum("status").notNull().default("draft"),
    priority: bidPriorityEnum("priority").notNull().default("medium"),
    // Client / Org
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    clientName: varchar("client_name", { length: 255 }),
    clientEmail: varchar("client_email", { length: 150 }),
    clientPhone: varchar("client_phone", { length: 20 }),
    city: varchar("city", { length: 100 }),
    superClient: varchar("super_client", { length: 255 }),
    superPrimaryContact: varchar("super_primary_contact", {
      length: 255,
    }),
    primaryContact: varchar("primary_contact", { length: 255 }),
    industryClassification: varchar("industry_classification", {
      length: 100,
    }),
    // Project Details
    projectName: varchar("project_name", { length: 255 }),
    siteAddress: text("site_address"),
    buildingSuiteNumber: varchar("building_suite_number", { length: 100 }),
    property: varchar("property", { length: 255 }),
    acrossValuations: varchar("across_valuations", { length: 255 }),
    scopeOfWork: text("scope_of_work"),
    specialRequirements: text("special_requirements"),
    description: text("description"),
    // Dates
    startDate: date("start_date"),
    endDate: date("end_date"),
    plannedStartDate: date("planned_start_date"),
    estimatedCompletion: date("estimated_completion"),
    createdDate: timestamp("created_date").defaultNow(),
    expiresDate: timestamp("expires_date"),
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
    expiresIn: integer("expires_in"), // days
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
    primaryTeammate: uuid("primary_teammate").references(() => users.id, {
      onDelete: "set null",
    }),
    supervisorManager: uuid("supervisor_manager").references(() => users.id, {
      onDelete: "set null",
    }),
    technicianId: uuid("technician_id").references(() => users.id, {
      onDelete: "set null",
    }),
    // Metadata
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    assignedTo: uuid("assigned_to").references(() => users.id, {
      onDelete: "set null",
    }),
    qtyNumber: varchar("qty_number", { length: 50 }),
    marked: varchar("marked", { length: 20 }), // "won" | "lost"
    convertToJob: boolean("convert_to_job").default(false),
    jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    // Unique constraint: bidNumber unique per organization
    unique("unique_bid_number_per_org").on(table.organizationId, table.bidNumber),
    // Indexes for performance
    index("idx_bids_org").on(table.organizationId),
    index("idx_bids_status").on(table.status),
    index("idx_bids_org_status").on(table.organizationId, table.status),
    index("idx_bids_created_by").on(table.createdBy),
    index("idx_bids_job_type").on(table.jobType),
    index("idx_bids_priority").on(table.priority),
    index("idx_bids_expires_date").on(table.expiresDate),
    index("idx_bids_is_deleted").on(table.isDeleted),
    index("idx_bids_created_at").on(table.createdAt),
  ]
);

// Financial Breakdown (1:1)

export const bidFinancialBreakdown = org.table(
  "bid_financial_breakdown",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
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
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_bid_financial_org").on(table.organizationId),
    index("idx_bid_financial_bid_id").on(table.bidId),
  ]
);

// Materials (1:many)

export const bidMaterials = org.table(
  "bid_materials",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    bidId: uuid("bid_id")
      .notNull()
      .references(() => bidsTable.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
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
  (table) => [
    index("idx_bid_materials_org").on(table.organizationId),
    index("idx_bid_materials_bid_id").on(table.bidId),
  ]
);

// Labor (1:many)

export const bidLabor = org.table(
  "bid_labor",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    bidId: uuid("bid_id")
      .notNull()
      .references(() => bidsTable.id, { onDelete: "cascade" }),
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
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_bid_labor_org").on(table.organizationId),
    index("idx_bid_labor_bid_id").on(table.bidId),
  ]
);

// Travel (1:many)

export const bidTravel = org.table(
  "bid_travel",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    bidId: uuid("bid_id")
      .notNull()
      .references(() => bidsTable.id, { onDelete: "cascade" }),
    employeeName: varchar("employee_name", { length: 255 }),
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
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_bid_travel_org").on(table.organizationId),
    index("idx_bid_travel_bid_id").on(table.bidId),
  ]
);

// Operating Expenses (1:1)

export const bidOperatingExpenses = org.table(
  "bid_operating_expenses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
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
    index("idx_bid_operating_org").on(table.organizationId),
    index("idx_bid_operating_bid_id").on(table.bidId),
  ]
);

// Survey Bid Data (1:1)

export const bidSurveyData = org.table(
  "bid_survey_data",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    bidId: uuid("bid_id")
      .notNull()
      .references(() => bidsTable.id, { onDelete: "cascade" })
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
    siteConditions: text("site_conditions"),
    clientRequirements: text("client_requirements"),
    technicianId: uuid("technician_id").references(() => users.id, {
      onDelete: "set null",
    }),
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_bid_survey_org").on(table.organizationId),
    index("idx_bid_survey_bid_id").on(table.bidId),
  ]
);

// Plan Spec Data (1:1)

export const bidPlanSpecData = org.table(
  "bid_plan_spec_data",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    bidId: uuid("bid_id")
      .notNull()
      .references(() => bidsTable.id, { onDelete: "cascade" })
      .unique(),
    specifications: text("specifications"),
    designRequirements: text("design_requirements"),
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_bid_plan_spec_org").on(table.organizationId),
    index("idx_bid_plan_spec_bid_id").on(table.bidId),
  ]
);

// Design Build Data (1:1)

export const bidDesignBuildData = org.table(
  "bid_design_build_data",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    bidId: uuid("bid_id")
      .notNull()
      .references(() => bidsTable.id, { onDelete: "cascade" })
      .unique(),
    designRequirements: text("design_requirements"),
    buildSpecifications: text("build_specifications"),
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_bid_design_build_org").on(table.organizationId),
    index("idx_bid_design_build_bid_id").on(table.bidId),
  ]
);

// Bid Timeline / Milestones

export const bidTimeline = org.table(
  "bid_timeline",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    bidId: uuid("bid_id")
      .notNull()
      .references(() => bidsTable.id, { onDelete: "cascade" }),
    event: varchar("event", { length: 255 }).notNull(),
    eventDate: timestamp("event_date").notNull(),
    status: timelineStatusEnum("status").notNull().default("pending"),
    description: text("description"),
    sortOrder: integer("sort_order").default(0),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_bid_timeline_org").on(table.organizationId),
    index("idx_bid_timeline_bid_id").on(table.bidId),
    index("idx_bid_timeline_status").on(table.status),
  ]
);

// Bid Documents

export const bidDocuments = org.table(
  "bid_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
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
      .references(() => users.id, { onDelete: "restrict" }),
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_bid_documents_org").on(table.organizationId),
    index("idx_bid_documents_bid_id").on(table.bidId),
    index("idx_bid_documents_type").on(table.documentType),
  ]
);

// Plan Spec Files

export const bidPlanSpecFiles = org.table(
  "bid_plan_spec_files",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    bidId: uuid("bid_id")
      .notNull()
      .references(() => bidsTable.id, { onDelete: "cascade" }),
    fileType: varchar("file_type", { length: 20 }).notNull(), // "plan" | "spec"
    fileName: varchar("file_name", { length: 255 }).notNull(),
    filePath: varchar("file_path", { length: 500 }).notNull(),
    fileSize: integer("file_size"),
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_bid_plan_spec_files_org").on(table.organizationId),
    index("idx_bid_plan_spec_files_bid_id").on(table.bidId),
    index("idx_bid_plan_spec_files_type").on(table.fileType),
  ]
);

// Design Build Files

export const bidDesignBuildFiles = org.table(
  "bid_design_build_files",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    bidId: uuid("bid_id")
      .notNull()
      .references(() => bidsTable.id, { onDelete: "cascade" }),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    filePath: varchar("file_path", { length: 500 }).notNull(),
    fileSize: integer("file_size"),
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_bid_design_build_files_org").on(table.organizationId),
    index("idx_bid_design_build_files_bid_id").on(table.bidId),
  ]
);

// Bid Notes / Comments

export const bidNotes = org.table(
  "bid_notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    bidId: uuid("bid_id")
      .notNull()
      .references(() => bidsTable.id, { onDelete: "cascade" }),
    note: text("note").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    isInternal: boolean("is_internal").default(true),
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_bid_notes_org").on(table.organizationId),
    index("idx_bid_notes_bid_id").on(table.bidId),
    index("idx_bid_notes_created_by").on(table.createdBy),
  ]
);

// Bid History / Audit

export const bidHistory = org.table(
  "bid_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    bidId: uuid("bid_id")
      .notNull()
      .references(() => bidsTable.id, { onDelete: "cascade" }),
    action: varchar("action", { length: 100 }).notNull(), // status_changed, amount_updated, assigned, etc.
    oldValue: text("old_value"),
    newValue: text("new_value"),
    description: text("description"),
    performedBy: uuid("performed_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_bid_history_org").on(table.organizationId),
    index("idx_bid_history_bid_id").on(table.bidId),
    index("idx_bid_history_performed_by").on(table.performedBy),
    index("idx_bid_history_created_at").on(table.createdAt),
  ]
);
