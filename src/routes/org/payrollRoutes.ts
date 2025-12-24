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

// Dashboard Routes
router.get(
  "/dashboard",
  authenticate,
  validate(getPayrollDashboardQuerySchema),
  getPayrollDashboardHandler
);

// Payroll Entry Routes
router.get(
  "/entries",
  authenticate,
  validate(getPayrollEntriesQuerySchema),
  getPayrollEntriesHandler
);

router.get(
  "/entries/:id",
  authenticate,
  validate(getPayrollEntryByIdSchema),
  getPayrollEntryByIdHandler
);

router.post(
  "/entries",
  authenticate,
  validate(createPayrollEntrySchema),
  createPayrollEntryHandler
);

router.put(
  "/entries/:id",
  authenticate,
  validate(updatePayrollEntrySchema),
  updatePayrollEntryHandler
);

router.delete(
  "/entries/:id",
  authenticate,
  validate(deletePayrollEntrySchema),
  deletePayrollEntryHandler
);

router.post(
  "/entries/:id/approve",
  authenticate,
  validate(approvePayrollEntrySchema),
  approvePayrollEntryHandler
);

router.post(
  "/entries/:id/reject",
  authenticate,
  validate(rejectPayrollEntrySchema),
  rejectPayrollEntryHandler
);

// Payroll Run Routes
router.get(
  "/runs",
  authenticate,
  validate(getPayrollRunsQuerySchema),
  getPayrollRunsHandler
);

router.get(
  "/runs/:id",
  authenticate,
  validate(getPayrollRunByIdSchema),
  getPayrollRunByIdHandler
);

router.post(
  "/runs",
  authenticate,
  validate(createPayrollRunSchema),
  createPayrollRunHandler
);

router.post(
  "/runs/:id/process",
  authenticate,
  validate(processPayrollRunSchema),
  processPayrollRunHandler
);

export default router;








