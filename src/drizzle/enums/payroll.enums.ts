import { pgEnum } from "drizzle-orm/pg-core";

/**
 * Payroll Status Enum
 * Represents the various stages of payroll processing
 */
export const payrollStatusEnum = pgEnum("payroll_status_enum", [
  "draft",
  "pending_approval",
  "approved",
  "processed",
  "paid",
  "failed",
  "cancelled"
]);

/**
 * Payroll Frequency Enum
 * Defines how often payroll is run
 */
export const payrollFrequencyEnum = pgEnum("payroll_frequency_enum", [
  "weekly",
  "bi_weekly",
  "monthly",
  "semi_monthly"
]);

/**
 * Payment Method Enum
 * Different ways employees can receive their pay
 */
export const paymentMethodEnum = pgEnum("payment_method_enum", [
  "direct_deposit",
  "check",
  "cash",
  "wire_transfer"
]);

/**
 * Deduction Type Enum
 * Various types of payroll deductions
 */
export const deductionTypeEnum = pgEnum("deduction_type_enum", [
  "federal_tax",
  "state_tax",
  "social_security",
  "medicare",
  "health_insurance",
  "dental_insurance",
  "vision_insurance",
  "retirement_401k",
  "life_insurance",
  "disability_insurance",
  "union_dues",
  "garnishment",
  "other"
]);

/**
 * Benefit Type Enum
 * Types of employee benefits
 */
export const benefitTypeEnum = pgEnum("benefit_type_enum", [
  "health_insurance",
  "dental_insurance",
  "vision_insurance",
  "life_insurance",
  "disability_insurance",
  "retirement_401k",
  "pto_accrual",
  "sick_leave",
  "holiday_pay",
  "other"
]);

/**
 * Approval Workflow Enum
 * Different types of approval workflows for payroll
 */
export const approvalWorkflowEnum = pgEnum("approval_workflow_enum", [
  "manual",
  "auto_from_timesheet",
  "manager_approval_required",
  "executive_approval_required"
]);

/**
 * Timesheet Integration Status Enum
 * Status of timesheet integration with payroll
 */
export const timesheetIntegrationStatusEnum = pgEnum("timesheet_integration_status_enum", [
  "pending_timesheet",
  "timesheet_approved",
  "auto_generated",
  "manual_override"
]);

/**
 * Lock Status Enum
 * Different lock states for payroll periods and entries
 */
export const lockStatusEnum = pgEnum("lock_status_enum", [
  "unlocked",
  "auto_locked",
  "executive_locked"
]);

/**
 * Pay Type Enum
 * Different employee pay structures
 */
export const payTypeEnum = pgEnum("pay_type_enum", [
  "hourly",
  "salary",
  "commission",
  "contract"
]);

/**
 * Leave Type Enum
 * Different types of employee leave
 */
export const leaveTypeEnum = pgEnum("leave_type_enum", [
  "pto",
  "sick",
  "vacation",
  "personal",
  "bereavement",
  "jury_duty",
  "military",
  "unpaid"
]);

/**
 * Tax Type Enum
 * Different types of taxes for tax tables
 */
export const taxTypeEnum = pgEnum("tax_type_enum", [
  "federal_income",
  "state_income",
  "local_income",
  "social_security",
  "medicare",
  "unemployment_federal",
  "unemployment_state",
  "disability_state",
  "workers_compensation"
]);








