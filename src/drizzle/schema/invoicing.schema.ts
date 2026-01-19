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
} from "drizzle-orm/pg-core";

// Import related tables
import { users } from "./auth.schema.js";
import { organizations } from "./client.schema.js";
import { jobs } from "./jobs.schema.js";
import { bidsTable } from "./bids.schema.js";
import { inventoryItems } from "./inventory.schema.js";

// Import enums from centralized location
import {
  invoiceStatusEnum,
  invoiceTypeEnum,
  paymentStatusEnum,
  invoicePaymentMethodEnum,
  paymentTypeEnum,
  recurringFrequencyEnum,
} from "../enums/invoicing.enums.js";

const org = pgSchema("org");

/**
 * Invoices Table
 * Main table for managing client invoices
 */
export const invoices: any = org.table(
  "invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    invoiceNumber: varchar("invoice_number", { length: 100 }).notNull(),
    
    // Relationships
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    clientId: uuid("client_id")
      .notNull()
      .references(() => organizations.id), // Client organization
    jobId: uuid("job_id").references(() => jobs.id),
    bidId: uuid("bid_id").references(() => bidsTable.id),
    
    // Invoice Details
    invoiceType: invoiceTypeEnum("invoice_type").notNull().default("standard"),
    status: invoiceStatusEnum("status").notNull().default("draft"),
    
    // Dates
    invoiceDate: date("invoice_date").notNull(),
    dueDate: date("due_date").notNull(),
    sentDate: timestamp("sent_date"),
    paidDate: timestamp("paid_date"),
    lastReminderDate: timestamp("last_reminder_date"),
    
    // Financial
    subtotal: numeric("subtotal", { precision: 15, scale: 2 })
      .notNull()
      .default("0"),
    taxRate: numeric("tax_rate", { precision: 5, scale: 4 })
      .notNull()
      .default("0"), // e.g., 0.0825 for 8.25%
    taxAmount: numeric("tax_amount", { precision: 15, scale: 2 })
      .notNull()
      .default("0"),
    discountAmount: numeric("discount_amount", { precision: 15, scale: 2 })
      .notNull()
      .default("0"),
    discountType: varchar("discount_type", { length: 20 }), // "percentage" | "fixed"
    discountValue: numeric("discount_value", { precision: 10, scale: 2 }),
    totalAmount: numeric("total_amount", { precision: 15, scale: 2 })
      .notNull()
      .default("0"),
    amountPaid: numeric("amount_paid", { precision: 15, scale: 2 })
      .notNull()
      .default("0"),
    balanceDue: numeric("balance_due", { precision: 15, scale: 2 })
      .notNull()
      .default("0"),
    
    // Terms & Conditions
    paymentTerms: varchar("payment_terms", { length: 100 }), // "Net 30", "Due on Receipt", etc.
    paymentTermsDays: integer("payment_terms_days"), // Number of days (e.g., 30 for Net 30)
    notes: text("notes"),
    termsAndConditions: text("terms_and_conditions"),
    internalNotes: text("internal_notes"), // Internal-only notes
    
    // Billing Address
    billingAddressLine1: varchar("billing_address_line1", { length: 255 }),
    billingAddressLine2: varchar("billing_address_line2", { length: 255 }),
    billingCity: varchar("billing_city", { length: 100 }),
    billingState: varchar("billing_state", { length: 100 }),
    billingZipCode: varchar("billing_zip_code", { length: 20 }),
    billingCountry: varchar("billing_country", { length: 100 }),
    
    // Recurring Invoice Settings
    isRecurring: boolean("is_recurring").default(false),
    recurringFrequency: recurringFrequencyEnum("recurring_frequency"), // "monthly", "quarterly", "yearly"
    recurringStartDate: date("recurring_start_date"),
    recurringEndDate: date("recurring_end_date"),
    nextInvoiceDate: date("next_invoice_date"),
    parentInvoiceId: uuid("parent_invoice_id").references(() => invoices.id), // For recurring invoice series
    
    // Email & Communication
    emailSent: boolean("email_sent").default(false),
    emailSentTo: varchar("email_sent_to", { length: 255 }), // Email address
    reminderSent: boolean("reminder_sent").default(false),
    reminderCount: integer("reminder_count").default(0),
    
    // Metadata
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    approvedBy: uuid("approved_by").references(() => users.id),
    approvedAt: timestamp("approved_at"),
    
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    // Unique constraint: invoiceNumber unique per organization
    unique("unique_invoice_number_per_org").on(
      table.organizationId,
      table.invoiceNumber
    ),
    // Indexes for performance
    index("idx_invoices_org").on(table.organizationId),
    index("idx_invoices_client").on(table.clientId),
    index("idx_invoices_job").on(table.jobId),
    index("idx_invoices_bid").on(table.bidId),
    index("idx_invoices_status").on(table.status),
    index("idx_invoices_type").on(table.invoiceType),
    index("idx_invoices_invoice_date").on(table.invoiceDate),
    index("idx_invoices_due_date").on(table.dueDate),
    index("idx_invoices_is_deleted").on(table.isDeleted),
    index("idx_invoices_created_at").on(table.createdAt),
    index("idx_invoices_recurring").on(table.isRecurring, table.parentInvoiceId),
  ]
);

/**
 * Invoice Line Items Table
 * Individual line items for each invoice
 */
export const invoiceLineItems = org.table(
  "invoice_line_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id),
    
    // Line Item Details
    description: text("description").notNull(),
    itemType: varchar("item_type", { length: 50 }), // "service", "material", "labor", "travel", "other"
    quantity: numeric("quantity", { precision: 10, scale: 2 })
      .notNull()
      .default("1"),
    unitPrice: numeric("unit_price", { precision: 15, scale: 2 }).notNull(),
    discountAmount: numeric("discount_amount", { precision: 15, scale: 2 })
      .notNull()
      .default("0"),
    taxRate: numeric("tax_rate", { precision: 5, scale: 4 })
      .notNull()
      .default("0"),
    taxAmount: numeric("tax_amount", { precision: 15, scale: 2 })
      .notNull()
      .default("0"),
    lineTotal: numeric("line_total", { precision: 15, scale: 2 }).notNull(),
    
    // References (optional)
    jobId: uuid("job_id").references(() => jobs.id),
    bidId: uuid("bid_id").references(() => bidsTable.id),
    inventoryItemId: uuid("inventory_item_id").references(() => inventoryItems.id), // Reference to inventory if applicable
    
    // Metadata
    sortOrder: integer("sort_order").default(0),
    notes: text("notes"),
    
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_invoice_line_items_org").on(table.organizationId),
    index("idx_invoice_line_items_invoice").on(table.invoiceId),
    index("idx_invoice_line_items_job").on(table.jobId),
    index("idx_invoice_line_items_bid").on(table.bidId),
    index("idx_invoice_line_items_inventory").on(table.inventoryItemId),
  ]
);

/**
 * Payments Table
 * Records of payments received against invoices
 */
export const payments = org.table(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    paymentNumber: varchar("payment_number", { length: 100 }).notNull(),
    
    // Relationships
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    clientId: uuid("client_id")
      .notNull()
      .references(() => organizations.id), // Client organization
    invoiceId: uuid("invoice_id")
      .references(() => invoices.id), // Optional for deposits/prepayments
    
    // Payment Details
    paymentType: paymentTypeEnum("payment_type").notNull().default("full"),
    paymentMethod: invoicePaymentMethodEnum("payment_method").notNull(),
    status: paymentStatusEnum("status").notNull().default("pending"),
    
    // Financial
    amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).default("USD"),
    exchangeRate: numeric("exchange_rate", { precision: 10, scale: 6 })
      .notNull()
      .default("1"),
    
    // Payment Processing
    paymentDate: date("payment_date").notNull(),
    receivedDate: timestamp("received_date"),
    processedDate: timestamp("processed_date"),
    clearedDate: timestamp("cleared_date"), // For checks/ACH
    
    // Payment Method Specific
    checkNumber: varchar("check_number", { length: 50 }),
    transactionId: varchar("transaction_id", { length: 255 }), // For credit card, ACH, wire
    referenceNumber: varchar("reference_number", { length: 255 }),
    bankName: varchar("bank_name", { length: 255 }),
    accountLastFour: varchar("account_last_four", { length: 4 }),
    
    // Fees & Adjustments
    processingFee: numeric("processing_fee", { precision: 15, scale: 2 })
      .notNull()
      .default("0"),
    lateFee: numeric("late_fee", { precision: 15, scale: 2 })
      .notNull()
      .default("0"),
    discountApplied: numeric("discount_applied", { precision: 15, scale: 2 })
      .notNull()
      .default("0"),
    adjustmentAmount: numeric("adjustment_amount", { precision: 15, scale: 2 })
      .notNull()
      .default("0"),
    adjustmentReason: text("adjustment_reason"),
    
    // Notes
    notes: text("notes"),
    internalNotes: text("internal_notes"),
    
    // Metadata
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    processedBy: uuid("processed_by").references(() => users.id),
    
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    // Unique constraint: paymentNumber unique per organization
    unique("unique_payment_number_per_org").on(
      table.organizationId,
      table.paymentNumber
    ),
    // Indexes for performance
    index("idx_payments_org").on(table.organizationId),
    index("idx_payments_client").on(table.clientId),
    index("idx_payments_invoice").on(table.invoiceId),
    index("idx_payments_status").on(table.status),
    index("idx_payments_method").on(table.paymentMethod),
    index("idx_payments_payment_date").on(table.paymentDate),
    index("idx_payments_received_date").on(table.receivedDate),
    index("idx_payments_is_deleted").on(table.isDeleted),
    index("idx_payments_created_at").on(table.createdAt),
  ]
);

/**
 * Payment Allocations Table
 * Tracks how payments are allocated across multiple invoices
 * (for partial payments or payments covering multiple invoices)
 */
export const paymentAllocations = org.table(
  "payment_allocations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id),
    
    // Allocation Details
    allocatedAmount: numeric("allocated_amount", { precision: 15, scale: 2 })
      .notNull(),
    allocationDate: timestamp("allocation_date").defaultNow(),
    
    // Notes
    notes: text("notes"),
    
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    // Unique constraint: one allocation per payment-invoice pair
    unique("unique_payment_invoice_allocation").on(
      table.paymentId,
      table.invoiceId
    ),
    index("idx_payment_allocations_org").on(table.organizationId),
    index("idx_payment_allocations_payment").on(table.paymentId),
    index("idx_payment_allocations_invoice").on(table.invoiceId),
  ]
);

/**
 * Invoice Documents Table
 * Documents attached to invoices (PDFs, receipts, etc.)
 */
export const invoiceDocuments = org.table(
  "invoice_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id),
    
    // Document Details
    fileName: varchar("file_name", { length: 255 }).notNull(),
    filePath: varchar("file_path", { length: 500 }).notNull(),
    fileType: varchar("file_type", { length: 50 }),
    fileSize: integer("file_size"),
    documentType: varchar("document_type", { length: 50 }), // "invoice_pdf", "receipt", "proof_of_delivery", etc.
    mimeType: varchar("mime_type", { length: 100 }),
    
    // Metadata
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => users.id),
    description: text("description"),
    
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_invoice_documents_org").on(table.organizationId),
    index("idx_invoice_documents_invoice").on(table.invoiceId),
    index("idx_invoice_documents_type").on(table.documentType),
    index("idx_invoice_documents_uploaded_by").on(table.uploadedBy),
  ]
);

/**
 * Payment Documents Table
 * Documents attached to payments (receipts, bank statements, etc.)
 */
export const paymentDocuments = org.table(
  "payment_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id),
    
    // Document Details
    fileName: varchar("file_name", { length: 255 }).notNull(),
    filePath: varchar("file_path", { length: 500 }).notNull(),
    fileType: varchar("file_type", { length: 50 }),
    fileSize: integer("file_size"),
    documentType: varchar("document_type", { length: 50 }), // "receipt", "bank_statement", "check_image", etc.
    mimeType: varchar("mime_type", { length: 100 }),
    
    // Metadata
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => users.id),
    description: text("description"),
    
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_payment_documents_org").on(table.organizationId),
    index("idx_payment_documents_payment").on(table.paymentId),
    index("idx_payment_documents_type").on(table.documentType),
    index("idx_payment_documents_uploaded_by").on(table.uploadedBy),
  ]
);

/**
 * Invoice History Table
 * Audit trail for invoice changes
 */
export const invoiceHistory = org.table(
  "invoice_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id),
    
    // History Details
    action: varchar("action", { length: 100 }).notNull(), // "created", "status_changed", "amount_updated", "sent", "paid", etc.
    oldValue: text("old_value"),
    newValue: text("new_value"),
    description: text("description"),
    
    // Metadata
    performedBy: uuid("performed_by")
      .notNull()
      .references(() => users.id),
    
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_invoice_history_org").on(table.organizationId),
    index("idx_invoice_history_invoice").on(table.invoiceId),
    index("idx_invoice_history_performed_by").on(table.performedBy),
    index("idx_invoice_history_created_at").on(table.createdAt),
    index("idx_invoice_history_action").on(table.action),
  ]
);

/**
 * Payment History Table
 * Audit trail for payment changes
 */
export const paymentHistory = org.table(
  "payment_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id),
    
    // History Details
    action: varchar("action", { length: 100 }).notNull(), // "created", "status_changed", "processed", "cleared", etc.
    oldValue: text("old_value"),
    newValue: text("new_value"),
    description: text("description"),
    
    // Metadata
    performedBy: uuid("performed_by")
      .notNull()
      .references(() => users.id),
    
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_payment_history_org").on(table.organizationId),
    index("idx_payment_history_payment").on(table.paymentId),
    index("idx_payment_history_performed_by").on(table.performedBy),
    index("idx_payment_history_created_at").on(table.createdAt),
    index("idx_payment_history_action").on(table.action),
  ]
);

/**
 * Invoice Reminders Table
 * Tracks reminder emails sent for overdue invoices
 */
export const invoiceReminders = org.table(
  "invoice_reminders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id),
    
    // Reminder Details
    reminderType: varchar("reminder_type", { length: 50 }), // "overdue", "due_soon", "custom"
    daysOverdue: integer("days_overdue"), // Number of days past due date
    sentDate: timestamp("sent_date").notNull(),
    sentTo: varchar("sent_to", { length: 255 }), // Email address
    subject: varchar("subject", { length: 255 }),
    message: text("message"),
    
    // Status
    emailOpened: boolean("email_opened").default(false),
    emailOpenedAt: timestamp("email_opened_at"),
    linkClicked: boolean("link_clicked").default(false),
    linkClickedAt: timestamp("link_clicked_at"),
    
    // Metadata
    sentBy: uuid("sent_by").references(() => users.id),
    
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_invoice_reminders_org").on(table.organizationId),
    index("idx_invoice_reminders_invoice").on(table.invoiceId),
    index("idx_invoice_reminders_sent_date").on(table.sentDate),
    index("idx_invoice_reminders_type").on(table.reminderType),
  ]
);

/**
 * Credit Notes Table
 * Credit notes/refunds issued to clients
 */
export const creditNotes = org.table(
  "credit_notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    creditNoteNumber: varchar("credit_note_number", { length: 100 }).notNull(),
    
    // Relationships
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    clientId: uuid("client_id")
      .notNull()
      .references(() => organizations.id),
    invoiceId: uuid("invoice_id").references(() => invoices.id), // If credit note is for specific invoice
    paymentId: uuid("payment_id").references(() => payments.id), // If credit note is for specific payment
    
    // Credit Note Details
    creditNoteDate: date("credit_note_date").notNull(),
    reason: varchar("reason", { length: 100 }), // "refund", "adjustment", "discount", "cancellation", etc.
    description: text("description"),
    
    // Financial
    creditAmount: numeric("credit_amount", { precision: 15, scale: 2 })
      .notNull(),
    appliedAmount: numeric("applied_amount", { precision: 15, scale: 2 })
      .notNull()
      .default("0"), // Amount applied to invoices
    remainingAmount: numeric("remaining_amount", { precision: 15, scale: 2 })
      .notNull(),
    
    // Status
    status: varchar("status", { length: 50 }).notNull().default("pending"), // "pending", "applied", "expired", "cancelled"
    
    // Dates
    expiryDate: date("expiry_date"),
    appliedDate: timestamp("applied_date"),
    
    // Metadata
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    // Unique constraint: creditNoteNumber unique per organization
    unique("unique_credit_note_number_per_org").on(
      table.organizationId,
      table.creditNoteNumber
    ),
    index("idx_credit_notes_org").on(table.organizationId),
    index("idx_credit_notes_client").on(table.clientId),
    index("idx_credit_notes_invoice").on(table.invoiceId),
    index("idx_credit_notes_payment").on(table.paymentId),
    index("idx_credit_notes_status").on(table.status),
    index("idx_credit_notes_credit_note_date").on(table.creditNoteDate),
  ]
);

/**
 * Credit Note Applications Table
 * Tracks how credit notes are applied to invoices
 */
export const creditNoteApplications = org.table(
  "credit_note_applications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    creditNoteId: uuid("credit_note_id")
      .notNull()
      .references(() => creditNotes.id),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id),
    
    // Application Details
    appliedAmount: numeric("applied_amount", { precision: 15, scale: 2 })
      .notNull(),
    applicationDate: timestamp("application_date").defaultNow(),
    
    // Notes
    notes: text("notes"),
    
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    // Unique constraint: one application per credit note-invoice pair
    unique("unique_credit_note_invoice_application").on(
      table.creditNoteId,
      table.invoiceId
    ),
    index("idx_credit_note_applications_org").on(table.organizationId),
    index("idx_credit_note_applications_credit_note").on(table.creditNoteId),
    index("idx_credit_note_applications_invoice").on(table.invoiceId),
  ]
);

