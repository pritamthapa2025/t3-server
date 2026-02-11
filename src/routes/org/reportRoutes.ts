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

// ============================
// Company Summary Routes
// ============================

// GET /org/reports/company-summary/kpis - Get company summary KPIs
router.get(
  "/reports/company-summary/kpis",
  validate(getCompanySummaryKPIsQuerySchema),
  getCompanySummaryKPIsHandler
);

// GET /org/reports/company-summary/revenue-trend - Get monthly revenue trend
router.get(
  "/reports/company-summary/revenue-trend",
  validate(getMonthlyRevenueTrendQuerySchema),
  getMonthlyRevenueTrendHandler
);

// GET /org/reports/company-summary/job-performance - Get job performance data
router.get(
  "/reports/company-summary/job-performance",
  validate(getJobPerformanceDataQuerySchema),
  getJobPerformanceDataHandler
);

// GET /org/reports/company-summary/client-revenue - Get client revenue distribution
router.get(
  "/reports/company-summary/client-revenue",
  validate(getClientRevenueDistributionQuerySchema),
  getClientRevenueDistributionHandler
);

// ============================
// Financial Reports Routes
// ============================

// GET /org/reports/financial/kpis - Get all financial KPIs
router.get(
  "/reports/financial/kpis",
  validate(getFinancialKPIsQuerySchema),
  getFinancialKPIsHandler
);

// GET /org/reports/financial/profit-loss - Get profit & loss statement
router.get(
  "/reports/financial/profit-loss",
  validate(getProfitAndLossQuerySchema),
  getProfitAndLossHandler
);

// GET /org/reports/financial/cash-flow - Get cash flow forecast
router.get(
  "/reports/financial/cash-flow",
  validate(getCashFlowForecastQuerySchema),
  getCashFlowForecastHandler
);

// GET /org/reports/financial/revenue-by-client - Get revenue by client with filters
router.get(
  "/reports/financial/revenue-by-client",
  validate(getRevenueByClientQuerySchema),
  getRevenueByClientHandler
);

// ============================
// Expense Reports Routes
// ============================

// GET /org/reports/expenses/by-category - Get expenses breakdown by category
router.get(
  "/reports/expenses/by-category",
  validate(getExpenseByCategoryQuerySchema),
  getExpenseByCategoryHandler
);

// GET /org/reports/expenses/monthly-trend - Get monthly expense trend by category
router.get(
  "/reports/expenses/monthly-trend",
  validate(getMonthlyExpenseTrendQuerySchema),
  getMonthlyExpenseTrendHandler
);

// GET /org/reports/expenses/vendor-spend - Get vendor spend report
router.get(
  "/reports/expenses/vendor-spend",
  validate(getVendorSpendQuerySchema),
  getVendorSpendHandler
);

// ============================
// Timesheet & Labor Reports Routes
// ============================

// GET /org/reports/timesheet-labor/hours - Get technician hours report
router.get(
  "/reports/timesheet-labor/hours",
  validate(getTechnicianHoursQuerySchema),
  getTechnicianHoursHandler
);

// GET /org/reports/timesheet-labor/labor-cost - Get labor cost report
router.get(
  "/reports/timesheet-labor/labor-cost",
  validate(getLaborCostQuerySchema),
  getLaborCostHandler
);

// GET /org/reports/timesheet-labor/attendance - Get attendance report
router.get(
  "/reports/timesheet-labor/attendance",
  validate(getAttendanceQuerySchema),
  getAttendanceHandler
);

// ============================
// Fleet Reports Routes
// ============================

// GET /org/reports/fleet/usage - Get fleet usage report
router.get(
  "/reports/fleet/usage",
  validate(getFleetUsageQuerySchema),
  getFleetUsageHandler
);

// GET /org/reports/fleet/maintenance - Get fleet maintenance cost report
router.get(
  "/reports/fleet/maintenance",
  validate(getFleetMaintenanceQuerySchema),
  getFleetMaintenanceHandler
);

// GET /org/reports/fleet/fuel - Get fuel expense report
router.get(
  "/reports/fleet/fuel",
  validate(getFuelExpenseQuerySchema),
  getFuelExpenseHandler
);

// ============================
// Inventory Reports Routes
// ============================

// GET /org/reports/inventory/valuation - Get inventory valuation
router.get(
  "/reports/inventory/valuation",
  validate(getInventoryValuationQuerySchema),
  getInventoryValuationHandler
);

// GET /org/reports/inventory/stock-movement - Get stock movement report
router.get(
  "/reports/inventory/stock-movement",
  validate(getStockMovementQuerySchema),
  getStockMovementHandler
);

// GET /org/reports/inventory/low-stock - Get low stock items
router.get(
  "/reports/inventory/low-stock",
  validate(getLowStockItemsQuerySchema),
  getLowStockItemsHandler
);

// ============================
// Client Reports Routes
// ============================

// GET /org/reports/clients/spend - Get client spend report
router.get(
  "/reports/clients/spend",
  validate(getClientSpendQuerySchema),
  getClientSpendHandler
);

// GET /org/reports/clients/outstanding - Get client outstanding payments
router.get(
  "/reports/clients/outstanding",
  validate(getClientOutstandingQuerySchema),
  getClientOutstandingHandler
);

// ============================
// Technician Performance Routes
// ============================

// GET /org/reports/technician-performance/productivity - Get productivity report
router.get(
  "/reports/technician-performance/productivity",
  validate(getTechnicianProductivityQuerySchema),
  getTechnicianProductivityHandler
);

// GET /org/reports/technician-performance/quality - Get quality metrics
router.get(
  "/reports/technician-performance/quality",
  validate(getTechnicianQualityQuerySchema),
  getTechnicianQualityHandler
);

// GET /org/reports/technician-performance/profit - Get profit contribution
router.get(
  "/reports/technician-performance/profit",
  validate(getTechnicianProfitQuerySchema),
  getTechnicianProfitHandler
);

// ============================
// Job Reports Routes
// ============================

// GET /org/reports/jobs/status-summary - Get job status summary
router.get(
  "/reports/jobs/status-summary",
  validate(getJobStatusSummaryQuerySchema),
  getJobStatusSummaryHandler
);

// GET /org/reports/jobs/profitability - Get job profitability analysis
router.get(
  "/reports/jobs/profitability",
  validate(getJobProfitabilityQuerySchema),
  getJobProfitabilityHandler
);

// GET /org/reports/jobs/cost-breakdown - Get job cost breakdown
router.get(
  "/reports/jobs/cost-breakdown",
  validate(getJobCostBreakdownQuerySchema),
  getJobCostBreakdownHandler
);

// GET /org/reports/jobs/timeline - Get job timeline data
router.get(
  "/reports/jobs/timeline",
  validate(getJobTimelineQuerySchema),
  getJobTimelineHandler
);

// ============================
// Invoicing & Payments Routes
// ============================

// GET /org/reports/invoicing/summary - Get invoice summary
router.get(
  "/reports/invoicing/summary",
  validate(getInvoiceSummaryQuerySchema),
  getInvoiceSummaryHandler
);

// GET /org/reports/invoicing/aging - Get customer aging report
router.get(
  "/reports/invoicing/aging",
  validate(getCustomerAgingQuerySchema),
  getCustomerAgingHandler
);

// GET /org/reports/invoicing/collection - Get payment collection data
router.get(
  "/reports/invoicing/collection",
  validate(getPaymentCollectionQuerySchema),
  getPaymentCollectionHandler
);

export default router;
