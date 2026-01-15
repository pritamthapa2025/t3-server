import {
  pgSchema,
  uuid,
  text,
  varchar,
  boolean,
  timestamp,
  integer,
  jsonb,
  numeric,
  date,
  unique,
  index,
} from "drizzle-orm/pg-core";

// Import existing tables and users from auth schema
import { users } from "./auth.schema.js";
import { organizations } from "./client.schema.js";
import {
  employees,
  userBankAccounts,
} from "./org.schema.js";
import { timesheets } from "./timesheet.schema.js";
import { jobs } from "./jobs.schema.js";

// Import payroll enums
import {
  payrollStatusEnum,
  payrollFrequencyEnum,
  paymentMethodEnum,
  deductionTypeEnum,
  benefitTypeEnum,
  approvalWorkflowEnum,
  timesheetIntegrationStatusEnum,
  lockStatusEnum,
  payTypeEnum,
  leaveTypeEnum,
  taxTypeEnum,
} from "../enums/payroll.enums.js";

const org = pgSchema("org");

/**
 * 1. Pay Periods Management
 * Manages payroll periods with automation and locking features
 */
export const payPeriods = org.table(
  "pay_periods",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, ),

    // Period Details
    periodNumber: integer("period_number").notNull(), // 1, 2, 3... for the year
    frequency: payrollFrequencyEnum("frequency").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    payDate: date("pay_date").notNull(), // When employees get paid

    // Status & Controls
    status: payrollStatusEnum("status").notNull().default("draft"),
    isHolidayPeriod: boolean("is_holiday_period").default(false),
    timesheetCutoffDate: timestamp("timesheet_cutoff_date"),
    approvalDeadline: timestamp("approval_deadline"),

    // Approval workflow and locking
    approvalWorkflow: approvalWorkflowEnum("approval_workflow")
      .notNull()
      .default("auto_from_timesheet"),
    lockStatus: lockStatusEnum("lock_status").notNull().default("unlocked"),
    lockedAt: timestamp("locked_at"),
    lockedBy: uuid("locked_by").references(() => users.id, {
    }),

    // Timesheet integration tracking
    timesheetCutoffEnforced: boolean("timesheet_cutoff_enforced").default(true),
    autoGenerateFromTimesheets: boolean(
      "auto_generate_from_timesheets"
    ).default(true),

    // Personnel
    createdBy: uuid("created_by").references(() => users.id, {
    }),
    approvedBy: uuid("approved_by").references(() => users.id, {
    }),
    processedBy: uuid("processed_by").references(() => users.id, {
    }),

    notes: text("notes"),
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    unique("unique_pay_period").on(
      table.organizationId,
      table.frequency,
      table.startDate,
      table.endDate
    ),
    index("idx_pay_periods_org_status").on(table.organizationId, table.status),
    index("idx_pay_periods_pay_date").on(table.payDate),
    index("idx_pay_periods_lock_status").on(table.lockStatus),
    index("idx_pay_periods_workflow").on(table.approvalWorkflow),
  ]
);

/**
 * 2. Employee Compensation Rules
 * Defines compensation rules and rates for employees
 */
export const employeeCompensation = org.table(
  "employee_compensation",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id, ),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, ),

    // Pay Structure
    baseSalary: numeric("base_salary", { precision: 15, scale: 2 }),
    hourlyRate: numeric("hourly_rate", { precision: 10, scale: 2 }),
    payType: payTypeEnum("pay_type").notNull(),
    payFrequency: payrollFrequencyEnum("pay_frequency").notNull(),

    // Overtime Rules (matches frontend logic)
    overtimeMultiplier: numeric("overtime_multiplier", {
      precision: 5,
      scale: 2,
    }).default("1.5"),
    doubleOvertimeMultiplier: numeric("double_overtime_multiplier", {
      precision: 5,
      scale: 2,
    }).default("2.0"),
    overtimeThresholdDaily: numeric("overtime_threshold_daily", {
      precision: 5,
      scale: 2,
    }).default("8.0"),
    overtimeThresholdWeekly: numeric("overtime_threshold_weekly", {
      precision: 5,
      scale: 2,
    }).default("40.0"),

    // Holiday & PTO Rules
    holidayMultiplier: numeric("holiday_multiplier", {
      precision: 5,
      scale: 2,
    }).default("1.5"),
    ptoAccrualRate: numeric("pto_accrual_rate", { precision: 5, scale: 4 }), // Hours per pay period
    sickAccrualRate: numeric("sick_accrual_rate", { precision: 5, scale: 4 }),

    // Effective Dates
    effectiveDate: date("effective_date").notNull(),
    endDate: date("end_date"),

    createdBy: uuid("created_by").references(() => users.id, {
    }),
    notes: text("notes"),
    isActive: boolean("is_active").default(true),
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_employee_compensation_employee").on(table.employeeId),
    index("idx_employee_compensation_org").on(table.organizationId),
    index("idx_employee_compensation_active").on(
      table.isActive,
      table.effectiveDate
    ),
    index("idx_employee_compensation_dates").on(
      table.effectiveDate,
      table.endDate
    ),
  ]
);

/**
 * 3. Payroll Runs (Batch Processing)
 * Manages batch payroll processing runs
 */
export const payrollRuns = org.table(
  "payroll_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, ),
    payPeriodId: uuid("pay_period_id")
      .notNull()
      .references(() => payPeriods.id, ),

    // Run Details
    runNumber: varchar("run_number", { length: 50 }).notNull(), // PAY-2025-W-50-001
    runType: varchar("run_type", { length: 20 }).default("regular"), // regular, bonus, correction
    status: payrollStatusEnum("status").notNull().default("draft"),

    // Totals (matches frontend summary)
    totalEmployees: integer("total_employees").default(0),
    totalGrossPay: numeric("total_gross_pay", {
      precision: 15,
      scale: 2,
    }).default("0"),
    totalDeductions: numeric("total_deductions", {
      precision: 15,
      scale: 2,
    }).default("0"),
    totalNetPay: numeric("total_net_pay", { precision: 15, scale: 2 }).default(
      "0"
    ),
    totalEmployerTaxes: numeric("total_employer_taxes", {
      precision: 15,
      scale: 2,
    }).default("0"),
    totalRegularHours: numeric("total_regular_hours", {
      precision: 10,
      scale: 2,
    }).default("0"),
    totalOvertimeHours: numeric("total_overtime_hours", {
      precision: 10,
      scale: 2,
    }).default("0"),
    totalBonuses: numeric("total_bonuses", { precision: 15, scale: 2 }).default(
      "0"
    ),

    // Processing Timeline
    calculatedAt: timestamp("calculated_at"),
    approvedAt: timestamp("approved_at"),
    processedAt: timestamp("processed_at"),
    paidAt: timestamp("paid_at"),

    // Personnel
    createdBy: uuid("created_by").references(() => users.id, {
    }),
    approvedBy: uuid("approved_by").references(() => users.id, {
    }),
    processedBy: uuid("processed_by").references(() => users.id, {
    }),

    notes: text("notes"),
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    unique("unique_payroll_run_number").on(
      table.organizationId,
      table.runNumber
    ),
    index("idx_payroll_runs_org_status").on(table.organizationId, table.status),
    index("idx_payroll_runs_pay_period").on(table.payPeriodId),
    index("idx_payroll_runs_processed_at").on(table.processedAt),
  ]
);

/**
 * 4. Individual Payroll Entries (Core Table)
 * Individual employee payroll entries with detailed breakdowns
 */
export const payrollEntries = org.table(
  "payroll_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, ),
    payrollRunId: uuid("payroll_run_id")
      .notNull()
      .references(() => payrollRuns.id, ),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id, ),

    // Entry Details
    entryNumber: varchar("entry_number", { length: 50 }).notNull(), // PAY-W-2025-50-001
    status: payrollStatusEnum("status").notNull().default("draft"),

    // Automation and approval tracking
    sourceType: varchar("source_type", { length: 50 })
      .notNull()
      .default("manual"), // "timesheet_auto", "manual", "correction"
    timesheetIntegrationStatus: timesheetIntegrationStatusEnum(
      "timesheet_integration_status"
    ).default("manual_override"),
    autoApprovalReason: text("auto_approval_reason"), // "timesheet_approved", "manager_override"

    // Approval workflow
    approvalWorkflow: approvalWorkflowEnum("approval_workflow")
      .notNull()
      .default("manual"),
    autoApprovedAt: timestamp("auto_approved_at"),
    requiresManagerApproval: boolean("requires_manager_approval").default(
      false
    ),

    // Lock status
    isLocked: boolean("is_locked").default(false),
    lockedReason: varchar("locked_reason", { length: 100 }), // "pay_period_locked", "executive_locked"

    // Hours Breakdown (matches frontend PayoutEntry interface)
    regularHours: numeric("regular_hours", { precision: 8, scale: 2 }).default(
      "0"
    ),
    overtimeHours: numeric("overtime_hours", {
      precision: 8,
      scale: 2,
    }).default("0"),
    doubleOvertimeHours: numeric("double_overtime_hours", {
      precision: 8,
      scale: 2,
    }).default("0"),
    ptoHours: numeric("pto_hours", { precision: 8, scale: 2 }).default("0"),
    sickHours: numeric("sick_hours", { precision: 8, scale: 2 }).default("0"),
    holidayHours: numeric("holiday_hours", { precision: 8, scale: 2 }).default(
      "0"
    ),
    totalHours: numeric("total_hours", { precision: 8, scale: 2 }).default("0"),

    // Pay Rates (snapshot at time of payroll)
    hourlyRate: numeric("hourly_rate", { precision: 10, scale: 2 }).notNull(),
    overtimeMultiplier: numeric("overtime_multiplier", {
      precision: 5,
      scale: 2,
    }).default("1.5"),
    doubleOvertimeMultiplier: numeric("double_overtime_multiplier", {
      precision: 5,
      scale: 2,
    }).default("2.0"),
    holidayMultiplier: numeric("holiday_multiplier", {
      precision: 5,
      scale: 2,
    }).default("1.5"),

    // Pay Breakdown (matches frontend calculatePay function)
    regularPay: numeric("regular_pay", { precision: 15, scale: 2 }).default(
      "0"
    ),
    overtimePay: numeric("overtime_pay", { precision: 15, scale: 2 }).default(
      "0"
    ),
    doubleOvertimePay: numeric("double_overtime_pay", {
      precision: 15,
      scale: 2,
    }).default("0"),
    ptoPay: numeric("pto_pay", { precision: 15, scale: 2 }).default("0"),
    sickPay: numeric("sick_pay", { precision: 15, scale: 2 }).default("0"),
    holidayPay: numeric("holiday_pay", { precision: 15, scale: 2 }).default(
      "0"
    ),
    bonuses: numeric("bonuses", { precision: 15, scale: 2 }).default("0"),

    // Totals
    grossPay: numeric("gross_pay", { precision: 15, scale: 2 }).notNull(),
    totalDeductions: numeric("total_deductions", {
      precision: 15,
      scale: 2,
    }).default("0"),
    netPay: numeric("net_pay", { precision: 15, scale: 2 }).notNull(),

    // Payment Details (matches frontend payment methods)
    paymentMethod: paymentMethodEnum("payment_method")
      .notNull()
      .default("direct_deposit"),
    bankAccountId: uuid("bank_account_id").references(
      () => userBankAccounts.id,
    ),
    checkNumber: varchar("check_number", { length: 50 }),

    // Processing
    scheduledDate: date("scheduled_date"),
    processedDate: date("processed_date"),
    paidDate: date("paid_date"),
    processedBy: uuid("processed_by").references(() => users.id, {
    }),

    notes: text("notes"),
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    unique("unique_payroll_entry_number").on(
      table.organizationId,
      table.entryNumber
    ),
    index("idx_payroll_entries_run").on(table.payrollRunId),
    index("idx_payroll_entries_employee").on(table.employeeId),
    index("idx_payroll_entries_status").on(table.status),
    index("idx_payroll_entries_scheduled_date").on(table.scheduledDate),
    index("idx_payroll_entries_source_type").on(table.sourceType),
    index("idx_payroll_entries_integration_status").on(
      table.timesheetIntegrationStatus
    ),
    index("idx_payroll_entries_locked").on(table.isLocked),
  ]
);

/**
 * 5. Timesheet-Payroll Integration Log
 * Tracks automation between timesheets and payroll
 */
export const timesheetPayrollIntegrationLog = org.table(
  "timesheet_payroll_integration_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    payrollEntryId: uuid("payroll_entry_id")
      .notNull()
      .references(() => payrollEntries.id, ),

    // Source timesheet tracking
    timesheetIds: jsonb("timesheet_ids").notNull(), // Array of timesheet IDs that contributed
    totalTimesheetsProcessed: integer("total_timesheets_processed").notNull(),

    // Automation details
    integrationStatus:
      timesheetIntegrationStatusEnum("integration_status").notNull(),
    autoGenerationTriggered: boolean("auto_generation_triggered").default(
      false
    ),
    autoApprovalTriggered: boolean("auto_approval_triggered").default(false),

    // Job reference consolidation (from dispatch integration)
    jobReferences: jsonb("job_references"), // Array of {jobId, jobName, totalHours, timesheetIds}
    totalJobHours: numeric("total_job_hours", { precision: 8, scale: 2 }),

    // Processing metadata
    generatedAt: timestamp("generated_at").defaultNow(),
    generatedBy: varchar("generated_by", { length: 50 }).default("system"), // "system", "manager_override"

    // Error tracking
    integrationErrors: jsonb("integration_errors"), // Array of error messages
    retryCount: integer("retry_count").default(0),

    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_timesheet_payroll_integration_entry").on(table.payrollEntryId),
    index("idx_timesheet_payroll_integration_status").on(
      table.integrationStatus
    ),
    index("idx_timesheet_payroll_integration_generated_at").on(
      table.generatedAt
    ),
  ]
);

/**
 * 6. Payroll Timesheet Entries
 * Links payroll entries to specific timesheets
 */
export const payrollTimesheetEntries = org.table(
  "payroll_timesheet_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    payrollEntryId: uuid("payroll_entry_id")
      .notNull()
      .references(() => payrollEntries.id, ),
    timesheetId: integer("timesheet_id")
      .notNull()
      .references(() => timesheets.id, ),

    // Hours from timesheet
    hoursIncluded: numeric("hours_included", {
      precision: 8,
      scale: 2,
    }).notNull(),
    overtimeHours: numeric("overtime_hours", {
      precision: 8,
      scale: 2,
    }).default("0"),
    doubleOvertimeHours: numeric("double_overtime_hours", {
      precision: 8,
      scale: 2,
    }).default("0"),

    // Job allocation (if timesheet has job references)
    jobId: uuid("job_id").references(() => jobs.id, ),
    jobHours: numeric("job_hours", { precision: 8, scale: 2 }).default("0"),

    // Processing details
    includedInPayroll: boolean("included_in_payroll").default(true),
    exclusionReason: text("exclusion_reason"),

    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    unique("unique_payroll_timesheet").on(
      table.payrollEntryId,
      table.timesheetId
    ),
    index("idx_payroll_timesheet_entries_payroll").on(table.payrollEntryId),
    index("idx_payroll_timesheet_entries_timesheet").on(table.timesheetId),
    index("idx_payroll_timesheet_entries_job").on(table.jobId),
  ]
);

/**
 * 7. Payroll Approval Workflow
 * Manages approval workflows for payroll processing
 */
export const payrollApprovalWorkflow = org.table(
  "payroll_approval_workflow",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    payrollRunId: uuid("payroll_run_id")
      .notNull()
      .references(() => payrollRuns.id, ),
    payrollEntryId: uuid("payroll_entry_id").references(
      () => payrollEntries.id,
    ),

    // Workflow details
    workflowType: approvalWorkflowEnum("workflow_type").notNull(),
    currentStep: varchar("current_step", { length: 50 }).notNull(), // "timesheet_review", "auto_approval", "manager_approval"
    totalSteps: integer("total_steps").notNull(),

    // Approval chain
    approvalChain: jsonb("approval_chain"), // Array of {step, approver, status, timestamp}
    currentApprover: uuid("current_approver").references(() => users.id, {
    }),

    // Auto-approval tracking
    autoApprovalTriggered: boolean("auto_approval_triggered").default(false),
    autoApprovalReason: text("auto_approval_reason"),
    autoApprovalTimestamp: timestamp("auto_approval_timestamp"),

    // Manual override capability
    manualOverrideAllowed: boolean("manual_override_allowed").default(true),
    overriddenBy: uuid("overridden_by").references(() => users.id, {
    }),
    overrideReason: text("override_reason"),

    status: payrollStatusEnum("status").notNull().default("pending_approval"),
    completedAt: timestamp("completed_at"),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_payroll_approval_workflow_run").on(table.payrollRunId),
    index("idx_payroll_approval_workflow_entry").on(table.payrollEntryId),
    index("idx_payroll_approval_workflow_status").on(table.status),
    index("idx_payroll_approval_workflow_approver").on(table.currentApprover),
  ]
);

/**
 * 8. Payroll Lock Management
 * Manages locking of payroll periods, runs, and entries
 */
export const payrollLocks = org.table(
  "payroll_locks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, ),

    // Lock scope
    lockScope: varchar("lock_scope", { length: 50 }).notNull(), // "pay_period", "payroll_run", "individual_entry"
    referenceType: varchar("reference_type", { length: 50 }).notNull(), // "pay_period", "payroll_run", "payroll_entry"
    referenceId: uuid("reference_id").notNull(),

    // Lock details
    lockStatus: lockStatusEnum("lock_status").notNull(),
    lockReason: varchar("lock_reason", { length: 100 }).notNull(), // "auto_approval", "executive_lock", "compliance_lock"

    // Lock metadata
    lockedAt: timestamp("locked_at").notNull(),
    lockedBy: uuid("locked_by").references(() => users.id, {
    }),

    // Unlock capability (for executives)
    canUnlock: boolean("can_unlock").default(false),
    unlockRequiresReason: boolean("unlock_requires_reason").default(true),

    // Unlock tracking
    unlockedAt: timestamp("unlocked_at"),
    unlockedBy: uuid("unlocked_by").references(() => users.id, {
    }),
    unlockReason: text("unlock_reason"),

    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    unique("unique_active_lock").on(
      table.referenceType,
      table.referenceId,
      table.isActive
    ),
    index("idx_payroll_locks_org").on(table.organizationId),
    index("idx_payroll_locks_reference").on(
      table.referenceType,
      table.referenceId
    ),
    index("idx_payroll_locks_status").on(table.lockStatus),
  ]
);

/**
 * 9. Payroll Deductions
 * Manages various payroll deductions for employees
 */
export const payrollDeductions = org.table(
  "payroll_deductions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    payrollEntryId: uuid("payroll_entry_id")
      .notNull()
      .references(() => payrollEntries.id, ),

    // Deduction Details
    deductionType: deductionTypeEnum("deduction_type").notNull(),
    description: varchar("description", { length: 255 }).notNull(),

    // Calculation
    isPercentage: boolean("is_percentage").default(false),
    rate: numeric("rate", { precision: 10, scale: 6 }), // 0.0625 for 6.25%
    amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),

    // Limits & YTD tracking
    maxAmount: numeric("max_amount", { precision: 15, scale: 2 }),
    yearToDateAmount: numeric("year_to_date_amount", {
      precision: 15,
      scale: 2,
    }).default("0"),
    employerAmount: numeric("employer_amount", {
      precision: 15,
      scale: 2,
    }).default("0"),

    // Tax brackets (for tax deductions)
    taxBracket: varchar("tax_bracket", { length: 50 }),

    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_payroll_deductions_entry").on(table.payrollEntryId),
    index("idx_payroll_deductions_type").on(table.deductionType),
  ]
);

/**
 * 10. Employee Benefits
 * Manages employee benefit configurations
 */
export const employeeBenefits = org.table(
  "employee_benefits",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id, ),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, ),

    // Benefit Details
    benefitType: benefitTypeEnum("benefit_type").notNull(),
    planName: varchar("plan_name", { length: 255 }),
    description: text("description"),

    // Cost Structure
    employeeContribution: numeric("employee_contribution", {
      precision: 15,
      scale: 2,
    }).default("0"),
    employerContribution: numeric("employer_contribution", {
      precision: 15,
      scale: 2,
    }).default("0"),
    isPercentage: boolean("is_percentage").default(false),
    coverageLevel: varchar("coverage_level", { length: 50 }), // employee, family, spouse+children

    // Effective Dates
    effectiveDate: date("effective_date").notNull(),
    endDate: date("end_date"),

    isActive: boolean("is_active").default(true),
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_employee_benefits_employee").on(table.employeeId),
    index("idx_employee_benefits_org").on(table.organizationId),
    index("idx_employee_benefits_type").on(table.benefitType),
    index("idx_employee_benefits_active").on(
      table.isActive,
      table.effectiveDate
    ),
  ]
);

/**
 * 11. Employee Leave Balances
 * Tracks PTO, sick leave, and other leave balances
 */
export const employeeLeaveBalances = org.table(
  "employee_leave_balances",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id, ),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, ),

    // Balance Details
    leaveType: leaveTypeEnum("leave_type").notNull(),

    // Balances (in hours)
    currentBalance: numeric("current_balance", {
      precision: 8,
      scale: 2,
    }).default("0"),
    accrualRate: numeric("accrual_rate", { precision: 5, scale: 4 }), // Hours per pay period
    maxBalance: numeric("max_balance", { precision: 8, scale: 2 }),

    // Year-to-date tracking
    ytdAccrued: numeric("ytd_accrued", { precision: 8, scale: 2 }).default("0"),
    ytdUsed: numeric("ytd_used", { precision: 8, scale: 2 }).default("0"),

    // Dates
    balanceAsOfDate: date("balance_as_of_date").notNull(),
    lastAccrualDate: date("last_accrual_date"),

    isDeleted: boolean("is_deleted").default(false),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    unique("unique_employee_leave_type").on(table.employeeId, table.leaveType),
    index("idx_employee_leave_balances_employee").on(table.employeeId),
    index("idx_employee_leave_balances_org").on(table.organizationId),
  ]
);

/**
 * 12. Payroll Audit Log
 * Comprehensive audit trail for all payroll changes
 */
export const payrollAuditLog = org.table(
  "payroll_audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, ),

    // Reference (payroll run, entry, compensation change)
    referenceType: varchar("reference_type", { length: 50 }).notNull(),
    referenceId: uuid("reference_id").notNull(),

    // Action Details
    action: varchar("action", { length: 100 }).notNull(), // created, approved, processed, paid, locked, unlocked
    oldValues: jsonb("old_values"),
    newValues: jsonb("new_values"),
    description: text("description"),

    // Automation tracking
    isAutomatedAction: boolean("is_automated_action").default(false),
    automationSource: varchar("automation_source", { length: 50 }), // "timesheet_integration", "auto_approval"

    // Personnel
    performedBy: uuid("performed_by")
      .notNull()
      .references(() => users.id, ),

    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_payroll_audit_org").on(table.organizationId),
    index("idx_payroll_audit_reference").on(
      table.referenceType,
      table.referenceId
    ),
    index("idx_payroll_audit_performed_by").on(table.performedBy),
    index("idx_payroll_audit_created_at").on(table.createdAt),
    index("idx_payroll_audit_automated").on(table.isAutomatedAction),
  ]
);

/**
 * 13. Tax Tables
 * Configurable tax calculation tables
 */
export const taxTables = org.table(
  "tax_tables",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // Tax Details
    taxType: taxTypeEnum("tax_type").notNull(),
    jurisdiction: varchar("jurisdiction", { length: 100 }).notNull(), // US, CA, NY
    taxYear: integer("tax_year").notNull(),

    // Tax brackets and rules
    brackets: jsonb("brackets").notNull(), // Array of {min, max, rate, flatAmount}
    standardDeduction: numeric("standard_deduction", {
      precision: 15,
      scale: 2,
    }).default("0"),
    personalExemption: numeric("personal_exemption", {
      precision: 15,
      scale: 2,
    }).default("0"),

    // Effective Dates
    effectiveDate: date("effective_date").notNull(),
    endDate: date("end_date"),

    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    unique("unique_tax_table").on(
      table.taxType,
      table.jurisdiction,
      table.taxYear
    ),
    index("idx_tax_tables_type_jurisdiction").on(
      table.taxType,
      table.jurisdiction
    ),
    index("idx_tax_tables_year").on(table.taxYear),
    index("idx_tax_tables_active").on(table.isActive),
  ]
);
