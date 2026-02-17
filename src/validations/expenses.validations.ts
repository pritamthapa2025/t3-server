import { z } from "zod";

const uuidSchema = z
  .string()
  .uuid({ message: "Invalid ID format - must be a valid UUID" });
const numericStringSchema = z.string().regex(/^\d+(\.\d+)?$/, {
  message: "Must be a valid number (e.g., 100 or 99.99)",
});
const percentageSchema = z.string().regex(/^(100(\.0+)?|[1-9]?\d(\.\d+)?)$/, {
  message: "Must be a valid percentage between 0 and 100",
});
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
  message: "Date must be in YYYY-MM-DD format",
});

// ============================
// Expense Enums
// ============================

const expenseStatusEnum = z.enum(
  [
    "draft",
    "submitted",
    "approved",
    "rejected",
    "paid",
    "reimbursed",
    "cancelled",
  ],
  {
    message:
      "Status must be one of: draft, submitted, approved, rejected, paid, reimbursed, or cancelled",
  },
);

const expenseTypeEnum = z.enum(
  [
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
  ],
  {
    message: "Invalid expense type",
  },
);

const paymentMethodEnum = z.enum(
  [
    "cash",
    "personal_card",
    "company_card",
    "check",
    "bank_transfer",
    "petty_cash",
    "other",
  ],
  {
    message: "Invalid payment method",
  },
);

const expenseReportStatusEnum = z.enum(
  [
    "draft",
    "submitted",
    "under_review",
    "approved",
    "rejected",
    "paid",
    "closed",
  ],
  {
    message: "Invalid report status",
  },
);

const reimbursementStatusEnum = z.enum(
  ["pending", "approved", "processing", "paid", "rejected", "cancelled"],
  {
    message: "Invalid reimbursement status",
  },
);

const mileageTypeEnum = z.enum(["business", "commute", "personal"], {
  message: "Mileage type must be one of: business, commute, or personal",
});

const taxStatusEnum = z.enum(
  ["deductible", "non_deductible", "partial", "unknown"],
  {
    message:
      "Tax status must be one of: deductible, non_deductible, partial, or unknown",
  },
);

const budgetPeriodEnum = z.enum(
  ["monthly", "quarterly", "yearly", "project", "custom"],
  {
    message:
      "Budget period must be one of: monthly, quarterly, yearly, project, or custom",
  },
);

export const expenseCategoryEnum = z.enum(
  [
    "materials",
    "equipment",
    "transportation",
    "permits",
    "subcontractor",
    "utilities",
    "tools",
    "safety",
    "fleet",
    "maintenance",
    "fuel",
    "tires",
    "registration",
    "repairs",
    "insurance",
    "office_supplies",
    "rent",
    "internet",
    "other",
  ],
  { message: "Invalid expense category" },
);

// ============================
// Expense Categories Validations (enum list for dropdown)
// ============================

export const getExpenseCategoriesQuerySchema = z.object({
  query: z.object({
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 1))
      .pipe(z.number().int().positive("Page number must be a positive number")),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 10))
      .pipe(
        z
          .number()
          .int()
          .positive("Limit must be a positive number")
          .max(100, "Maximum 100 items per page"),
      ),
    search: z.string().optional(),
  }),
});

// ============================
// Expenses Validations
// ============================

export const getExpensesQuerySchema = z.object({
  query: z.object({
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 1))
      .pipe(z.number().int().positive()),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 10))
      .pipe(z.number().int().positive().max(100)),
    status: expenseStatusEnum.optional(),
    expenseType: expenseTypeEnum.optional(),
    paymentMethod: paymentMethodEnum.optional(),
    employeeId: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : undefined))
      .pipe(z.number().int().positive().optional()),
    category: expenseCategoryEnum.optional(),
    jobId: uuidSchema.optional(),
    sourceId: uuidSchema.optional(),
    bidId: uuidSchema.optional(),
    startDate: dateString.optional(),
    endDate: dateString.optional(),
    submittedStartDate: dateString.optional(),
    submittedEndDate: dateString.optional(),
    approvedBy: uuidSchema.optional(),
    reimbursementStatus: reimbursementStatusEnum.optional(),
    hasReceipt: z
      .string()
      .optional()
      .transform((val) => val === "true")
      .refine((val) => val === undefined || typeof val === "boolean", {
        message: "Must be a boolean value",
      }),
    isReimbursable: z
      .string()
      .optional()
      .transform((val) => val === "true")
      .refine((val) => val === undefined || typeof val === "boolean", {
        message: "Must be a boolean value",
      }),
    search: z.string().optional(),
    sortBy: z
      .enum(["expenseDate", "submittedDate", "amount", "status", "createdAt"])
      .optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
    includeDeleted: z
      .string()
      .optional()
      .transform((val) => val === "true")
      .refine((val) => val === undefined || typeof val === "boolean", {
        message: "Must be a boolean value",
      }),
  }),
});

export const getExpenseByIdSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  query: z
    .object({
      includeReceipts: z
        .string()
        .optional()
        .transform((val) => val !== "false")
        .refine((val) => val === undefined || typeof val === "boolean", {
          message: "Must be a boolean value",
        }),
      includeAllocations: z
        .string()
        .optional()
        .transform((val) => val !== "false")
        .refine((val) => val === undefined || typeof val === "boolean", {
          message: "Must be a boolean value",
        }),
      includeApprovals: z
        .string()
        .optional()
        .transform((val) => val !== "false")
        .refine((val) => val === undefined || typeof val === "boolean", {
          message: "Must be a boolean value",
        }),
      includeHistory: z
        .string()
        .optional()
        .transform((val) => val === "true")
        .refine((val) => val === undefined || typeof val === "boolean", {
          message: "Must be a boolean value",
        }),
    })
    .optional(),
});

const expenseAllocationSchema = z.object({
  allocationType: z.enum(["job", "bid", "department", "general"], {
    message: "Allocation type must be one of: job, bid, department, or general",
  }),
  jobId: uuidSchema.optional(),
  bidId: uuidSchema.optional(),
  departmentId: z.number().int().positive().optional(),
  percentage: percentageSchema.optional(),
  costCenter: z.string().max(50).optional(),
  accountCode: z.string().max(50).optional(),
  notes: z.string().optional(),
});

export const createExpenseSchema = z.object({
  body: z.object({
    category: expenseCategoryEnum,
    jobId: uuidSchema.optional(),
    bidId: uuidSchema.optional(),
    expenseType: expenseTypeEnum,
    paymentMethod: paymentMethodEnum,
    title: z
      .string()
      .min(1, "Expense title is required")
      .max(255, "Expense title is too long (maximum 255 characters)")
      .trim(),
    description: z.string().optional(),
    vendor: z.string().max(255).optional(),
    location: z.string().max(255).optional(),
    amount: numericStringSchema,
    currency: z.string().length(3).optional(),
    exchangeRate: numericStringSchema.optional(),
    taxStatus: taxStatusEnum.optional(),
    taxAmount: numericStringSchema.optional(),
    taxRate: numericStringSchema.optional(),
    expenseDate: dateString,
    receiptNumber: z.string().max(100).optional(),
    receiptTotal: numericStringSchema.optional(),
    // Mileage specific fields
    isMileageExpense: z.boolean().optional(),
    mileageType: mileageTypeEnum.optional(),
    miles: numericStringSchema.optional(),
    mileageRate: numericStringSchema.optional(),
    startLocation: z.string().max(255).optional(),
    endLocation: z.string().max(255).optional(),
    // Additional fields
    isReimbursable: z.boolean().optional(),
    businessPurpose: z.string().optional(),
    attendees: z.string().optional(),
    notes: z.string().optional(),
    // Allocations
    allocations: z.array(expenseAllocationSchema).optional(),
  }),
});

export const updateExpenseSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    status: expenseStatusEnum.optional(),
    category: expenseCategoryEnum.optional(),
    jobId: uuidSchema.optional(),
    bidId: uuidSchema.optional(),
    expenseType: expenseTypeEnum.optional(),
    paymentMethod: paymentMethodEnum.optional(),
    title: z
      .string()
      .min(1, "Expense title is required")
      .max(255, "Expense title is too long (maximum 255 characters)")
      .trim()
      .optional(),
    description: z.string().optional(),
    vendor: z.string().max(255).optional(),
    location: z.string().max(255).optional(),
    amount: numericStringSchema.optional(),
    currency: z.string().length(3).optional(),
    exchangeRate: numericStringSchema.optional(),
    taxStatus: taxStatusEnum.optional(),
    taxAmount: numericStringSchema.optional(),
    taxRate: numericStringSchema.optional(),
    expenseDate: dateString.optional(),
    receiptNumber: z.string().max(100).optional(),
    receiptTotal: numericStringSchema.optional(),
    // Mileage specific fields
    isMileageExpense: z.boolean().optional(),
    mileageType: mileageTypeEnum.optional(),
    miles: numericStringSchema.optional(),
    mileageRate: numericStringSchema.optional(),
    startLocation: z.string().max(255).optional(),
    endLocation: z.string().max(255).optional(),
    // Additional fields
    isReimbursable: z.boolean().optional(),
    businessPurpose: z.string().optional(),
    attendees: z.string().optional(),
    notes: z.string().optional(),
  }),
});

export const deleteExpenseSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

export const submitExpenseSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    notes: z.string().optional(),
  }),
});

export const approveExpenseSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    comments: z.string().optional(),
  }),
});

export const rejectExpenseSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    comments: z.string().optional(),
    rejectionReason: z.string().min(1, "Rejection reason is required"),
  }),
});

// ============================
// Expense Reports Validations
// ============================

export const getExpenseReportsQuerySchema = z.object({
  query: z.object({
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 1))
      .pipe(z.number().int().positive()),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 10))
      .pipe(z.number().int().positive().max(100)),
    status: expenseReportStatusEnum.optional(),
    employeeId: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : undefined))
      .pipe(z.number().int().positive().optional()),
    startDate: dateString.optional(),
    endDate: dateString.optional(),
    submittedStartDate: dateString.optional(),
    submittedEndDate: dateString.optional(),
    approvedBy: uuidSchema.optional(),
    search: z.string().optional(),
    sortBy: z
      .enum([
        "reportPeriodStart",
        "reportPeriodEnd",
        "submittedDate",
        "totalAmount",
        "createdAt",
      ])
      .optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
    includeDeleted: z
      .string()
      .optional()
      .transform((val) => val === "true")
      .refine((val) => val === undefined || typeof val === "boolean", {
        message: "Must be a boolean value",
      }),
  }),
});

export const createExpenseReportSchema = z.object({
  body: z
    .object({
      title: z
        .string()
        .min(1, "Report title is required")
        .max(255, "Report title is too long (maximum 255 characters)")
        .trim(),
      description: z.string().optional(),
      reportPeriodStart: dateString,
      reportPeriodEnd: dateString,
      expenseIds: z
        .array(uuidSchema)
        .min(1, "At least one expense must be included"),
      notes: z.string().optional(),
    })
    .refine(
      (data) => {
        return (
          new Date(data.reportPeriodEnd) >= new Date(data.reportPeriodStart)
        );
      },
      {
        message: "Report period end date must be after or equal to start date",
        path: ["reportPeriodEnd"],
      },
    ),
});

export const getExpenseReportByIdSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

export const updateExpenseReportSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    title: z
      .string()
      .min(1, "Report title is required")
      .max(255, "Report title is too long (maximum 255 characters)")
      .trim()
      .optional(),
    description: z.string().optional(),
    reportPeriodStart: dateString.optional(),
    reportPeriodEnd: dateString.optional(),
    expenseIds: z
      .array(uuidSchema)
      .min(1, "At least one expense must be included")
      .optional(),
    notes: z.string().optional(),
    status: expenseReportStatusEnum.optional(),
  }),
});

export const submitExpenseReportSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    notes: z.string().optional(),
  }),
});

export const deleteExpenseReportSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

// ============================
// Expense Receipts Validations
// ============================

export const getExpenseReceiptsSchema = z.object({
  params: z.object({
    expenseId: uuidSchema,
  }),
});

export const getExpenseReceiptByIdSchema = z.object({
  params: z.object({
    expenseId: uuidSchema,
    receiptId: uuidSchema,
  }),
});

export const uploadExpenseReceiptSchema = z.object({
  params: z.object({
    expenseId: uuidSchema,
  }),
  body: z.object({
    receiptDate: dateString.optional(),
    receiptNumber: z.string().max(100).optional(),
    receiptTotal: numericStringSchema.optional(),
    vendor: z.string().max(255).optional(),
    description: z.string().optional(),
  }),
});

export const createExpenseReceiptSchema = z.object({
  params: z.object({
    expenseId: uuidSchema,
  }),
  body: z
    .object({
      description: z.string().max(500).optional(),
      receiptDate: dateString.optional(),
      receiptNumber: z.string().max(100).optional(),
      receiptTotal: numericStringSchema.optional(),
      vendor: z.string().max(255).optional(),
    })
    .optional(),
});

export const updateExpenseReceiptSchema = z.object({
  params: z.object({
    expenseId: uuidSchema,
    receiptId: uuidSchema,
  }),
  body: z
    .object({
      description: z.string().max(500).optional(),
      receiptDate: dateString.optional(),
      receiptNumber: z.string().max(100).optional(),
      receiptTotal: numericStringSchema.optional(),
      vendor: z.string().max(255).optional(),
    })
    .optional(),
});

export const deleteExpenseReceiptSchema = z.object({
  params: z.object({
    expenseId: uuidSchema,
    receiptId: uuidSchema,
  }),
});

// ============================
// Mileage Logs Validations
// ============================

export const getMileageLogsQuerySchema = z.object({
  query: z.object({
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 1))
      .pipe(z.number().int().positive()),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 10))
      .pipe(z.number().int().positive().max(100)),
    employeeId: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : undefined))
      .pipe(z.number().int().positive().optional()),
    expenseId: uuidSchema.optional(),
    jobId: uuidSchema.optional(),
    bidId: uuidSchema.optional(),
    mileageType: mileageTypeEnum.optional(),
    startDate: dateString.optional(),
    endDate: dateString.optional(),
    isVerified: z
      .string()
      .optional()
      .transform((val) => val === "true")
      .refine((val) => val === undefined || typeof val === "boolean", {
        message: "Must be a boolean value",
      }),
    search: z.string().optional(),
    sortBy: z.enum(["date", "miles", "amount", "createdAt"]).optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
    includeDeleted: z
      .string()
      .optional()
      .transform((val) => val === "true")
      .refine((val) => val === undefined || typeof val === "boolean", {
        message: "Must be a boolean value",
      }),
  }),
});

export const createMileageLogSchema = z.object({
  body: z
    .object({
      expenseId: uuidSchema.optional(),
      date: dateString,
      startLocation: z
        .string()
        .min(1, "Start location is required")
        .max(255, "Start location is too long (maximum 255 characters)"),
      endLocation: z
        .string()
        .min(1, "End location is required")
        .max(255, "End location is too long (maximum 255 characters)"),
      purpose: z.string().min(1, "Business purpose is required"),
      mileageType: mileageTypeEnum,
      miles: numericStringSchema,
      rate: numericStringSchema,
      vehicleId: uuidSchema.optional(),
      vehicleLicense: z.string().max(20).optional(),
      odometerStart: z.number().int().positive().optional(),
      odometerEnd: z.number().int().positive().optional(),
      jobId: uuidSchema.optional(),
      bidId: uuidSchema.optional(),
      gpsStartCoordinates: z.string().max(50).optional(),
      gpsEndCoordinates: z.string().max(50).optional(),
      routeData: z.any().optional(),
      notes: z.string().optional(),
    })
    .refine(
      (data) => {
        if (data.odometerStart && data.odometerEnd) {
          return data.odometerEnd > data.odometerStart;
        }
        return true;
      },
      {
        message: "End odometer reading must be greater than start reading",
        path: ["odometerEnd"],
      },
    ),
});

export const getMileageLogByIdSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

export const updateMileageLogSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    expenseId: uuidSchema.optional(),
    date: dateString.optional(),
    startLocation: z
      .string()
      .min(1, "Start location is required")
      .max(255, "Start location is too long (maximum 255 characters)")
      .optional(),
    endLocation: z
      .string()
      .min(1, "End location is required")
      .max(255, "End location is too long (maximum 255 characters)")
      .optional(),
    purpose: z.string().min(1, "Business purpose is required").optional(),
    mileageType: mileageTypeEnum.optional(),
    miles: numericStringSchema.optional(),
    rate: numericStringSchema.optional(),
    vehicleId: uuidSchema.optional(),
    vehicleLicense: z.string().max(20).optional(),
    odometerStart: z.number().int().positive().optional(),
    odometerEnd: z.number().int().positive().optional(),
    jobId: uuidSchema.optional(),
    bidId: uuidSchema.optional(),
    gpsStartCoordinates: z.string().max(50).optional(),
    gpsEndCoordinates: z.string().max(50).optional(),
    routeData: z.any().optional(),
    notes: z.string().optional(),
  }),
});

export const deleteMileageLogSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

// ============================
// Expense Reimbursements Validations
// ============================

export const getExpenseReimbursementsQuerySchema = z.object({
  query: z.object({
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 1))
      .pipe(z.number().int().positive()),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 10))
      .pipe(z.number().int().positive().max(100)),
    status: reimbursementStatusEnum.optional(),
    employeeId: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : undefined))
      .pipe(z.number().int().positive().optional()),
    reportId: uuidSchema.optional(),
    paymentMethod: z.string().optional(),
    startDate: dateString.optional(),
    endDate: dateString.optional(),
    paymentDateStart: dateString.optional(),
    paymentDateEnd: dateString.optional(),
    search: z.string().optional(),
    sortBy: z
      .enum([
        "requestedDate",
        "approvedDate",
        "paymentDate",
        "totalAmount",
        "createdAt",
      ])
      .optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
    includeDeleted: z
      .string()
      .optional()
      .transform((val) => val === "true")
      .refine((val) => val === undefined || typeof val === "boolean", {
        message: "Must be a boolean value",
      }),
  }),
});

export const createExpenseReimbursementSchema = z.object({
  body: z.object({
    employeeId: z.number().int().positive(),
    reportId: uuidSchema.optional(),
    expenseIds: z
      .array(uuidSchema)
      .min(1, "At least one expense must be included"),
    paymentMethod: z.string().optional(),
    bankAccountId: uuidSchema.optional(),
    notes: z.string().optional(),
  }),
});

export const processReimbursementSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    paymentMethod: z.string().min(1, "Payment method is required"),
    paymentReference: z.string().optional(),
    paymentDate: dateString.optional(),
    checkNumber: z.string().optional(),
    notes: z.string().optional(),
  }),
});

export const getExpenseReimbursementByIdSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

// ============================
// Expense Budgets Validations
// ============================

export const getExpenseBudgetsQuerySchema = z.object({
  query: z.object({
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 1))
      .pipe(z.number().int().positive()),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 10))
      .pipe(z.number().int().positive().max(100)),
    budgetType: z
      .enum(["category", "department", "employee", "project"])
      .optional(),
    budgetPeriod: budgetPeriodEnum.optional(),
    category: expenseCategoryEnum.optional(),
    departmentId: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : undefined))
      .pipe(z.number().int().positive().optional()),
    employeeId: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : undefined))
      .pipe(z.number().int().positive().optional()),
    jobId: uuidSchema.optional(),
    periodStart: dateString.optional(),
    periodEnd: dateString.optional(),
    isActive: z
      .string()
      .optional()
      .transform((val) => val === "true")
      .refine((val) => val === undefined || typeof val === "boolean", {
        message: "Must be a boolean value",
      }),
    overBudget: z
      .string()
      .optional()
      .transform((val) => val === "true")
      .refine((val) => val === undefined || typeof val === "boolean", {
        message: "Must be a boolean value",
      }),
    nearLimit: z
      .string()
      .optional()
      .transform((val) => val === "true")
      .refine((val) => val === undefined || typeof val === "boolean", {
        message: "Must be a boolean value",
      }),
    search: z.string().optional(),
    sortBy: z
      .enum([
        "name",
        "budgetAmount",
        "spentAmount",
        "remainingAmount",
        "periodStart",
        "createdAt",
      ])
      .optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
    includeDeleted: z
      .string()
      .optional()
      .transform((val) => val === "true")
      .refine((val) => val === undefined || typeof val === "boolean", {
        message: "Must be a boolean value",
      }),
  }),
});

export const createExpenseBudgetSchema = z.object({
  body: z
    .object({
      name: z
        .string()
        .min(1, "Budget name is required")
        .max(255, "Budget name is too long (maximum 255 characters)")
        .trim(),
      description: z.string().optional(),
      budgetType: z.enum(["category", "department", "employee", "project"]),
      category: expenseCategoryEnum.optional(),
      departmentId: z.number().int().positive().optional(),
      employeeId: z.number().int().positive().optional(),
      jobId: uuidSchema.optional(),
      budgetPeriod: budgetPeriodEnum,
      periodStart: dateString,
      periodEnd: dateString,
      budgetAmount: numericStringSchema,
      warningThreshold: percentageSchema.optional(),
      alertThreshold: percentageSchema.optional(),
      isActive: z.boolean().optional(),
    })
    .refine(
      (data) => {
        return new Date(data.periodEnd) >= new Date(data.periodStart);
      },
      {
        message: "Budget period end date must be after or equal to start date",
        path: ["periodEnd"],
      },
    ),
});

export const getExpenseBudgetByIdSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

export const updateExpenseBudgetSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    name: z
      .string()
      .min(1, "Budget name is required")
      .max(255, "Budget name is too long (maximum 255 characters)")
      .trim()
      .optional(),
    description: z.string().optional(),
    budgetType: z
      .enum(["category", "department", "employee", "project"])
      .optional(),
    category: expenseCategoryEnum.optional(),
    departmentId: z.number().int().positive().optional(),
    employeeId: z.number().int().positive().optional(),
    jobId: uuidSchema.optional(),
    budgetPeriod: budgetPeriodEnum.optional(),
    periodStart: dateString.optional(),
    periodEnd: dateString.optional(),
    budgetAmount: numericStringSchema.optional(),
    warningThreshold: percentageSchema.optional(),
    alertThreshold: percentageSchema.optional(),
    isActive: z.boolean().optional(),
  }),
});

export const deleteExpenseBudgetSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

// ============================
// Analytics & Reports Validations
// ============================

export const getExpenseSummarySchema = z.object({
  query: z.object({
    startDate: dateString.optional(),
    endDate: dateString.optional(),
    employeeId: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : undefined))
      .pipe(z.number().int().positive().optional()),
    category: expenseCategoryEnum.optional(),
    jobId: uuidSchema.optional(),
    departmentId: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : undefined))
      .pipe(z.number().int().positive().optional()),
    status: expenseStatusEnum.optional(),
  }),
});

export const getExpenseBudgetSummarySchema = z.object({
  query: z.object({
    budgetType: z
      .enum(["category", "department", "employee", "project"])
      .optional(),
    periodStart: dateString.optional(),
    periodEnd: dateString.optional(),
    includeInactive: z
      .string()
      .optional()
      .transform((val) => val === "true")
      .refine((val) => val === undefined || typeof val === "boolean", {
        message: "Must be a boolean value",
      }),
  }),
});

export const getEmployeeExpenseSummarySchema = z.object({
  params: z.object({
    employeeId: z
      .string()
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().int().positive("Invalid employee ID")),
  }),
  query: z.object({
    startDate: dateString.optional(),
    endDate: dateString.optional(),
    status: expenseStatusEnum.optional(),
  }),
});
