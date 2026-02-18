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
import { jobs } from "./jobs.schema.js";

// Import enums from centralized location
import {
  invoiceStatusEnum,
  invoiceTypeEnum,
  invoicePaymentMethodEnum,
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
    jobId: uuid("job_id").references(() => jobs.id, { onDelete: "cascade" }),

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
    lineItemSubTotal: numeric("line_item_sub_total", {
      precision: 15,
      scale: 2,
    })
      .notNull()
      .default("0"),
    poSubTotal: numeric("po_sub_total", { precision: 15, scale: 2 })
      .notNull()
      .default("0"),
    subtotal: numeric("job_subtotal", { precision: 15, scale: 2 })
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

    // Linked Purchase Orders
    purchaseOrderIds: jsonb("purchase_order_ids"), // Array of purchase order UUIDs

    isLabor: boolean("is_labor").default(false),
    isTravel: boolean("is_travel").default(false),
    isOperatingExpense: boolean("is_operating_expense").default(false),
    isMaterial: boolean("is_material").default(false),

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
    parentInvoiceId: uuid("parent_invoice_id").references(() => invoices.id, { onDelete: "cascade" }), // For recurring invoice series

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
    deletedAt: timestamp("deleted_at"),
    deletedBy: uuid("deleted_by").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    // Unique constraint: invoiceNumber must be unique
    unique("unique_invoice_number").on(table.invoiceNumber),
    // Indexes for performance
    index("idx_invoices_job").on(table.jobId),
    index("idx_invoices_status").on(table.status),
    index("idx_invoices_type").on(table.invoiceType),
    index("idx_invoices_invoice_date").on(table.invoiceDate),
    index("idx_invoices_due_date").on(table.dueDate),
    index("idx_invoices_is_deleted").on(table.isDeleted),
    index("idx_invoices_deleted_at").on(table.deletedAt),
    index("idx_invoices_created_at").on(table.createdAt),
    index("idx_invoices_recurring").on(
      table.isRecurring,
      table.parentInvoiceId,
    ),
  ],
);

/**
 * Invoice Line Items Table
 * Individual line items for each invoice
 */
export const invoiceLineItems = org.table(
  "invoice_line_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),

    // Line Item Details
    title: varchar("title", { length: 255 }).notNull(),
    istitledisabled: boolean("is_title_disabled").default(false),
    description: text("description"),
    itemType: varchar("item_type", { length: 50 }), // "service", "material", "labor", "travel", "other"
    quantity: numeric("quantity", { precision: 10, scale: 2 })
      .notNull()
      .default("1"),
    quotedPrice: numeric("quoted_price", { precision: 15, scale: 2 }).notNull(),
    billingPercentage: numeric("billing_percentage", {
      precision: 10,
      scale: 2,
    })
      .notNull()
      .default("100"),
    billedTotal: numeric("billed_total", { precision: 15, scale: 2 }).notNull(),

    // Metadata
    sortOrder: integer("sort_order").default(0),
    notes: text("notes"),

    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [index("idx_invoice_line_items_invoice").on(table.invoiceId)],
);

/**
 * Payments Table
 * Records of payments received against invoices
 * Simplified: amount, date, method, reference, notes
 */
export const payments = org.table(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    paymentNumber: varchar("payment_number", { length: 100 }).notNull(),

    // Relationship
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),

    // Payment Details
    amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
    paymentDate: date("payment_date").notNull(),
    paymentMethod: invoicePaymentMethodEnum("payment_method").notNull(),
    referenceNumber: varchar("reference_number", { length: 255 }), // Check number, transaction ID, etc.
    notes: text("notes"),

    // Metadata
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    // Unique constraint: paymentNumber must be globally unique
    unique("unique_payment_number").on(table.paymentNumber),
    // Indexes for performance
    index("idx_payments_invoice").on(table.invoiceId),
    index("idx_payments_payment_date").on(table.paymentDate),
    index("idx_payments_is_deleted").on(table.isDeleted),
    index("idx_payments_created_at").on(table.createdAt),
  ],
);

/**
 * Invoice Documents Table
 * Documents attached to invoices (PDFs, receipts, etc.)
 */
export const invoiceDocuments = org.table(
  "invoice_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),

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

    isStarred: boolean("is_starred").default(false),
    isDeleted: boolean("is_deleted").default(false),
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_invoice_documents_invoice").on(table.invoiceId),
    index("idx_invoice_documents_type").on(table.documentType),
    index("idx_invoice_documents_uploaded_by").on(table.uploadedBy),
    index("idx_invoice_documents_starred").on(table.isStarred),
    index("idx_invoice_documents_deleted_at").on(table.deletedAt),
  ],
);

/**
 * Payment Documents Table
 * Documents attached to payments (receipts, bank statements, etc.)
 */
export const paymentDocuments = org.table(
  "payment_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id, { onDelete: "cascade" }),

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

    isStarred: boolean("is_starred").default(false),
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_payment_documents_payment").on(table.paymentId),
    index("idx_payment_documents_type").on(table.documentType),
    index("idx_payment_documents_uploaded_by").on(table.uploadedBy),
    index("idx_payment_documents_starred").on(table.isStarred),
  ],
);

/**
 * Invoice History Table
 * Audit trail for invoice changes
 */
export const invoiceHistory = org.table(
  "invoice_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),

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
    index("idx_invoice_history_invoice").on(table.invoiceId),
    index("idx_invoice_history_performed_by").on(table.performedBy),
    index("idx_invoice_history_created_at").on(table.createdAt),
    index("idx_invoice_history_action").on(table.action),
  ],
);

/**
 * Payment History Table
 * Audit trail for payment changes
 */
export const paymentHistory = org.table(
  "payment_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id, { onDelete: "cascade" }),

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
    index("idx_payment_history_payment").on(table.paymentId),
    index("idx_payment_history_performed_by").on(table.performedBy),
    index("idx_payment_history_created_at").on(table.createdAt),
    index("idx_payment_history_action").on(table.action),
  ],
);

/**
 * Invoice Reminders Table
 * Tracks reminder emails sent for overdue invoices
 */
export const invoiceReminders = org.table(
  "invoice_reminders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),

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
    index("idx_invoice_reminders_invoice").on(table.invoiceId),
    index("idx_invoice_reminders_sent_date").on(table.sentDate),
    index("idx_invoice_reminders_type").on(table.reminderType),
  ],
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
    clientId: uuid("client_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "cascade" }), // If credit note is for specific invoice
    paymentId: uuid("payment_id").references(() => payments.id, { onDelete: "cascade" }), // If credit note is for specific payment

    // Credit Note Details
    creditNoteDate: date("credit_note_date").notNull(),
    reason: varchar("reason", { length: 100 }), // "refund", "adjustment", "discount", "cancellation", etc.
    description: text("description"),

    // Financial
    creditAmount: numeric("credit_amount", {
      precision: 15,
      scale: 2,
    }).notNull(),
    appliedAmount: numeric("applied_amount", { precision: 15, scale: 2 })
      .notNull()
      .default("0"), // Amount applied to invoices
    remainingAmount: numeric("remaining_amount", {
      precision: 15,
      scale: 2,
    }).notNull(),

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
    unique("unique_credit_note_number").on(table.creditNoteNumber),
    index("idx_credit_notes_client").on(table.clientId),
    index("idx_credit_notes_invoice").on(table.invoiceId),
    index("idx_credit_notes_payment").on(table.paymentId),
    index("idx_credit_notes_status").on(table.status),
    index("idx_credit_notes_credit_note_date").on(table.creditNoteDate),
  ],
);

/**
 * Credit Note Applications Table
 * Tracks how credit notes are applied to invoices
 */
export const creditNoteApplications = org.table(
  "credit_note_applications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    creditNoteId: uuid("credit_note_id")
      .notNull()
      .references(() => creditNotes.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),

    // Application Details
    appliedAmount: numeric("applied_amount", {
      precision: 15,
      scale: 2,
    }).notNull(),
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
      table.invoiceId,
    ),
    index("idx_credit_note_applications_credit_note").on(table.creditNoteId),
    index("idx_credit_note_applications_invoice").on(table.invoiceId),
  ],
);
