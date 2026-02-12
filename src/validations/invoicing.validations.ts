import { z } from "zod";

// Helper to validate decimal strings
const decimalString = z
  .string()
  .regex(/^\d+(\.\d{1,4})?$/, "Must be a valid decimal number");

// Helper to validate date strings (YYYY-MM-DD)
const dateString = z.string().refine((val) => !isNaN(Date.parse(val)), {
  message: "Invalid date format. Please use YYYY-MM-DD format",
});

// Helper to validate UUID strings
const uuidString = z.string().uuid("Must be a valid UUID");

// Invoice Status Enum
const invoiceStatusEnum = z.enum([
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

// Invoice Type Enum
const invoiceTypeEnum = z.enum([
  "standard",
  "recurring",
  "proforma",
  "credit_memo",
  "debit_memo",
]);

// Payment Status Enum
const paymentStatusEnum = z.enum([
  "pending",
  "processing",
  "completed",
  "failed",
  "cancelled",
  "refunded",
  "reversed",
]);

// Payment Method Enum
const paymentMethodEnum = z.enum([
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

// Payment Type Enum
const paymentTypeEnum = z.enum([
  "full",
  "partial",
  "deposit",
  "refund",
  "adjustment",
]);

// Item Type Enum
const itemTypeEnum = z.enum([
  "service",
  "material",
  "labor",
  "travel",
  "other",
]);

// Line Item Schema
const lineItemSchema = z.object({
  title: z.string().min(1, "Title is required"),
  istitledisabled: z.boolean().optional().default(false),
  description: z.string().min(1, "Description is required"),
  itemType: itemTypeEnum.optional(),
  quantity: decimalString.optional().default("1"),
  quotedPrice: decimalString,
  billingPercentage: decimalString.optional(),
  billedTotal: decimalString.optional(),
  jobId: uuidString.optional(),
  bidId: uuidString.optional(),
  inventoryItemId: uuidString.optional(),
  notes: z.string().optional(),
  sortOrder: z.number().int().optional().default(0),
});

// ==================== INVOICE VALIDATIONS ====================

// Get Invoices Query Schema
export const getInvoicesQuerySchema = z.object({
  organizationId: uuidString.optional(),
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 10)),
  status: invoiceStatusEnum.optional(),
  invoiceType: invoiceTypeEnum.optional(),
  clientId: uuidString.optional(),
  jobId: uuidString.optional(),
  bidId: uuidString.optional(),
  startDate: dateString.optional(),
  endDate: dateString.optional(),
  dueDateStart: dateString.optional(),
  dueDateEnd: dateString.optional(),
  search: z.string().optional(),
  sortBy: z
    .enum(["invoiceDate", "dueDate", "totalAmount", "createdAt"])
    .optional(),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
  includeDeleted: z
    .union([z.boolean(), z.string()])
    .transform((val) => (typeof val === "string" ? val === "true" : val))
    .pipe(z.boolean())
    .optional()
    .default(false),
});

// Get Invoice by ID Query Schema
export const getInvoiceByIdQuerySchema = z.object({
  includeLineItems: z
    .union([z.boolean(), z.string()])
    .transform((val) => (typeof val === "string" ? val === "true" : val))
    .pipe(z.boolean())
    .optional()
    .default(true),
  includePayments: z
    .union([z.boolean(), z.string()])
    .transform((val) => (typeof val === "string" ? val === "true" : val))
    .pipe(z.boolean())
    .optional()
    .default(true),
  includeDocuments: z
    .union([z.boolean(), z.string()])
    .transform((val) => (typeof val === "string" ? val === "true" : val))
    .pipe(z.boolean())
    .optional()
    .default(true),
  includeHistory: z
    .union([z.boolean(), z.string()])
    .transform((val) => (typeof val === "string" ? val === "true" : val))
    .pipe(z.boolean())
    .optional()
    .default(false),
});

// Create Invoice Schema
export const createInvoiceSchema = z.object({
  body: z
    .object({
      // organizationId and clientId are optional - will be derived from jobId/bidId
      organizationId: uuidString.optional(),
      clientId: uuidString.optional(),
      jobId: uuidString.optional(),
      bidId: uuidString.optional(),
      invoiceType: invoiceTypeEnum.optional().default("standard"),
      invoiceDate: dateString,
      dueDate: dateString,
      paymentTerms: z.string().max(100).optional(),
      paymentTermsDays: z.number().int().positive().optional(),

      // Financial fields - all passed from body (no auto-calculation)
      lineItemSubTotal: decimalString.optional(),
      poSubTotal: decimalString.optional(),
      jobSubtotal: decimalString.optional(),
      taxRate: decimalString.optional(),
      taxAmount: decimalString.optional(),
      discountAmount: decimalString.optional(),
      discountType: z.enum(["percentage", "fixed"]).optional(),
      discountValue: decimalString.optional(),
      totalAmount: decimalString.optional(),
      amountPaid: decimalString.optional(),
      balanceDue: decimalString.optional(),

      // Linked Purchase Orders
      purchaseOrderIds: z.array(uuidString).optional().nullable(),

      // Item Type Flags
      isLabor: z.boolean().optional(),
      isTravel: z.boolean().optional(),
      isOperatingExpense: z.boolean().optional(),
      isMaterial: z.boolean().optional(),

      notes: z.string().optional(),
      termsAndConditions: z.string().optional(),
      internalNotes: z.string().optional(),
      billingAddressLine1: z.string().max(255).optional(),
      billingAddressLine2: z.string().max(255).optional(),
      billingCity: z.string().max(100).optional(),
      billingState: z.string().max(100).optional(),
      billingZipCode: z.string().max(20).optional(),
      billingCountry: z.string().max(100).optional(),
      isRecurring: z.boolean().optional().default(false),
      recurringFrequency: z
        .enum([
          "weekly",
          "biweekly",
          "monthly",
          "quarterly",
          "semi_annually",
          "annually",
          "custom",
        ])
        .optional(),
      recurringStartDate: dateString.optional(),
      recurringEndDate: dateString.optional(),
      lineItems: z
        .array(lineItemSchema)
        .min(1, "At least one line item is required"),
    })
    .refine((data) => data.jobId || data.bidId, {
      message: "Either jobId or bidId must be provided",
      path: ["jobId"],
    }),
});

// Update Invoice Schema
export const updateInvoiceSchema = z.object({
  body: z.object({
    invoiceDate: dateString.optional(),
    dueDate: dateString.optional(),
    status: invoiceStatusEnum.optional(),
    paymentTerms: z.string().max(100).optional(),
    paymentTermsDays: z.number().int().positive().optional(),
    taxRate: decimalString.optional(),
    discountType: z.enum(["percentage", "fixed"]).optional(),
    discountValue: decimalString.optional(),
    notes: z.string().optional(),
    termsAndConditions: z.string().optional(),
    internalNotes: z.string().optional(),
    // Financial (all from body)
    lineItemSubTotal: decimalString.optional(),
    poSubTotal: decimalString.optional(),
    jobSubtotal: decimalString.optional(),
    taxAmount: decimalString.optional(),
    discountAmount: decimalString.optional(),
    totalAmount: decimalString.optional(),
    amountPaid: decimalString.optional(),
    balanceDue: decimalString.optional(),
    // Billing address
    billingAddressLine1: z.string().max(255).optional(),
    billingAddressLine2: z.string().max(255).optional(),
    billingCity: z.string().max(100).optional(),
    billingState: z.string().max(100).optional(),
    billingZipCode: z.string().max(20).optional(),
    billingCountry: z.string().max(100).optional(),
    // Linked Purchase Orders
    purchaseOrderIds: z.array(uuidString).optional().nullable(),
    // Item Type Flags
    isLabor: z.boolean().optional(),
    isTravel: z.boolean().optional(),
    isOperatingExpense: z.boolean().optional(),
    isMaterial: z.boolean().optional(),
  }),
});

// Send Invoice Email Schema
export const sendInvoiceEmailSchema = z.object({
  body: z.object({
    emailTo: z.string().email().optional(),
    subject: z.string().optional(),
    message: z.string().optional(),
    attachPdf: z.boolean().optional().default(true),
    cc: z.array(z.string().email()).optional(),
    bcc: z.array(z.string().email()).optional(),
  }),
});

// Mark Invoice as Paid Schema
export const markInvoicePaidSchema = z.object({
  body: z.object({
    paidDate: dateString.optional(),
    notes: z.string().optional(),
  }),
});

// Void Invoice Schema
export const voidInvoiceSchema = z.object({
  body: z.object({
    reason: z.string().min(1, "Reason is required"),
    notes: z.string().optional(),
  }),
});

// Create Invoice Line Item Schema
export const createInvoiceLineItemSchema = z.object({
  body: lineItemSchema,
});

// Update Invoice Line Item Schema
export const updateInvoiceLineItemSchema = z.object({
  body: lineItemSchema.partial(),
});

// ==================== PAYMENT VALIDATIONS ====================

// Get Payments Query Schema
export const getPaymentsQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 10)),
  status: paymentStatusEnum.optional(),
  paymentMethod: paymentMethodEnum.optional(),
  paymentType: paymentTypeEnum.optional(),
  clientId: uuidString.optional(),
  invoiceId: uuidString.optional(),
  startDate: dateString.optional(),
  endDate: dateString.optional(),
  paymentDateStart: dateString.optional(),
  paymentDateEnd: dateString.optional(),
  search: z.string().optional(),
  sortBy: z
    .enum(["paymentDate", "receivedDate", "amount", "createdAt"])
    .optional(),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
  includeDeleted: z
    .union([z.boolean(), z.string()])
    .transform((val) => (typeof val === "string" ? val === "true" : val))
    .pipe(z.boolean())
    .optional()
    .default(false),
});

// Get Payment by ID Query Schema
export const getPaymentByIdQuerySchema = z.object({
  includeAllocations: z
    .union([z.boolean(), z.string()])
    .transform((val) => (typeof val === "string" ? val === "true" : val))
    .pipe(z.boolean())
    .optional()
    .default(true),
  includeDocuments: z
    .union([z.boolean(), z.string()])
    .transform((val) => (typeof val === "string" ? val === "true" : val))
    .pipe(z.boolean())
    .optional()
    .default(true),
  includeHistory: z
    .union([z.boolean(), z.string()])
    .transform((val) => (typeof val === "string" ? val === "true" : val))
    .pipe(z.boolean())
    .optional()
    .default(false),
});

// Create Payment Schema
export const createPaymentSchema = z.object({
  body: z.object({
    invoiceId: uuidString,
    paymentType: paymentTypeEnum.optional().default("full"),
    paymentMethod: paymentMethodEnum,
    amount: decimalString,
    currency: z.string().length(3).optional().default("USD"),
    exchangeRate: decimalString.optional(),
    paymentDate: dateString,
    receivedDate: z.string().optional(), // ISO timestamp
    checkNumber: z.string().max(50).optional(),
    transactionId: z.string().max(255).optional(),
    referenceNumber: z.string().max(255).optional(),
    bankName: z.string().max(255).optional(),
    accountLastFour: z.string().length(4).optional(),
    processingFee: decimalString.optional().default("0"),
    lateFee: decimalString.optional().default("0"),
    discountApplied: decimalString.optional().default("0"),
    adjustmentAmount: decimalString.optional().default("0"),
    adjustmentReason: z.string().optional(),
    notes: z.string().optional(),
    internalNotes: z.string().optional(),
    allocations: z
      .array(
        z.object({
          invoiceId: uuidString,
          allocatedAmount: decimalString,
          notes: z.string().optional(),
        }),
      )
      .optional(),
  }),
});

// Update Payment Schema
export const updatePaymentSchema = z.object({
  body: z.object({
    status: paymentStatusEnum.optional(),
    paymentDate: dateString.optional(),
    receivedDate: z.string().optional(),
    processedDate: z.string().optional(),
    clearedDate: z.string().optional(),
    checkNumber: z.string().max(50).optional(),
    transactionId: z.string().max(255).optional(),
    referenceNumber: z.string().max(255).optional(),
    processingFee: decimalString.optional(),
    lateFee: decimalString.optional(),
    adjustmentAmount: decimalString.optional(),
    adjustmentReason: z.string().optional(),
    notes: z.string().optional(),
    internalNotes: z.string().optional(),
  }),
});

// Process Payment Schema
export const processPaymentSchema = z.object({
  body: z.object({
    processedDate: z.string().optional(),
    notes: z.string().optional(),
  }),
});

// Mark Payment as Cleared Schema
export const markPaymentClearedSchema = z.object({
  body: z.object({
    clearedDate: z.string().optional(),
    notes: z.string().optional(),
  }),
});

// Create Payment Allocation Schema
export const createPaymentAllocationSchema = z.object({
  body: z.object({
    invoiceId: uuidString,
    allocatedAmount: decimalString,
    notes: z.string().optional(),
  }),
});

// Update Payment Allocation Schema
export const updatePaymentAllocationSchema = z.object({
  body: z.object({
    allocatedAmount: decimalString.optional(),
    notes: z.string().optional(),
  }),
});

// ==================== REPORTS VALIDATIONS ====================

// Invoice Summary Query Schema
export const getInvoiceSummaryQuerySchema = z.object({
  startDate: dateString.optional(),
  endDate: dateString.optional(),
  clientId: uuidString.optional(),
  status: invoiceStatusEnum.optional(),
});

// Payment Summary Query Schema
export const getPaymentSummaryQuerySchema = z.object({
  startDate: dateString.optional(),
  endDate: dateString.optional(),
  clientId: uuidString.optional(),
  paymentMethod: paymentMethodEnum.optional(),
});

// Aging Report Query Schema
export const getAgingReportQuerySchema = z.object({
  clientId: uuidString.optional(),
  asOfDate: dateString.optional(),
});

// Credit Note Validations
export const getCreditNotesQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 10)),
  status: z.enum(["pending", "applied", "expired", "cancelled"]).optional(),
  clientId: uuidString.optional(),
  invoiceId: uuidString.optional(),
  startDate: dateString.optional(),
  endDate: dateString.optional(),
  search: z.string().optional(),
  sortBy: z.enum(["creditNoteDate", "creditAmount", "createdAt"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

export const createCreditNoteSchema = z.object({
  body: z.object({
    clientId: uuidString,
    invoiceId: uuidString.optional(),
    paymentId: uuidString.optional(),
    creditNoteDate: dateString,
    reason: z
      .enum(["refund", "adjustment", "discount", "cancellation", "other"])
      .optional(),
    description: z.string().optional(),
    creditAmount: decimalString,
    expiryDate: dateString.optional(),
  }),
});

export const applyCreditNoteSchema = z.object({
  body: z.object({
    invoiceId: uuidString,
    appliedAmount: decimalString,
    notes: z.string().optional(),
  }),
});

// ==================== ROUTE ALIASES (params/query/body wrappers) ====================

export const getInvoicesSchema = z.object({ query: getInvoicesQuerySchema });
export const getInvoiceByIdSchema = z.object({
  params: z.object({ id: uuidString }),
  query: getInvoiceByIdQuerySchema,
});
export const updateInvoiceByIdSchema = z.object({
  params: z.object({ id: uuidString }),
  body: updateInvoiceSchema.shape.body,
});
export const sendInvoiceByIdSchema = z.object({
  params: z.object({ id: uuidString }),
  body: sendInvoiceEmailSchema.shape.body.optional(),
});
export const sendInvoiceTestByIdSchema = z.object({
  params: z.object({ id: uuidString }),
  body: sendInvoiceEmailSchema.shape.body.optional(),
});
export const markInvoicePaidByIdSchema = z.object({
  params: z.object({ id: uuidString }),
  body: markInvoicePaidSchema.shape.body.optional(),
});
export const voidInvoiceByIdSchema = z.object({
  params: z.object({ id: uuidString }),
  body: voidInvoiceSchema.shape.body.optional(),
});
export const deleteInvoiceByIdSchema = z.object({
  params: z.object({ id: uuidString }),
});
export const createInvoiceLineItemForInvoiceSchema = z.object({
  params: z.object({ invoiceId: uuidString }),
  body: createInvoiceLineItemSchema.shape.body,
});
export const updateInvoiceLineItemByIdSchema = z.object({
  params: z.object({ invoiceId: uuidString, lineItemId: uuidString }),
  body: updateInvoiceLineItemSchema.shape.body,
});
export const getInvoiceKPIsSchema = z.object({ query: getInvoicesQuerySchema });
export const getInvoiceLineItemsSchema = z.object({
  params: z.object({ invoiceId: uuidString }),
});
export const getInvoiceLineItemByIdSchema = z.object({
  params: z.object({ invoiceId: uuidString, lineItemId: uuidString }),
});
export const deleteInvoiceLineItemByIdSchema = z.object({
  params: z.object({ invoiceId: uuidString, lineItemId: uuidString }),
});
export const downloadInvoicePDFSchema = z.object({
  params: z.object({ id: uuidString }),
});
export const previewInvoicePDFSchema = z.object({
  params: z.object({ id: uuidString }),
});

// ==================== INVOICE PAYMENT VALIDATIONS (Simplified) ====================

// Create payment for invoice schema
export const createInvoicePaymentSchema = z.object({
  params: z.object({ invoiceId: uuidString }),
  body: z.object({
    amount: decimalString,
    paymentDate: dateString,
    paymentMethod: paymentMethodEnum,
    referenceNumber: z.string().max(255).optional(),
    notes: z.string().optional(),
  }),
});

// Update invoice payment schema
export const updateInvoicePaymentSchema = z.object({
  params: z.object({ invoiceId: uuidString, paymentId: uuidString }),
  body: z.object({
    amount: decimalString.optional(),
    paymentDate: dateString.optional(),
    paymentMethod: paymentMethodEnum.optional(),
    referenceNumber: z.string().max(255).optional(),
    notes: z.string().optional(),
  }),
});

// Get invoice payments schema
export const getInvoicePaymentsSchema = z.object({
  params: z.object({ invoiceId: uuidString }),
});

// Get invoice payment by ID schema
export const getInvoicePaymentSchema = z.object({
  params: z.object({ invoiceId: uuidString, paymentId: uuidString }),
});

// Delete invoice payment schema
export const deleteInvoicePaymentSchema = z.object({
  params: z.object({ invoiceId: uuidString, paymentId: uuidString }),
});
