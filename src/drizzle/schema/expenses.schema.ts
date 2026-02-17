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
import { organizations } from "./client.schema.js";
import { employees } from "./org.schema.js";
import { jobs } from "./jobs.schema.js";

// Import enums from centralized location
import {
  expenseStatusEnum,
  expenseTypeEnum,
  expensePaymentMethodEnum,
  expenseReportStatusEnum,
  approvalStatusEnum,
  reimbursementStatusEnum,
  mileageTypeEnum,
  taxStatusEnum,
  receiptStatusEnum,
  budgetPeriodEnum,
  expenseCategoryEnum,
} from "../enums/expenses.enums.js";

const org = pgSchema("org");

/**
 * Expenses Table
 * Individual expense records
 */
export const expenses = org.table(
  "expenses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    expenseNumber: varchar("expense_number", { length: 100 }).notNull(),

    // Category (enum: materials, equipment, fleet, etc.)
    category: expenseCategoryEnum("category").notNull().default("other"),
    jobId: uuid("job_id").references(() => jobs.id), // Optional - only for job-related expenses

    // Source tracking
    sourceId: uuid("source_id"), // Links to source record (job_expense.id, fleet_repair.id, purchase_order.id, etc.)

    // Reimbursement
    isReimbursable: boolean("is_reimbursable").default(false),
    reimbursementStatus: reimbursementStatusEnum("reimbursement_status"),
    reimbursementAmount: numeric("reimbursement_amount", {
      precision: 15,
      scale: 2,
    }),

    // Expense Details
    status: expenseStatusEnum("status").notNull().default("draft"),
    expenseType: expenseTypeEnum("expense_type").notNull(),
    paymentMethod: expensePaymentMethodEnum("payment_method").notNull(),

    // Basic Information
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    vendor: varchar("vendor", { length: 255 }),
    location: varchar("location", { length: 255 }),

    // Financial
    amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).default("USD"),
    exchangeRate: numeric("exchange_rate", { precision: 10, scale: 6 })
      .notNull()
      .default("1"),
    amountInBaseCurrency: numeric("amount_in_base_currency", {
      precision: 15,
      scale: 2,
    }).notNull(),

    // Tax Information
    taxStatus: taxStatusEnum("tax_status").notNull().default("deductible"),
    taxAmount: numeric("tax_amount", { precision: 15, scale: 2 })
      .notNull()
      .default("0"),
    taxRate: numeric("tax_rate", { precision: 5, scale: 4 })
      .notNull()
      .default("0"),

    // Dates
    expenseDate: date("expense_date").notNull(),
    submittedDate: timestamp("submitted_date"),
    approvedDate: timestamp("approved_date"),
    paidDate: timestamp("paid_date"),

    // Receipt Information
    receiptStatus: receiptStatusEnum("receipt_status")
      .notNull()
      .default("required"),
    receiptNumber: varchar("receipt_number", { length: 100 }),
    hasReceipt: boolean("has_receipt").default(false),
    receiptTotal: numeric("receipt_total", { precision: 15, scale: 2 }),

    // Mileage (for travel expenses - company vehicles)
    isMileageExpense: boolean("is_mileage_expense").default(false),
    mileageType: mileageTypeEnum("mileage_type"),
    miles: numeric("miles", { precision: 10, scale: 2 }),
    mileageRate: numeric("mileage_rate", { precision: 10, scale: 4 }),
    startLocation: varchar("start_location", { length: 255 }),
    endLocation: varchar("end_location", { length: 255 }),

    // Approval
    requiresApproval: boolean("requires_approval").default(true),
    approvedBy: uuid("approved_by").references(() => users.id),
    rejectedBy: uuid("rejected_by").references(() => users.id),
    rejectionReason: text("rejection_reason"),

    // Additional Information
    businessPurpose: text("business_purpose"),
    attendees: text("attendees"), // For meal/entertainment expenses
    notes: text("notes"),
    internalNotes: text("internal_notes"),

    // Metadata
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),

    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    // Indexes for performance
    index("idx_expenses_category").on(table.category),
    index("idx_expenses_job").on(table.jobId),
    index("idx_expenses_source").on(table.sourceId),
    index("idx_expenses_status").on(table.status),
    index("idx_expenses_type").on(table.expenseType),
    index("idx_expenses_expense_date").on(table.expenseDate),
    index("idx_expenses_submitted_date").on(table.submittedDate),
    index("idx_expenses_approved_by").on(table.approvedBy),
    index("idx_expenses_is_deleted").on(table.isDeleted),
    index("idx_expenses_created_at").on(table.createdAt),
    index("idx_expenses_number").on(table.expenseNumber),
  ],
);

/**
 * Expense Reports Table
 * Grouped expense submissions (weekly/monthly reports)
 */
export const expenseReports = org.table(
  "expense_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reportNumber: varchar("report_number", { length: 100 }).notNull(),

    // Relationships
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id),

    // Report Details
    status: expenseReportStatusEnum("status").notNull().default("draft"),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),

    // Period
    reportPeriodStart: date("report_period_start").notNull(),
    reportPeriodEnd: date("report_period_end").notNull(),

    // Financial Summary
    totalExpenses: integer("total_expenses").default(0),
    totalAmount: numeric("total_amount", { precision: 15, scale: 2 })
      .notNull()
      .default("0"),
    totalReimbursable: numeric("total_reimbursable", {
      precision: 15,
      scale: 2,
    })
      .notNull()
      .default("0"),
    totalNonReimbursable: numeric("total_non_reimbursable", {
      precision: 15,
      scale: 2,
    })
      .notNull()
      .default("0"),
    totalMileage: numeric("total_mileage", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    totalMileageAmount: numeric("total_mileage_amount", {
      precision: 15,
      scale: 2,
    })
      .notNull()
      .default("0"),

    // Dates
    submittedDate: timestamp("submitted_date"),
    approvedDate: timestamp("approved_date"),
    paidDate: timestamp("paid_date"),

    // Approval
    approvedBy: uuid("approved_by").references(() => users.id),
    rejectedBy: uuid("rejected_by").references(() => users.id),
    rejectionReason: text("rejection_reason"),

    // Notes
    notes: text("notes"),
    internalNotes: text("internal_notes"),

    // Metadata
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),

    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    // Unique constraint: reportNumber unique per organization
    unique("unique_expense_report_number_per_org").on(
      table.organizationId,
      table.reportNumber,
    ),
    // Indexes for performance
    index("idx_expense_reports_org").on(table.organizationId),
    index("idx_expense_reports_employee").on(table.employeeId),
    index("idx_expense_reports_status").on(table.status),
    index("idx_expense_reports_period_start").on(table.reportPeriodStart),
    index("idx_expense_reports_period_end").on(table.reportPeriodEnd),
    index("idx_expense_reports_submitted_date").on(table.submittedDate),
    index("idx_expense_reports_approved_by").on(table.approvedBy),
    index("idx_expense_reports_is_deleted").on(table.isDeleted),
    index("idx_expense_reports_created_at").on(table.createdAt),
  ],
);

/**
 * Expense Report Items Table
 * Individual expenses within expense reports
 */
export const expenseReportItems = org.table(
  "expense_report_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    reportId: uuid("report_id")
      .notNull()
      .references(() => expenseReports.id),
    expenseId: uuid("expense_id")
      .notNull()
      .references(() => expenses.id),

    // Metadata
    addedAt: timestamp("added_at").defaultNow(),
    sortOrder: integer("sort_order").default(0),

    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    // Unique constraint: one expense per report
    unique("unique_expense_per_report").on(table.reportId, table.expenseId),
    index("idx_expense_report_items_org").on(table.organizationId),
    index("idx_expense_report_items_report").on(table.reportId),
    index("idx_expense_report_items_expense").on(table.expenseId),
  ],
);

/**
 * Expense Receipts Table
 * Receipt/document attachments for expenses
 */
export const expenseReceipts = org.table(
  "expense_receipts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    expenseId: uuid("expense_id")
      .notNull()
      .references(() => expenses.id),

    // Document Details
    fileName: varchar("file_name", { length: 255 }).notNull(),
    filePath: varchar("file_path", { length: 500 }).notNull(),
    fileType: varchar("file_type", { length: 50 }),
    fileSize: integer("file_size"),
    mimeType: varchar("mime_type", { length: 100 }),

    // Receipt Information
    receiptDate: date("receipt_date"),
    receiptNumber: varchar("receipt_number", { length: 100 }),
    receiptTotal: numeric("receipt_total", { precision: 15, scale: 2 }),
    vendor: varchar("vendor", { length: 255 }),

    // OCR/Processing
    ocrProcessed: boolean("ocr_processed").default(false),
    ocrData: jsonb("ocr_data"), // Extracted data from OCR
    ocrConfidence: numeric("ocr_confidence", { precision: 5, scale: 4 }),

    // Metadata
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => users.id),
    description: text("description"),

    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_expense_receipts_expense").on(table.expenseId),
    index("idx_expense_receipts_uploaded_by").on(table.uploadedBy),
    index("idx_expense_receipts_receipt_date").on(table.receiptDate),
  ],
);

/**
 * Expense Approvals Table
 * Approval workflow tracking for expenses
 */
export const expenseApprovals: any = org.table(
  "expense_approvals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    expenseId: uuid("expense_id").references(() => expenses.id),
    reportId: uuid("report_id").references(() => expenseReports.id),

    // Approval Details
    approvalLevel: integer("approval_level").notNull(), // 1 = Manager, 2 = Finance, etc.
    status: approvalStatusEnum("status").notNull().default("pending"),

    // Approver
    approverId: uuid("approver_id")
      .notNull()
      .references(() => users.id),
    approverRole: varchar("approver_role", { length: 50 }), // "manager", "finance", "admin"

    // Timing
    requestedAt: timestamp("requested_at").defaultNow(),
    respondedAt: timestamp("responded_at"),
    dueDate: timestamp("due_date"),

    // Response
    comments: text("comments"),
    rejectionReason: text("rejection_reason"),

    // Escalation
    escalatedFrom: uuid("escalated_from").references(
      (): any => expenseApprovals.id,
    ),
    escalatedTo: uuid("escalated_to").references(() => users.id),
    escalatedAt: timestamp("escalated_at"),

    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_expense_approvals_expense").on(table.expenseId),
    index("idx_expense_approvals_report").on(table.reportId),
    index("idx_expense_approvals_approver").on(table.approverId),
    index("idx_expense_approvals_status").on(table.status),
    index("idx_expense_approvals_due_date").on(table.dueDate),
  ],
);

/**
 * Expense Allocations Table
 * Allocation of expenses to jobs, projects, or departments
 */
export const expenseAllocations = org.table(
  "expense_allocations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    expenseId: uuid("expense_id")
      .notNull()
      .references(() => expenses.id),

    // Allocation Target
    allocationType: varchar("allocation_type", { length: 50 }).notNull(), // "job", "department", "general"
    jobId: uuid("job_id").references(() => jobs.id),
    departmentId: integer("department_id"), // Will reference departments

    // Allocation Details
    percentage: numeric("percentage", { precision: 5, scale: 2 })
      .notNull()
      .default("100"), // Percentage of expense allocated
    allocatedAmount: numeric("allocated_amount", {
      precision: 15,
      scale: 2,
    }).notNull(),

    // Cost Center/Accounting
    costCenter: varchar("cost_center", { length: 50 }),
    accountCode: varchar("account_code", { length: 50 }),

    // Notes
    notes: text("notes"),

    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_expense_allocations_expense").on(table.expenseId),
    index("idx_expense_allocations_job").on(table.jobId),
    index("idx_expense_allocations_type").on(table.allocationType),
  ],
);

/**
 * Mileage Logs Table
 * Detailed mileage tracking for company vehicle travel expenses
 */
export const mileageLogs = org.table(
  "mileage_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    expenseId: uuid("expense_id").references(() => expenses.id),

    // Trip Details
    date: date("date").notNull(),
    startLocation: varchar("start_location", { length: 255 }).notNull(),
    endLocation: varchar("end_location", { length: 255 }).notNull(),
    purpose: text("purpose").notNull(),

    // Mileage
    mileageType: mileageTypeEnum("mileage_type").notNull(),
    miles: numeric("miles", { precision: 10, scale: 2 }).notNull(),
    rate: numeric("rate", { precision: 10, scale: 4 }).notNull(),
    amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),

    // Vehicle Information
    vehicleId: uuid("vehicle_id"), // Will reference fleet vehicles
    vehicleLicense: varchar("vehicle_license", { length: 20 }),
    odometerStart: integer("odometer_start"),
    odometerEnd: integer("odometer_end"),

    // Job/Project Allocation
    jobId: uuid("job_id").references(() => jobs.id),

    // GPS/Tracking
    gpsStartCoordinates: varchar("gps_start_coordinates", { length: 50 }),
    gpsEndCoordinates: varchar("gps_end_coordinates", { length: 50 }),
    routeData: jsonb("route_data"), // GPS route information

    // Verification
    isVerified: boolean("is_verified").default(false),
    verifiedBy: uuid("verified_by").references(() => users.id),
    verifiedAt: timestamp("verified_at"),

    // Notes
    notes: text("notes"),

    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_mileage_logs_expense").on(table.expenseId),
    index("idx_mileage_logs_date").on(table.date),
    index("idx_mileage_logs_job").on(table.jobId),
    index("idx_mileage_logs_vehicle").on(table.vehicleId),
    index("idx_mileage_logs_type").on(table.mileageType),
  ],
);

/**
 * Expense Reimbursements Table
 * Reimbursement processing and payments
 */
export const expenseReimbursements = org.table(
  "expense_reimbursements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reimbursementNumber: varchar("reimbursement_number", {
      length: 100,
    }).notNull(),

    // Relationships
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id),
    reportId: uuid("report_id").references(() => expenseReports.id),

    // Reimbursement Details
    status: reimbursementStatusEnum("status").notNull().default("pending"),
    totalAmount: numeric("total_amount", { precision: 15, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).default("USD"),

    // Payment Information
    paymentMethod: varchar("payment_method", { length: 50 }), // "direct_deposit", "check", "wire"
    paymentReference: varchar("payment_reference", { length: 100 }),
    paymentDate: date("payment_date"),

    // Banking
    bankAccountId: uuid("bank_account_id"), // Reference to employee bank account
    checkNumber: varchar("check_number", { length: 50 }),

    // Processing
    requestedDate: timestamp("requested_date").defaultNow(),
    approvedDate: timestamp("approved_date"),
    processedDate: timestamp("processed_date"),
    paidDate: timestamp("paid_date"),

    // Personnel
    approvedBy: uuid("approved_by").references(() => users.id),
    processedBy: uuid("processed_by").references(() => users.id),

    // Notes
    notes: text("notes"),
    internalNotes: text("internal_notes"),

    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    // Unique constraint: reimbursementNumber unique per organization
    unique("unique_reimbursement_number_per_org").on(
      table.organizationId,
      table.reimbursementNumber,
    ),
    index("idx_expense_reimbursements_org").on(table.organizationId),
    index("idx_expense_reimbursements_employee").on(table.employeeId),
    index("idx_expense_reimbursements_report").on(table.reportId),
    index("idx_expense_reimbursements_status").on(table.status),
    index("idx_expense_reimbursements_payment_date").on(table.paymentDate),
    index("idx_expense_reimbursements_approved_by").on(table.approvedBy),
  ],
);

/**
 * Expense Reimbursement Items Table
 * Individual expenses within reimbursements
 */
export const expenseReimbursementItems = org.table(
  "expense_reimbursement_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    reimbursementId: uuid("reimbursement_id")
      .notNull()
      .references(() => expenseReimbursements.id),
    expenseId: uuid("expense_id")
      .notNull()
      .references(() => expenses.id),

    // Reimbursement Details
    reimbursementAmount: numeric("reimbursement_amount", {
      precision: 15,
      scale: 2,
    }).notNull(),

    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    // Unique constraint: one expense per reimbursement
    unique("unique_expense_per_reimbursement").on(
      table.reimbursementId,
      table.expenseId,
    ),
    index("idx_expense_reimbursement_items_org").on(table.organizationId),
    index("idx_expense_reimbursement_items_reimbursement").on(
      table.reimbursementId,
    ),
    index("idx_expense_reimbursement_items_expense").on(table.expenseId),
  ],
);

/**
 * Expense Budgets Table
 * Budget tracking by category, department, or project
 */
export const expenseBudgets = org.table(
  "expense_budgets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),

    // Budget Scope
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    budgetType: varchar("budget_type", { length: 50 }).notNull(), // "category", "department", "employee", "project"

    // References
    category: expenseCategoryEnum("category"), // When budgetType is "category"
    departmentId: integer("department_id"), // Will reference departments
    employeeId: integer("employee_id").references(() => employees.id),
    jobId: uuid("job_id").references(() => jobs.id),

    // Period
    budgetPeriod: budgetPeriodEnum("budget_period").notNull(),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),

    // Budget Amounts
    budgetAmount: numeric("budget_amount", {
      precision: 15,
      scale: 2,
    }).notNull(),
    spentAmount: numeric("spent_amount", { precision: 15, scale: 2 })
      .notNull()
      .default("0"),
    committedAmount: numeric("committed_amount", { precision: 15, scale: 2 })
      .notNull()
      .default("0"),
    remainingAmount: numeric("remaining_amount", {
      precision: 15,
      scale: 2,
    }).notNull(),

    // Alerts
    warningThreshold: numeric("warning_threshold", {
      precision: 5,
      scale: 2,
    }).default("80"), // Percentage
    alertThreshold: numeric("alert_threshold", {
      precision: 5,
      scale: 2,
    }).default("90"), // Percentage

    // Status
    isActive: boolean("is_active").default(true),

    // Metadata
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),

    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_expense_budgets_org").on(table.organizationId),
    index("idx_expense_budgets_type").on(table.budgetType),
    index("idx_expense_budgets_category").on(table.category),
    index("idx_expense_budgets_employee").on(table.employeeId),
    index("idx_expense_budgets_job").on(table.jobId),
    index("idx_expense_budgets_period").on(table.budgetPeriod),
    index("idx_expense_budgets_period_start").on(table.periodStart),
    index("idx_expense_budgets_period_end").on(table.periodEnd),
    index("idx_expense_budgets_active").on(table.isActive),
  ],
);

/**
 * Expense History Table
 * Audit trail for expense changes
 */
export const expenseHistory = org.table(
  "expense_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    expenseId: uuid("expense_id")
      .notNull()
      .references(() => expenses.id),

    // History Details
    action: varchar("action", { length: 100 }).notNull(), // "created", "status_changed", "amount_updated", "approved", "rejected", etc.
    oldValue: text("old_value"),
    newValue: text("new_value"),
    description: text("description"),

    // Context
    reportId: uuid("report_id").references(() => expenseReports.id),

    // Metadata
    performedBy: uuid("performed_by")
      .notNull()
      .references(() => users.id),

    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_expense_history_expense").on(table.expenseId),
    index("idx_expense_history_performed_by").on(table.performedBy),
    index("idx_expense_history_created_at").on(table.createdAt),
    index("idx_expense_history_action").on(table.action),
  ],
);
