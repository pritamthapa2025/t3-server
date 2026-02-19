import { Router, type IRouter } from "express";
import {
  getFinancialDashboardHandler,
  getFinancialSummarySectionHandler,
  getFinancialJobsSummarySectionHandler,
  getFinancialCostCategoriesSectionHandler,
  getFinancialProfitabilitySectionHandler,
  getFinancialProfitTrendSectionHandler,
  getFinancialForecastingSectionHandler,
  getFinancialReportsSectionHandler,
  getFinancialSummaryHandler,
  createFinancialSummaryHandler,
  updateFinancialSummaryHandler,
  getJobFinancialSummariesHandler,
  getJobFinancialSummaryHandler,
  createJobFinancialSummaryHandler,
  updateJobFinancialSummaryHandler,
  getFinancialCostCategoriesHandler,
  createFinancialCostCategoryHandler,
  updateFinancialCostCategoryHandler,
  deleteFinancialCostCategoryHandler,
  getProfitTrendHandler,
  createProfitTrendHandler,
  getCashFlowProjectionsHandler,
  createCashFlowProjectionHandler,
  updateCashFlowProjectionHandler,
  getCashFlowScenariosHandler,
  createCashFlowScenarioHandler,
  updateCashFlowScenarioHandler,
  getRevenueForecastHandler,
  createRevenueForecastHandler,
  updateRevenueForecastHandler,
  getFinancialReportsHandler,
  createFinancialReportHandler,
  updateFinancialReportHandler,
  deleteFinancialReportHandler,
} from "../../controllers/FinancialController.js";
import { authenticate } from "../../middleware/auth.js";
import { authorizeAnyFeature } from "../../middleware/featureAuthorize.js";
import { validate } from "../../middleware/validate.js";
import {
  getFinancialDashboardQuerySchema,
  getFinancialJobsSummaryQuerySchema,
  getFinancialSummaryQuerySchema,
  createFinancialSummarySchema,
  updateFinancialSummarySchema,
  getJobFinancialSummariesQuerySchema,
  getJobFinancialSummarySchema,
  createJobFinancialSummarySchema,
  updateJobFinancialSummarySchema,
  getFinancialCostCategoriesQuerySchema,
  createFinancialCostCategorySchema,
  updateFinancialCostCategorySchema,
  deleteFinancialCostCategorySchema,
  getProfitTrendQuerySchema,
  createProfitTrendSchema,
  getCashFlowProjectionsQuerySchema,
  createCashFlowProjectionSchema,
  updateCashFlowProjectionSchema,
  getCashFlowScenariosSchema,
  createCashFlowScenarioSchema,
  updateCashFlowScenarioSchema,
  getRevenueForecastQuerySchema,
  createRevenueForecastSchema,
  updateRevenueForecastSchema,
  getFinancialReportsQuerySchema,
  createFinancialReportSchema,
  updateFinancialReportSchema,
  deleteFinancialReportSchema,
} from "../../validations/financial.validations.js";

const router: IRouter = Router();

// Apply authentication middleware to all financial routes
router.use(authenticate);

// Financial analytics module is Executive-only per CSV section 1.1:
// Manager sees limited dashboard widgets; full P&L/cash-flow/forecasting = Executive only.
// Only Executive has financial.view / financial.edit in the seed.
const viewFinancial = authorizeAnyFeature("financial", ["view", "edit"]);

// ============================
// Financial module – report-style section APIs (one per tab/area)
// ============================
// GET /api/v1/org/financial/summary – Top-level KPIs
router.get(
  "/financial/summary",
  viewFinancial,
  validate(getFinancialDashboardQuerySchema),
  getFinancialSummarySectionHandler
);
// GET /api/v1/org/financial/jobs-summary – Jobs list for Summary tab table (pagination + search)
router.get(
  "/financial/jobs-summary",
  viewFinancial,
  validate(getFinancialJobsSummaryQuerySchema),
  getFinancialJobsSummarySectionHandler
);
// GET /api/v1/org/financial/cost-categories – Cost breakdown (donut + Budget at Risk)
router.get(
  "/financial/cost-categories",
  viewFinancial,
  validate(getFinancialDashboardQuerySchema),
  getFinancialCostCategoriesSectionHandler
);
// GET /api/v1/org/financial/profitability – Projected vs actual, job profitability, trend
router.get(
  "/financial/profitability",
  viewFinancial,
  validate(getFinancialDashboardQuerySchema),
  getFinancialProfitabilitySectionHandler
);
// GET /api/v1/org/financial/profit-trend – Trend data only (chart)
router.get(
  "/financial/profit-trend",
  viewFinancial,
  validate(getFinancialDashboardQuerySchema),
  getFinancialProfitTrendSectionHandler
);
// GET /api/v1/org/financial/forecasting – Cash flow projection, scenarios, revenue forecast
router.get(
  "/financial/forecasting",
  viewFinancial,
  validate(getFinancialDashboardQuerySchema),
  getFinancialForecastingSectionHandler
);
// GET /api/v1/org/financial/reports – Report definitions (Reports & Exports tab)
router.get(
  "/financial/reports",
  viewFinancial,
  validate(getFinancialDashboardQuerySchema),
  getFinancialReportsSectionHandler
);

// GET /api/v1/org/financial/dashboard – Optional: single aggregate call
router.get(
  "/financial/dashboard",
  viewFinancial,
  validate(getFinancialDashboardQuerySchema),
  getFinancialDashboardHandler
);

// Financial Summary CRUD — Executive only
router
  .route("/financial-summary")
  .get(viewFinancial, validate(getFinancialSummaryQuerySchema), getFinancialSummaryHandler)
  .post(viewFinancial, validate(createFinancialSummarySchema), createFinancialSummaryHandler);

router
  .route("/financial-summary/:id")
  .put(viewFinancial, validate(updateFinancialSummarySchema), updateFinancialSummaryHandler);

// Job Financial Summary Routes — Executive only
router
  .route("/job-financial-summary")
  .get(viewFinancial, validate(getJobFinancialSummariesQuerySchema), getJobFinancialSummariesHandler)
  .post(viewFinancial, validate(createJobFinancialSummarySchema), createJobFinancialSummaryHandler);

router
  .route("/job-financial-summary/:jobId")
  .get(viewFinancial, validate(getJobFinancialSummarySchema), getJobFinancialSummaryHandler)
  .put(viewFinancial, validate(updateJobFinancialSummarySchema), updateJobFinancialSummaryHandler);

// Financial Cost Categories Routes — Executive only
router
  .route("/financial-cost-categories")
  .get(viewFinancial, validate(getFinancialCostCategoriesQuerySchema), getFinancialCostCategoriesHandler)
  .post(viewFinancial, validate(createFinancialCostCategorySchema), createFinancialCostCategoryHandler);

router
  .route("/financial-cost-categories/:id")
  .put(viewFinancial, validate(updateFinancialCostCategorySchema), updateFinancialCostCategoryHandler)
  .delete(viewFinancial, validate(deleteFinancialCostCategorySchema), deleteFinancialCostCategoryHandler);

// Profit Trend Routes — Executive only
router
  .route("/profit-trend")
  .get(viewFinancial, validate(getProfitTrendQuerySchema), getProfitTrendHandler)
  .post(viewFinancial, validate(createProfitTrendSchema), createProfitTrendHandler);

// Cash Flow Projection Routes — Executive only
router
  .route("/cash-flow-projection")
  .get(viewFinancial, validate(getCashFlowProjectionsQuerySchema), getCashFlowProjectionsHandler)
  .post(viewFinancial, validate(createCashFlowProjectionSchema), createCashFlowProjectionHandler);

router
  .route("/cash-flow-projection/:id")
  .put(viewFinancial, validate(updateCashFlowProjectionSchema), updateCashFlowProjectionHandler);

// Cash Flow Scenarios Routes — Executive only
router
  .route("/cash-flow-scenarios/:projectionId")
  .get(viewFinancial, validate(getCashFlowScenariosSchema), getCashFlowScenariosHandler);

router
  .route("/cash-flow-scenarios")
  .post(viewFinancial, validate(createCashFlowScenarioSchema), createCashFlowScenarioHandler);

router
  .route("/cash-flow-scenarios/:id")
  .put(viewFinancial, validate(updateCashFlowScenarioSchema), updateCashFlowScenarioHandler);

// Revenue Forecast Routes — Executive only
router
  .route("/revenue-forecast")
  .get(viewFinancial, validate(getRevenueForecastQuerySchema), getRevenueForecastHandler)
  .post(viewFinancial, validate(createRevenueForecastSchema), createRevenueForecastHandler);

router
  .route("/revenue-forecast/:id")
  .put(viewFinancial, validate(updateRevenueForecastSchema), updateRevenueForecastHandler);

// Financial Reports Routes — Executive only
router
  .route("/financial-reports")
  .get(viewFinancial, validate(getFinancialReportsQuerySchema), getFinancialReportsHandler)
  .post(viewFinancial, validate(createFinancialReportSchema), createFinancialReportHandler);

router
  .route("/financial-reports/:id")
  .put(viewFinancial, validate(updateFinancialReportSchema), updateFinancialReportHandler)
  .delete(viewFinancial, validate(deleteFinancialReportSchema), deleteFinancialReportHandler);

export default router;
