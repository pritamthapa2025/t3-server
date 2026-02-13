import { z } from "zod";

// ============================
// Query Schemas
// ============================

export const dateRangeQuerySchema = z.object({
  query: z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }),
});

export const financialReportQuerySchema = z.object({
  query: z.object({
    organizationId: z.string().uuid().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    jobType: z.string().optional(),
  }),
});

export const expenseReportQuerySchema = z.object({
  query: z.object({
    organizationId: z.string().uuid().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    jobType: z.string().optional(),
    category: z.string().optional(),
  }),
});

export const timesheetReportQuerySchema = z.object({
  query: z.object({
    organizationId: z.string().uuid().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    technicianId: z.string().optional(),
    managerId: z.string().optional(),
  }),
});

export const fleetReportQuerySchema = z.object({
  query: z.object({
    organizationId: z.string().uuid().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    vehicleId: z.string().uuid().optional(),
    location: z.string().optional(),
  }),
});

export const inventoryReportQuerySchema = z.object({
  query: z.object({
    organizationId: z.string().uuid().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    category: z.string().optional(),
    location: z.string().optional(),
  }),
});

export const clientReportQuerySchema = z.object({
  query: z.object({
    organizationId: z.string().uuid().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    paymentStatus: z.string().optional(),
  }),
});

export const technicianPerformanceQuerySchema = z.object({
  query: z.object({
    organizationId: z.string().uuid().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    technicianId: z.string().optional(),
    managerId: z.string().optional(),
  }),
});

export const jobReportQuerySchema = z.object({
  query: z.object({
    organizationId: z.string().uuid().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    jobType: z.string().optional(),
    status: z.string().optional(),
    managerId: z.string().optional(),
    technicianId: z.string().optional(),
  }),
});

export const invoicingReportQuerySchema = z.object({
  query: z.object({
    organizationId: z.string().uuid().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    status: z.string().optional(),
    paymentStatus: z.string().optional(),
  }),
});

// Company Summary
export const getCompanySummaryKPIsQuerySchema = dateRangeQuerySchema;
export const getMonthlyRevenueTrendQuerySchema = dateRangeQuerySchema;
export const getJobPerformanceDataQuerySchema = dateRangeQuerySchema;
export const getClientRevenueDistributionQuerySchema = dateRangeQuerySchema;

// Financial Reports
export const getFinancialKPIsQuerySchema = financialReportQuerySchema;
export const getProfitAndLossQuerySchema = financialReportQuerySchema;
export const getCashFlowForecastQuerySchema = financialReportQuerySchema;
export const getRevenueByClientQuerySchema = financialReportQuerySchema;

// Expense Reports
export const getExpenseByCategoryQuerySchema = expenseReportQuerySchema;
export const getMonthlyExpenseTrendQuerySchema = expenseReportQuerySchema;
export const getVendorSpendQuerySchema = expenseReportQuerySchema;

// Timesheet & Labor Reports
export const getTechnicianHoursQuerySchema = timesheetReportQuerySchema;
export const getLaborCostQuerySchema = timesheetReportQuerySchema;
export const getAttendanceQuerySchema = timesheetReportQuerySchema;

// Fleet Reports
export const getFleetUsageQuerySchema = fleetReportQuerySchema;
export const getFleetMaintenanceQuerySchema = fleetReportQuerySchema;
export const getFuelExpenseQuerySchema = fleetReportQuerySchema;

// Inventory Reports
export const getInventoryValuationQuerySchema = inventoryReportQuerySchema;
export const getStockMovementQuerySchema = inventoryReportQuerySchema;
export const getLowStockItemsQuerySchema = inventoryReportQuerySchema;

// Client Reports
export const getClientSpendQuerySchema = clientReportQuerySchema;
export const getClientOutstandingQuerySchema = clientReportQuerySchema;

// Technician Performance Reports
export const getTechnicianProductivityQuerySchema = technicianPerformanceQuerySchema;
export const getTechnicianQualityQuerySchema = technicianPerformanceQuerySchema;
export const getTechnicianProfitQuerySchema = technicianPerformanceQuerySchema;

// Job Reports
export const getJobStatusSummaryQuerySchema = jobReportQuerySchema;
export const getJobProfitabilityQuerySchema = jobReportQuerySchema;
export const getJobCostBreakdownQuerySchema = jobReportQuerySchema;
export const getJobTimelineQuerySchema = jobReportQuerySchema;

// Invoicing & Payments Reports
export const getInvoiceSummaryQuerySchema = invoicingReportQuerySchema;
export const getCustomerAgingQuerySchema = invoicingReportQuerySchema;
export const getPaymentCollectionQuerySchema = invoicingReportQuerySchema;
