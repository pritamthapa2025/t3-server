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
  name: varchar("name", { length: 100 }).notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

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
  employeeId: varchar("employee_id", { length: 50 }).unique(),
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
});

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
  totalContractValue: numeric("total_contract_value", { precision: 15, scale: 2 }).notNull().default("0"),
  totalInvoiced: numeric("total_invoiced", { precision: 15, scale: 2 }).notNull().default("0"),
  totalPaid: numeric("total_paid", { precision: 15, scale: 2 }).notNull().default("0"),
  // Expense metrics
  totalJobExpenses: numeric("total_job_expenses", { precision: 15, scale: 2 }).notNull().default("0"),
  totalOperatingExpenses: numeric("total_operating_expenses", { precision: 15, scale: 2 }).notNull().default("0"),
  totalCost: numeric("total_cost", { precision: 15, scale: 2 }).notNull().default("0"),
  // Profit metrics
  projectedProfit: numeric("projected_profit", { precision: 15, scale: 2 }).notNull().default("0"),
  actualProfit: numeric("actual_profit", { precision: 15, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const jobFinancialSummary = org.table("job_financial_summary", {
  id: uuid("id").defaultRandom().primaryKey(),
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  contractValue: numeric("contract_value", { precision: 15, scale: 2 }).notNull(),
  totalInvoiced: numeric("total_invoiced", { precision: 15, scale: 2 }).notNull().default("0"),
  totalPaid: numeric("total_paid", { precision: 15, scale: 2 }).notNull().default("0"),
  vendorsOwed: numeric("vendors_owed", { precision: 15, scale: 2 }).notNull().default("0"),
  laborPaidToDate: numeric("labor_paid_to_date", { precision: 15, scale: 2 }).notNull().default("0"),
  jobCompletionRate: numeric("job_completion_rate", { precision: 5, scale: 2 }),
  profitability: numeric("profitability", { precision: 5, scale: 2 }),
  profitMargin: numeric("profit_margin", { precision: 5, scale: 2 }),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique("unique_job_financial").on(table.jobId)
]);

export const financialCostCategories = org.table("financial_cost_categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  categoryKey: varchar("category_key", { length: 50 }).notNull(),
  categoryLabel: varchar("category_label", { length: 255 }).notNull(),
  spent: numeric("spent", { precision: 15, scale: 2 }).notNull().default("0"),
  budget: numeric("budget", { precision: 15, scale: 2 }).notNull().default("0"),
  percentOfTotal: numeric("percent_of_total", { precision: 5, scale: 2 }).notNull().default("0"),
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
  revenue: numeric("revenue", { precision: 15, scale: 2 }).notNull().default("0"),
  expenses: numeric("expenses", { precision: 15, scale: 2 }).notNull().default("0"),
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
  projectedIncome: numeric("projected_income", { precision: 15, scale: 2 }).notNull().default("0"),
  projectedExpenses: numeric("projected_expenses", { precision: 15, scale: 2 }).notNull().default("0"),
  pipelineCoverageMonths: numeric("pipeline_coverage_months", { precision: 5, scale: 2 }).notNull().default("0"),
  openInvoicesCount: integer("open_invoices_count").notNull().default(0),
  averageCollectionDays: integer("average_collection_days").notNull().default(0),
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
  projectedIncome: numeric("projected_income", { precision: 15, scale: 2 }).notNull().default("0"),
  projectedExpenses: numeric("projected_expenses", { precision: 15, scale: 2 }).notNull().default("0"),
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
  committed: numeric("committed", { precision: 15, scale: 2 }).notNull().default("0"),
  pipeline: numeric("pipeline", { precision: 15, scale: 2 }).notNull().default("0"),
  probability: numeric("probability", { precision: 5, scale: 4 }).notNull().default("0"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const financialReports = org.table("financial_reports", {
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
}, (table) => [
  unique("unique_org_report").on(table.organizationId, table.reportKey)
]);