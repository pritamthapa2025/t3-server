import { pgEnum } from "drizzle-orm/pg-core";

/**
 * Invoice Status Enum
 * Status of invoices
 */
export const invoiceStatusEnum = pgEnum("invoice_status_enum", [
  "draft",
  "pending",
  "sent",
  "viewed",
  "partial",
  "paid",
  "overdue",
  "cancelled",
  "void",
]);

/**
 * Invoice Type Enum
 * Types of invoices
 */
export const invoiceTypeEnum = pgEnum("invoice_type_enum", [
  "standard",
  "recurring",
  "proforma",
  "credit_memo",
  "debit_memo",
]);

/**
 * Payment Status Enum
 * Status of payments
 */
export const paymentStatusEnum = pgEnum("payment_status_enum", [
  "pending",
  "processing",
  "completed",
  "failed",
  "cancelled",
  "refunded",
  "reversed",
]);

/**
 * Invoice Payment Method Enum
 * Methods of payment for invoices (broader than payroll)
 */
export const invoicePaymentMethodEnum = pgEnum("invoice_payment_method_enum", [
  "cash",
  "check",
  "credit_card",
  "debit_card",
  "ach",
  "wire_transfer",
  "paypal",
  "stripe",
  "other",
]);

/**
 * Payment Type Enum
 * Types of payments
 */
export const paymentTypeEnum = pgEnum("payment_type_enum", [
  "full",
  "partial",
  "deposit",
  "refund",
  "adjustment",
]);

/**
 * Recurring Frequency Enum
 * Frequency for recurring invoices
 */
export const recurringFrequencyEnum = pgEnum("recurring_frequency_enum", [
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
  "semi_annually",
  "annually",
  "custom",
]);

