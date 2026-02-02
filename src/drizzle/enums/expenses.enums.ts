import { pgEnum } from "drizzle-orm/pg-core";

/**
 * Expense Status Enum
 * Status of individual expenses
 */
export const expenseStatusEnum = pgEnum("expense_status_enum", [
  "draft",
  "submitted",
  "approved",
  "rejected",
  "paid",
  "reimbursed",
  "cancelled",
]);

/**
 * Expense Type Enum
 * Categories of business expenses + source-based types
 */
export const expenseTypeEnum = pgEnum("expense_type_enum", [
  "travel",
  "meals",
  "accommodation",
  "fuel",
  "vehicle_maintenance",
  "equipment",
  "materials",
  "tools",
  "permits",
  "licenses",
  "insurance",
  "professional_services",
  "subcontractor",
  "office_supplies",
  "utilities",
  "marketing",
  "training",
  "software",
  "subscriptions",
  "other",
  "job_labor",
  "job_material",
  "job_service",
  "job_travel",
  "fleet_repair",
  "fleet_maintenance",
  "fleet_fuel",
  "fleet_purchase",
  "inventory_purchase",
  "manual",
]);

/**
 * Expense Payment Method Enum
 * How the expense was paid
 */
export const expensePaymentMethodEnum = pgEnum("expense_payment_method_enum", [
  "cash",
  "personal_card",
  "company_card",
  "check",
  "bank_transfer",
  "petty_cash",
  "other",
]);

/**
 * Expense Report Status Enum
 * Status of expense reports
 */
export const expenseReportStatusEnum = pgEnum("expense_report_status_enum", [
  "draft",
  "submitted",
  "under_review",
  "approved",
  "rejected",
  "paid",
  "closed",
]);

/**
 * Approval Status Enum
 * Status in approval workflow
 */
export const approvalStatusEnum = pgEnum("approval_status_enum", [
  "pending",
  "approved",
  "rejected",
  "escalated",
]);

/**
 * Reimbursement Status Enum
 * Status of reimbursement processing
 */
export const reimbursementStatusEnum = pgEnum("reimbursement_status_enum", [
  "pending",
  "approved",
  "processing",
  "paid",
  "rejected",
  "cancelled",
]);

/**
 * Mileage Type Enum
 * Types of mileage tracking
 */
export const mileageTypeEnum = pgEnum("mileage_type_enum", [
  "business",
  "commute",
  "personal",
]);

/**
 * Tax Status Enum
 * Tax deductibility status
 */
export const taxStatusEnum = pgEnum("tax_status_enum", [
  "deductible",
  "non_deductible",
  "partial",
  "unknown",
]);

/**
 * Receipt Status Enum
 * Status of receipt documentation
 */
export const receiptStatusEnum = pgEnum("receipt_status_enum", [
  "required",
  "submitted",
  "missing",
  "waived",
]);

/**
 * Budget Period Enum
 * Budget tracking periods
 */
export const budgetPeriodEnum = pgEnum("budget_period_enum", [
  "monthly",
  "quarterly",
  "yearly",
  "project",
  "custom",
]);
