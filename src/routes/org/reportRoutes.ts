import { Router, type IRouter } from "express";
import {
  getCompanySummaryKPIsHandler,
  getMonthlyRevenueTrendHandler,
  getJobPerformanceDataHandler,
  getClientRevenueDistributionHandler,
  getFinancialKPIsHandler,
  getProfitAndLossHandler,
  getCashFlowForecastHandler,
  getRevenueByClientHandler,
  getExpenseByCategoryHandler,
  getMonthlyExpenseTrendHandler,
  getVendorSpendHandler,
  getTechnicianHoursHandler,
  getLaborCostHandler,
  getAttendanceHandler,
  getFleetUsageHandler,
  getFleetMaintenanceHandler,
  getFuelExpenseHandler,
  getInventoryValuationHandler,
  getStockMovementHandler,
  getLowStockItemsHandler,
  getClientSpendHandler,
  getClientOutstandingHandler,
  getTechnicianProductivityHandler,
  getTechnicianQualityHandler,
  getTechnicianProfitHandler,
  getJobStatusSummaryHandler,
  getJobProfitabilityHandler,
  getJobCostBreakdownHandler,
  getJobTimelineHandler,
  getInvoiceSummaryHandler,
  getCustomerAgingHandler,
  getPaymentCollectionHandler,
} from "../../controllers/ReportController.js";
import { authenticate } from "../../middleware/auth.js";
import { requireAnyRole } from "../../middleware/featureAuthorize.js";
import { validate } from "../../middleware/validate.js";
import {
  getCompanySummaryKPIsQuerySchema,
  getMonthlyRevenueTrendQuerySchema,
  getJobPerformanceDataQuerySchema,
  getClientRevenueDistributionQuerySchema,
  getFinancialKPIsQuerySchema,
  getProfitAndLossQuerySchema,
  getCashFlowForecastQuerySchema,
  getRevenueByClientQuerySchema,
  getExpenseByCategoryQuerySchema,
  getMonthlyExpenseTrendQuerySchema,
  getVendorSpendQuerySchema,
  getTechnicianHoursQuerySchema,
  getLaborCostQuerySchema,
  getAttendanceQuerySchema,
  getFleetUsageQuerySchema,
  getFleetMaintenanceQuerySchema,
  getFuelExpenseQuerySchema,
  getInventoryValuationQuerySchema,
  getStockMovementQuerySchema,
  getLowStockItemsQuerySchema,
  getClientSpendQuerySchema,
  getClientOutstandingQuerySchema,
  getTechnicianProductivityQuerySchema,
  getTechnicianQualityQuerySchema,
  getTechnicianProfitQuerySchema,
  getJobStatusSummaryQuerySchema,
  getJobProfitabilityQuerySchema,
  getJobCostBreakdownQuerySchema,
  getJobTimelineQuerySchema,
  getInvoiceSummaryQuerySchema,
  getCustomerAgingQuerySchema,
  getPaymentCollectionQuerySchema,
} from "../../validations/reports.validations.js";

const router: IRouter = Router();

// All routes require authentication
router.use(authenticate);

// Reports restricted to Manager/Executive (company-wide financial/operational data)
const managerOrAbove = requireAnyRole("Executive", "Manager");

// ============================
// Company Summary Routes (Manager/Executive only)
// ============================

router.get(
  "/reports/company-summary/kpis",
  managerOrAbove,
  validate(getCompanySummaryKPIsQuerySchema),
  getCompanySummaryKPIsHandler
);

router.get(
  "/reports/company-summary/revenue-trend",
  managerOrAbove,
  validate(getMonthlyRevenueTrendQuerySchema),
  getMonthlyRevenueTrendHandler
);

router.get(
  "/reports/company-summary/job-performance",
  managerOrAbove,
  validate(getJobPerformanceDataQuerySchema),
  getJobPerformanceDataHandler
);

router.get(
  "/reports/company-summary/client-revenue",
  managerOrAbove,
  validate(getClientRevenueDistributionQuerySchema),
  getClientRevenueDistributionHandler
);

// ============================
// Financial Reports Routes (Manager/Executive only)
// ============================

router.get(
  "/reports/financial/kpis",
  managerOrAbove,
  validate(getFinancialKPIsQuerySchema),
  getFinancialKPIsHandler
);

router.get(
  "/reports/financial/profit-loss",
  managerOrAbove,
  validate(getProfitAndLossQuerySchema),
  getProfitAndLossHandler
);

router.get(
  "/reports/financial/cash-flow",
  managerOrAbove,
  validate(getCashFlowForecastQuerySchema),
  getCashFlowForecastHandler
);

router.get(
  "/reports/financial/revenue-by-client",
  managerOrAbove,
  validate(getRevenueByClientQuerySchema),
  getRevenueByClientHandler
);

// ============================
// Expense Reports Routes (Manager/Executive only)
// ============================

router.get(
  "/reports/expenses/by-category",
  managerOrAbove,
  validate(getExpenseByCategoryQuerySchema),
  getExpenseByCategoryHandler
);

router.get(
  "/reports/expenses/monthly-trend",
  managerOrAbove,
  validate(getMonthlyExpenseTrendQuerySchema),
  getMonthlyExpenseTrendHandler
);

router.get(
  "/reports/expenses/vendor-spend",
  managerOrAbove,
  validate(getVendorSpendQuerySchema),
  getVendorSpendHandler
);

// ============================
// Timesheet & Labor Reports Routes
// Technicians see their own data only (controller scopes via getDataFilterConditions)
// ============================

router.get(
  "/reports/timesheet-labor/hours",
  validate(getTechnicianHoursQuerySchema),
  getTechnicianHoursHandler
);

router.get(
  "/reports/timesheet-labor/labor-cost",
  validate(getLaborCostQuerySchema),
  getLaborCostHandler
);

router.get(
  "/reports/timesheet-labor/attendance",
  validate(getAttendanceQuerySchema),
  getAttendanceHandler
);

// ============================
// Fleet Reports Routes (Manager/Executive only)
// ============================

router.get(
  "/reports/fleet/usage",
  managerOrAbove,
  validate(getFleetUsageQuerySchema),
  getFleetUsageHandler
);

router.get(
  "/reports/fleet/maintenance",
  managerOrAbove,
  validate(getFleetMaintenanceQuerySchema),
  getFleetMaintenanceHandler
);

router.get(
  "/reports/fleet/fuel",
  managerOrAbove,
  validate(getFuelExpenseQuerySchema),
  getFuelExpenseHandler
);

// ============================
// Inventory Reports Routes (Manager/Executive only)
// ============================

router.get(
  "/reports/inventory/valuation",
  managerOrAbove,
  validate(getInventoryValuationQuerySchema),
  getInventoryValuationHandler
);

router.get(
  "/reports/inventory/stock-movement",
  managerOrAbove,
  validate(getStockMovementQuerySchema),
  getStockMovementHandler
);

router.get(
  "/reports/inventory/low-stock",
  managerOrAbove,
  validate(getLowStockItemsQuerySchema),
  getLowStockItemsHandler
);

// ============================
// Client Reports Routes (Manager/Executive only)
// ============================

router.get(
  "/reports/clients/spend",
  managerOrAbove,
  validate(getClientSpendQuerySchema),
  getClientSpendHandler
);

router.get(
  "/reports/clients/outstanding",
  managerOrAbove,
  validate(getClientOutstandingQuerySchema),
  getClientOutstandingHandler
);

// ============================
// Technician Performance Routes
// Technicians see their own data only (controller scopes via resolveOwnTechnicianId)
// ============================

router.get(
  "/reports/technician-performance/productivity",
  validate(getTechnicianProductivityQuerySchema),
  getTechnicianProductivityHandler
);

router.get(
  "/reports/technician-performance/quality",
  validate(getTechnicianQualityQuerySchema),
  getTechnicianQualityHandler
);

router.get(
  "/reports/technician-performance/profit",
  validate(getTechnicianProfitQuerySchema),
  getTechnicianProfitHandler
);

// ============================
// Job Reports Routes (Manager/Executive only)
// ============================

router.get(
  "/reports/jobs/status-summary",
  managerOrAbove,
  validate(getJobStatusSummaryQuerySchema),
  getJobStatusSummaryHandler
);

router.get(
  "/reports/jobs/profitability",
  managerOrAbove,
  validate(getJobProfitabilityQuerySchema),
  getJobProfitabilityHandler
);

router.get(
  "/reports/jobs/cost-breakdown",
  managerOrAbove,
  validate(getJobCostBreakdownQuerySchema),
  getJobCostBreakdownHandler
);

router.get(
  "/reports/jobs/timeline",
  managerOrAbove,
  validate(getJobTimelineQuerySchema),
  getJobTimelineHandler
);

// ============================
// Invoicing & Payments Routes (Manager/Executive only)
// ============================

router.get(
  "/reports/invoicing/summary",
  managerOrAbove,
  validate(getInvoiceSummaryQuerySchema),
  getInvoiceSummaryHandler
);

router.get(
  "/reports/invoicing/aging",
  managerOrAbove,
  validate(getCustomerAgingQuerySchema),
  getCustomerAgingHandler
);

router.get(
  "/reports/invoicing/collection",
  managerOrAbove,
  validate(getPaymentCollectionQuerySchema),
  getPaymentCollectionHandler
);

export default router;
