import { Router, type IRouter } from "express";
import {
  getPayrollDashboardHandler,
  getPayrollEntriesHandler,
  getPayrollEntryByIdHandler,
  createPayrollEntryHandler,
  updatePayrollEntryHandler,
  deletePayrollEntryHandler,
  approvePayrollEntryHandler,
  rejectPayrollEntryHandler,
  getPayrollRunsHandler,
  getPayrollRunByIdHandler,
  createPayrollRunHandler,
  processPayrollRunHandler,
  bulkDeletePayrollRunsHandler,
} from "../../controllers/PayrollController.js";
import { authenticate } from "../../middleware/auth.js";
import { authorizeFeature, requireAnyRole } from "../../middleware/featureAuthorize.js";
import { validate } from "../../middleware/validate.js";
import { bulkDeleteUuidSchema } from "../../validations/bulk-delete.validations.js";
import {
  getPayrollDashboardQuerySchema,
  getPayrollEntriesQuerySchema,
  getPayrollEntryByIdSchema,
  createPayrollEntrySchema,
  updatePayrollEntrySchema,
  deletePayrollEntrySchema,
  approvePayrollEntrySchema,
  rejectPayrollEntrySchema,
  getPayrollRunsQuerySchema,
  getPayrollRunByIdSchema,
  createPayrollRunSchema,
  processPayrollRunSchema,
} from "../../validations/payroll.validations.js";

const router: IRouter = Router();

// All payroll routes are restricted to Manager/Executive — financial/payroll data is sensitive
const managerOrAbove = requireAnyRole("Executive", "Manager");
router.use(authenticate, managerOrAbove);

// Payroll KPIs Routes
router
  .route("/kpis")
  .get(
    validate(getPayrollDashboardQuerySchema),
    getPayrollDashboardHandler
  );

// Payroll Entry Routes
router
  .route("/entries")
  .get(
    validate(getPayrollEntriesQuerySchema),
    getPayrollEntriesHandler
  )
  .post(
    validate(createPayrollEntrySchema),
    createPayrollEntryHandler
  );

router
  .route("/entries/:id")
  .get(
    validate(getPayrollEntryByIdSchema),
    getPayrollEntryByIdHandler
  )
  .put(
    validate(updatePayrollEntrySchema),
    updatePayrollEntryHandler
  )
  .delete(
    validate(deletePayrollEntrySchema),
    deletePayrollEntryHandler
  );

router
  .route("/entries/:id/approve")
  .post(
    validate(approvePayrollEntrySchema),
    approvePayrollEntryHandler
  );

router
  .route("/entries/:id/reject")
  .post(
    validate(rejectPayrollEntrySchema),
    rejectPayrollEntryHandler
  );

// Payroll Run Routes
router
  .route("/runs")
  .get(validate(getPayrollRunsQuerySchema), getPayrollRunsHandler)
  .post(
    validate(createPayrollRunSchema),
    createPayrollRunHandler
  );

router
  .route("/runs/:id")
  .get(
    validate(getPayrollRunByIdSchema),
    getPayrollRunByIdHandler
  );

router
  .route("/runs/:id/process")
  .post(
    validate(processPayrollRunSchema),
    processPayrollRunHandler
  );

// Bulk delete payroll runs (Executive only)
router.post(
  "/payroll/runs/bulk-delete",
  authorizeFeature("payroll", "bulk_delete"),
  validate(bulkDeleteUuidSchema),
  bulkDeletePayrollRunsHandler,
);

export default router;
