import { Router } from "express";
import {
  getDashboardKPIsHandler,
  getComplianceCasesHandler,
  getComplianceCaseByIdHandler,
  createComplianceCaseHandler,
  updateComplianceCaseHandler,
  deleteComplianceCaseHandler,
  getViolationWatchlistHandler,
  getViolationCountsHandler,
  updateCaseStatusHandler,
  createEmployeeViolationHandler,
} from "../../controllers/ComplianceController.js";
import { authenticate } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  getDashboardKPIsQuerySchema,
  getComplianceCasesQuerySchema,
  getComplianceCaseByIdSchema,
  createComplianceCaseSchema,
  updateComplianceCaseSchema,
  deleteComplianceCaseSchema,
  getViolationWatchlistQuerySchema,
  getViolationCountsQuerySchema,
  updateCaseStatusSchema,
  createEmployeeViolationSchema,
} from "../../validations/compliance.validations.js";

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// Dashboard KPIs
router.get(
  "/kpis",
  validate(getDashboardKPIsQuerySchema),
  getDashboardKPIsHandler
);

// Compliance Cases CRUD
router
  .route("/cases")
  .get(validate(getComplianceCasesQuerySchema), getComplianceCasesHandler)
  .post(validate(createComplianceCaseSchema), createComplianceCaseHandler);

router
  .route("/cases/:id")
  .get(validate(getComplianceCaseByIdSchema), getComplianceCaseByIdHandler)
  .put(validate(updateComplianceCaseSchema), updateComplianceCaseHandler)
  .delete(validate(deleteComplianceCaseSchema), deleteComplianceCaseHandler);

// Case Status Update (separate endpoint for status changes)
router.patch(
  "/cases/:id/status",
  validate(updateCaseStatusSchema),
  updateCaseStatusHandler
);

// Violation Watchlist
router.get(
  "/watchlist",
  validate(getViolationWatchlistQuerySchema),
  getViolationWatchlistHandler
);

// Create Employee Violation
router.post(
  "/violations",
  validate(createEmployeeViolationSchema),
  createEmployeeViolationHandler
);

// Violation Counts/Analytics
router.get(
  "/violations/counts",
  validate(getViolationCountsQuerySchema),
  getViolationCountsHandler
);

export default router;
