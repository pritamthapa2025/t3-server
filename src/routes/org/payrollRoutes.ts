import { Router } from "express";
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
} from "../../controllers/PayrollController.js";
import { authenticate } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
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

const router = Router();

// Payroll KPIs Routes
router
  .route("/kpis")
  .get(
    authenticate,
    validate(getPayrollDashboardQuerySchema),
    getPayrollDashboardHandler
  );

// Payroll Entry Routes
router
  .route("/entries")
  .get(
    authenticate,
    validate(getPayrollEntriesQuerySchema),
    getPayrollEntriesHandler
  )
  .post(
    authenticate,
    validate(createPayrollEntrySchema),
    createPayrollEntryHandler
  );

router
  .route("/entries/:id")
  .get(
    authenticate,
    validate(getPayrollEntryByIdSchema),
    getPayrollEntryByIdHandler
  )
  .put(
    authenticate,
    validate(updatePayrollEntrySchema),
    updatePayrollEntryHandler
  )
  .delete(
    authenticate,
    validate(deletePayrollEntrySchema),
    deletePayrollEntryHandler
  );

router
  .route("/entries/:id/approve")
  .post(
    authenticate,
    validate(approvePayrollEntrySchema),
    approvePayrollEntryHandler
  );

router
  .route("/entries/:id/reject")
  .post(
    authenticate,
    validate(rejectPayrollEntrySchema),
    rejectPayrollEntryHandler
  );

// Payroll Run Routes
router
  .route("/runs")
  .get(authenticate, validate(getPayrollRunsQuerySchema), getPayrollRunsHandler)
  .post(
    authenticate,
    validate(createPayrollRunSchema),
    createPayrollRunHandler
  );

router
  .route("/runs/:id")
  .get(
    authenticate,
    validate(getPayrollRunByIdSchema),
    getPayrollRunByIdHandler
  );

router
  .route("/runs/:id/process")
  .post(
    authenticate,
    validate(processPayrollRunSchema),
    processPayrollRunHandler
  );

export default router;
