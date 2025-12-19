import { z } from "zod";

// Common schemas
const uuidSchema = z.string().uuid("Invalid ID format - must be a valid UUID");
const decimalSchema = z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid number format. Please provide a valid decimal number (e.g., 1000.00 or 99.99)");
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format. Please use YYYY-MM-DD format (e.g., 2024-01-15)");

// Financial Summary Validations
export const getFinancialSummaryQuerySchema = z.object({
  query: z.object({
    organizationId: uuidSchema,
    periodStart: dateSchema.optional(),
    periodEnd: dateSchema.optional(),
  }),
});

export const createFinancialSummarySchema = z.object({
  body: z.object({
    organizationId: uuidSchema,
    periodStart: dateSchema,
    periodEnd: dateSchema,
    totalContractValue: decimalSchema.optional(),
    totalInvoiced: decimalSchema.optional(),
    totalPaid: decimalSchema.optional(),
    totalJobExpenses: decimalSchema.optional(),
    totalOperatingExpenses: decimalSchema.optional(),
    totalCost: decimalSchema.optional(),
    projectedProfit: decimalSchema.optional(),
    actualProfit: decimalSchema.optional(),
  }),
});

export const updateFinancialSummarySchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    totalContractValue: decimalSchema.optional(),
    totalInvoiced: decimalSchema.optional(),
    totalPaid: decimalSchema.optional(),
    totalJobExpenses: decimalSchema.optional(),
    totalOperatingExpenses: decimalSchema.optional(),
    totalCost: decimalSchema.optional(),
    projectedProfit: decimalSchema.optional(),
    actualProfit: decimalSchema.optional(),
  }).refine(
    (data) => Object.keys(data).length > 0,
    { message: "At least one field must be provided to update the financial summary" }
  ),
});

// Job Financial Summary Validations
export const getJobFinancialSummariesQuerySchema = z.object({
  query: z.object({
    organizationId: uuidSchema,
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
  }),
});

export const getJobFinancialSummarySchema = z.object({
  params: z.object({
    jobId: uuidSchema,
  }),
});

export const createJobFinancialSummarySchema = z.object({
  body: z.object({
    jobId: uuidSchema,
    organizationId: uuidSchema,
    contractValue: decimalSchema,
    totalInvoiced: decimalSchema.optional(),
    totalPaid: decimalSchema.optional(),
    vendorsOwed: decimalSchema.optional(),
    laborPaidToDate: decimalSchema.optional(),
    jobCompletionRate: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid percentage").optional(),
    profitability: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid percentage").optional(),
    profitMargin: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid percentage").optional(),
  }),
});

export const updateJobFinancialSummarySchema = z.object({
  params: z.object({
    jobId: uuidSchema,
  }),
  body: z.object({
    contractValue: decimalSchema.optional(),
    totalInvoiced: decimalSchema.optional(),
    totalPaid: decimalSchema.optional(),
    vendorsOwed: decimalSchema.optional(),
    laborPaidToDate: decimalSchema.optional(),
    jobCompletionRate: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid percentage").optional(),
    profitability: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid percentage").optional(),
    profitMargin: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid percentage").optional(),
  }).refine(
    (data) => Object.keys(data).length > 0,
    { message: "At least one field must be provided to update the financial summary" }
  ),
});

// Financial Cost Categories Validations
export const getFinancialCostCategoriesQuerySchema = z.object({
  query: z.object({
    organizationId: uuidSchema,
    periodStart: dateSchema.optional(),
    periodEnd: dateSchema.optional(),
  }),
});

export const createFinancialCostCategorySchema = z.object({
  body: z.object({
    organizationId: uuidSchema,
    categoryKey: z
      .string()
      .min(1, "Category key is required and cannot be empty")
      .max(50, "Category key is too long (maximum 50 characters)")
      .trim(),
    categoryLabel: z
      .string()
      .min(1, "Category label is required and cannot be empty")
      .max(255, "Category label is too long (maximum 255 characters)")
      .trim(),
    spent: decimalSchema.optional(),
    budget: decimalSchema.optional(),
    percentOfTotal: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/, "Invalid percentage format. Please provide a valid percentage (e.g., 75.50)")
      .optional(),
    status: z.enum(["on-track", "warning", "over"], {
      message: "Status must be one of: on-track, warning, or over"
    }).optional(),
    periodStart: dateSchema,
    periodEnd: dateSchema,
  }),
});

export const updateFinancialCostCategorySchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    categoryLabel: z.string().min(1).max(255).optional(),
    spent: decimalSchema.optional(),
    budget: decimalSchema.optional(),
    percentOfTotal: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid percentage").optional(),
    status: z.enum(["on-track", "warning", "over"]).optional(),
  }).refine(
    (data) => Object.keys(data).length > 0,
    { message: "At least one field must be provided to update the financial summary" }
  ),
});

export const deleteFinancialCostCategorySchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

// Profit Trend Validations
export const getProfitTrendQuerySchema = z.object({
  query: z.object({
    organizationId: uuidSchema,
    startDate: dateSchema.optional(),
    endDate: dateSchema.optional(),
  }),
});

export const createProfitTrendSchema = z.object({
  body: z.object({
    organizationId: uuidSchema,
    period: z
      .string()
      .min(1, "Period is required and cannot be empty")
      .max(50, "Period is too long (maximum 50 characters)")
      .trim(),
    periodDate: dateSchema,
    revenue: decimalSchema.optional(),
    expenses: decimalSchema.optional(),
  }),
});

// Cash Flow Projection Validations
export const getCashFlowProjectionsQuerySchema = z.object({
  query: z.object({
    organizationId: uuidSchema,
    startDate: dateSchema.optional(),
    endDate: dateSchema.optional(),
  }),
});

export const createCashFlowProjectionSchema = z.object({
  body: z.object({
    organizationId: uuidSchema,
    projectionDate: dateSchema,
    periodStart: dateSchema,
    periodEnd: dateSchema,
    projectedIncome: decimalSchema.optional(),
    projectedExpenses: decimalSchema.optional(),
    pipelineCoverageMonths: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/, "Invalid pipeline coverage format. Please provide a valid number (e.g., 3.5)")
      .optional(),
    openInvoicesCount: z
      .number()
      .int("Open invoices count must be a whole number")
      .min(0, "Open invoices count cannot be negative")
      .optional(),
    averageCollectionDays: z
      .number()
      .int("Average collection days must be a whole number")
      .min(0, "Average collection days cannot be negative")
      .optional(),
  }),
});

export const updateCashFlowProjectionSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    projectedIncome: decimalSchema.optional(),
    projectedExpenses: decimalSchema.optional(),
    pipelineCoverageMonths: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid decimal").optional(),
    openInvoicesCount: z.number().int().min(0).optional(),
    averageCollectionDays: z.number().int().min(0).optional(),
  }).refine(
    (data) => Object.keys(data).length > 0,
    { message: "At least one field must be provided to update the financial summary" }
  ),
});

// Cash Flow Scenarios Validations
export const getCashFlowScenariosSchema = z.object({
  params: z.object({
    projectionId: uuidSchema,
  }),
});

export const createCashFlowScenarioSchema = z.object({
  body: z.object({
    organizationId: uuidSchema,
    projectionId: uuidSchema,
    scenarioType: z.enum(["best", "realistic", "worst"], {
      message: "Scenario type must be one of: best, realistic, or worst"
    }),
    label: z
      .string()
      .min(1, "Label is required and cannot be empty")
      .max(255, "Label is too long (maximum 255 characters)")
      .trim(),
    description: z
      .string()
      .max(1000, "Description is too long (maximum 1000 characters)")
      .optional(),
    projectedIncome: decimalSchema.optional(),
    projectedExpenses: decimalSchema.optional(),
    changeDescription: z
      .string()
      .max(255, "Change description is too long (maximum 255 characters)")
      .optional(),
  }),
});

export const updateCashFlowScenarioSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    label: z.string().min(1).max(255).optional(),
    description: z.string().max(1000).optional(),
    projectedIncome: decimalSchema.optional(),
    projectedExpenses: decimalSchema.optional(),
    changeDescription: z.string().max(255).optional(),
  }).refine(
    (data) => Object.keys(data).length > 0,
    { message: "At least one field must be provided to update the financial summary" }
  ),
});

// Revenue Forecast Validations
export const getRevenueForecastQuerySchema = z.object({
  query: z.object({
    organizationId: uuidSchema,
    year: z
      .string()
      .regex(/^\d{4}$/, "Invalid year format. Please provide a 4-digit year (e.g., 2024)")
      .optional(),
  }),
});

export const createRevenueForecastSchema = z.object({
  body: z.object({
    organizationId: uuidSchema,
    month: z
      .string()
      .min(1, "Month is required and cannot be empty")
      .max(10, "Month is too long (maximum 10 characters)")
      .trim(),
    monthDate: dateSchema,
    committed: decimalSchema.optional(),
    pipeline: decimalSchema.optional(),
    probability: z
      .string()
      .regex(/^0(\.\d{1,4})?$|^1(\.0{1,4})?$/, "Probability must be between 0 and 1 (e.g., 0.75 for 75%)")
      .optional(),
  }),
});

export const updateRevenueForecastSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    committed: decimalSchema.optional(),
    pipeline: decimalSchema.optional(),
    probability: z.string().regex(/^0(\.\d{1,4})?$|^1(\.0{1,4})?$/, "Probability must be between 0 and 1").optional(),
  }).refine(
    (data) => Object.keys(data).length > 0,
    { message: "At least one field must be provided to update the financial summary" }
  ),
});

// Financial Reports Validations
export const getFinancialReportsQuerySchema = z.object({
  query: z.object({
    organizationId: uuidSchema,
    category: z.enum(["Revenue", "Expenses", "Profitability", "Vendors"], {
      message: "Category must be one of: Revenue, Expenses, Profitability, or Vendors"
    }).optional(),
  }),
});

export const createFinancialReportSchema = z.object({
  body: z.object({
    organizationId: uuidSchema,
    reportKey: z
      .string()
      .min(1, "Report key is required and cannot be empty")
      .max(50, "Report key is too long (maximum 50 characters)")
      .trim(),
    title: z
      .string()
      .min(1, "Title is required and cannot be empty")
      .max(255, "Title is too long (maximum 255 characters)")
      .trim(),
    description: z
      .string()
      .max(1000, "Description is too long (maximum 1000 characters)")
      .optional(),
    category: z.enum(["Revenue", "Expenses", "Profitability", "Vendors"], {
      message: "Category must be one of: Revenue, Expenses, Profitability, or Vendors"
    }),
    reportConfig: z.any().optional(),
  }),
});

export const updateFinancialReportSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    title: z
      .string()
      .min(1, "Title cannot be empty")
      .max(255, "Title is too long (maximum 255 characters)")
      .trim()
      .optional(),
    description: z
      .string()
      .max(1000, "Description is too long (maximum 1000 characters)")
      .optional(),
    category: z.enum(["Revenue", "Expenses", "Profitability", "Vendors"], {
      message: "Category must be one of: Revenue, Expenses, Profitability, or Vendors"
    }).optional(),
    reportConfig: z.any().optional(),
  }).refine(
    (data) => Object.keys(data).length > 0,
    { message: "At least one field must be provided to update the financial report" }
  ),
});

export const deleteFinancialReportSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});
