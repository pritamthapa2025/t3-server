import { Router, type IRouter } from "express";
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
  bulkDeleteComplianceCasesHandler,
} from "../../controllers/ComplianceController.js";
import { authenticate } from "../../middleware/auth.js";
import { authorizeFeature, authorizeAnyFeature } from "../../middleware/featureAuthorize.js";
import { validate } from "../../middleware/validate.js";
import { bulkDeleteUuidSchema } from "../../validations/bulk-delete.validations.js";
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

const router: IRouter = Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// Feature shorthand constants — mirrors CSV section 1.3 Performance & Compliance
// Technician: view_own incidents, create; Manager: view_all + conduct reviews; Executive: full
const viewCases      = authorizeAnyFeature("compliance", ["view_own_reviews", "view_incident_reports"]);
const createCase     = authorizeFeature("compliance", "create_incident_reports");
const editCase       = authorizeFeature("compliance", "edit_incident_reports");   // Executive only
const applyViolation = authorizeFeature("compliance", "apply_violation_strike");  // Executive only
// Watchlist, counts, audit-level views — Manager/Executive only (Technician has none for view_audit_logs)
const viewAudit      = authorizeFeature("compliance", "view_audit_logs");

// Dashboard KPIs — Manager/Executive only (audit-level overview)
router.get(
  "/kpis",
  viewAudit,
  validate(getDashboardKPIsQuerySchema),
  getDashboardKPIsHandler
);

// Compliance Cases CRUD
// GET: all roles can view (Technician sees own via service filter; Manager sees all)
// POST: all roles can create incident reports
router
  .route("/cases")
  .get(viewCases, validate(getComplianceCasesQuerySchema), getComplianceCasesHandler)
  .post(createCase, validate(createComplianceCaseSchema), createComplianceCaseHandler);

router
  .route("/cases/:id")
  .get(viewCases, validate(getComplianceCaseByIdSchema), getComplianceCaseByIdHandler)
  .put(editCase, validate(updateComplianceCaseSchema), updateComplianceCaseHandler)       // Executive only
  .delete(editCase, validate(deleteComplianceCaseSchema), deleteComplianceCaseHandler);   // Executive only

// Case Status Update — Executive only
router.patch(
  "/cases/:id/status",
  editCase,
  validate(updateCaseStatusSchema),
  updateCaseStatusHandler
);

// Violation Watchlist — Manager/Executive only
router.get(
  "/watchlist",
  viewAudit,
  validate(getViolationWatchlistQuerySchema),
  getViolationWatchlistHandler
);

// Apply Violation Strike — Executive only per CSV
router.post(
  "/violations",
  applyViolation,
  validate(createEmployeeViolationSchema),
  createEmployeeViolationHandler
);

// Violation Counts/Analytics — Manager/Executive only
router.get(
  "/violations/counts",
  viewAudit,
  validate(getViolationCountsQuerySchema),
  getViolationCountsHandler
);

// Bulk delete compliance cases (Executive only)
router.post(
  "/compliance/bulk-delete",
  authorizeFeature("compliance", "bulk_delete"),
  validate(bulkDeleteUuidSchema),
  bulkDeleteComplianceCasesHandler,
);

export default router;
