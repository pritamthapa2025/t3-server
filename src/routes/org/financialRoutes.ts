import { Router } from "express";
import {
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
import { validate } from "../../middleware/validate.js";
import {
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
import { generalTransformer } from "../../middleware/response-transformer.js";

const router = Router();

// Apply authentication middleware to all financial routes
router.use(authenticate);

// Apply timezone transformation to all GET responses
router.use(generalTransformer);

// Financial Summary Routes
router
  .route("/financial-summary")
  .get(validate(getFinancialSummaryQuerySchema), getFinancialSummaryHandler)
  .post(validate(createFinancialSummarySchema), createFinancialSummaryHandler);

router
  .route("/financial-summary/:id")
  .put(validate(updateFinancialSummarySchema), updateFinancialSummaryHandler);

// Job Financial Summary Routes
router
  .route("/job-financial-summary")
  .get(validate(getJobFinancialSummariesQuerySchema), getJobFinancialSummariesHandler)
  .post(validate(createJobFinancialSummarySchema), createJobFinancialSummaryHandler);

router
  .route("/job-financial-summary/:jobId")
  .get(validate(getJobFinancialSummarySchema), getJobFinancialSummaryHandler)
  .put(validate(updateJobFinancialSummarySchema), updateJobFinancialSummaryHandler);

// Financial Cost Categories Routes
router
  .route("/financial-cost-categories")
  .get(validate(getFinancialCostCategoriesQuerySchema), getFinancialCostCategoriesHandler)
  .post(validate(createFinancialCostCategorySchema), createFinancialCostCategoryHandler);

router
  .route("/financial-cost-categories/:id")
  .put(validate(updateFinancialCostCategorySchema), updateFinancialCostCategoryHandler)
  .delete(validate(deleteFinancialCostCategorySchema), deleteFinancialCostCategoryHandler);

// Profit Trend Routes
router
  .route("/profit-trend")
  .get(validate(getProfitTrendQuerySchema), getProfitTrendHandler)
  .post(validate(createProfitTrendSchema), createProfitTrendHandler);

// Cash Flow Projection Routes
router
  .route("/cash-flow-projection")
  .get(validate(getCashFlowProjectionsQuerySchema), getCashFlowProjectionsHandler)
  .post(validate(createCashFlowProjectionSchema), createCashFlowProjectionHandler);

router
  .route("/cash-flow-projection/:id")
  .put(validate(updateCashFlowProjectionSchema), updateCashFlowProjectionHandler);

// Cash Flow Scenarios Routes
router
  .route("/cash-flow-scenarios/:projectionId")
  .get(validate(getCashFlowScenariosSchema), getCashFlowScenariosHandler);

router
  .route("/cash-flow-scenarios")
  .post(validate(createCashFlowScenarioSchema), createCashFlowScenarioHandler);

router
  .route("/cash-flow-scenarios/:id")
  .put(validate(updateCashFlowScenarioSchema), updateCashFlowScenarioHandler);

// Revenue Forecast Routes
router
  .route("/revenue-forecast")
  .get(validate(getRevenueForecastQuerySchema), getRevenueForecastHandler)
  .post(validate(createRevenueForecastSchema), createRevenueForecastHandler);

router
  .route("/revenue-forecast/:id")
  .put(validate(updateRevenueForecastSchema), updateRevenueForecastHandler);

// Financial Reports Routes
router
  .route("/financial-reports")
  .get(validate(getFinancialReportsQuerySchema), getFinancialReportsHandler)
  .post(validate(createFinancialReportSchema), createFinancialReportHandler);

router
  .route("/financial-reports/:id")
  .put(validate(updateFinancialReportSchema), updateFinancialReportHandler)
  .delete(validate(deleteFinancialReportSchema), deleteFinancialReportHandler);

export default router;
