import { Router, type IRouter } from "express";
import {
  getTimesheetsHandler,
  createTimesheetHandler,
  getTimesheetByIdHandler,
  updateTimesheetHandler,
  deleteTimesheetHandler,
  approveTimesheetHandler,
  rejectTimesheetHandler,
  getWeeklyTimesheetsByEmployeeHandler,
  getMyTimesheetsHandler,
  getTimesheetKPIsHandler,
  bulkDeleteTimesheetsHandler,
  approveWeekHandler,
  rejectWeekHandler,
  confirmWeekHandler,
  logTimeHandler,
  updateTimesheetJobEntryHandler,
  getMyHistoryHandler,
  getCoverageEntriesForJobHandler,
} from "../../controllers/TimesheetController.js";
import { authenticate } from "../../middleware/auth.js";
import {
  authorizeFeature,
  authorizeAnyFeature,
} from "../../middleware/featureAuthorize.js";
import { validate } from "../../middleware/validate.js";
import {
  getTimesheetsQuerySchema,
  getTimesheetByIdSchema,
  createTimesheetSchema,
  updateTimesheetSchema,
  deleteTimesheetSchema,
  approveTimesheetSchema,
  rejectTimesheetSchema,
  getWeeklyTimesheetsByEmployeeQuerySchema,
  getMyTimesheetsQuerySchema,
  getTimesheetKPIsQuerySchema,
  weeklyApproveSchema,
  weeklyRejectSchema,
  weeklyConfirmSchema,
  logTimeSchema,
  updateJobEntryParamsSchema,
  updateJobEntryBodySchema,
  getMyHistoryQuerySchema,
} from "../../validations/timesheet.validations.js";
import { bulkDeleteIntSchema } from "../../validations/bulk-delete.validations.js";

const router: IRouter = Router();

// Apply authentication middleware to all timesheet routes
router.use(authenticate);

// Permission aliases
const viewOwn = authorizeFeature("timesheet", "view_own_timesheets");
const createEntry = authorizeFeature("timesheet", "create_timesheet_entry");
const editOwn = authorizeFeature("timesheet", "edit_own_timesheets");
const deleteOwn = authorizeFeature("timesheet", "delete_own_timesheets");
const viewOthers = authorizeFeature("timesheet", "view_others_timesheets");
const approveTimesheets = authorizeFeature("timesheet", "approve_timesheets");
const rejectTimesheets = authorizeFeature("timesheet", "reject_timesheets");
const viewLaborCosts = authorizeFeature("timesheet", "view_labor_costs");

// List / create timesheets
router
  .route("/timesheets")
  .get(
    authorizeAnyFeature("timesheet", ["view_own_timesheets", "view_others_timesheets"]),
    validate(getTimesheetsQuerySchema),
    getTimesheetsHandler,
  )
  .post(createEntry, validate(createTimesheetSchema), createTimesheetHandler);

// Technician views their own week
router
  .route("/timesheets/my-timesheets")
  .get(viewOwn, validate(getMyTimesheetsQuerySchema), getMyTimesheetsHandler);

// Managers/Executives view team weekly data
router
  .route("/timesheets/weekly")
  .get(
    viewOthers,
    validate(getWeeklyTimesheetsByEmployeeQuerySchema),
    getWeeklyTimesheetsByEmployeeHandler,
  );

// KPIs include labor cost data — Manager/Executive only
router
  .route("/timesheets/kpis")
  .get(viewLaborCosts, validate(getTimesheetKPIsQuerySchema), getTimesheetKPIsHandler);

// -------------------------------------------------------------------------
// Weekly bulk actions (new dispatch-driven model)
// -------------------------------------------------------------------------

// Manual / coverage time logging — techs log for self, managers supply employeeId
router
  .route("/timesheets/log-time")
  .post(createEntry, validate(logTimeSchema), logTimeHandler);

// Flat history of a tech's own time blocks (both manual and dispatch-sourced)
router
  .route("/timesheets/my-history")
  .get(viewOwn, validate(getMyHistoryQuerySchema), getMyHistoryHandler);

// Technician confirms their week (Monday morning, after receiving email snapshot)
router
  .route("/timesheets/weekly-confirm")
  .post(viewOwn, validate(weeklyConfirmSchema), confirmWeekHandler);

// Manager/Executive approves all days in a week for one employee
router
  .route("/timesheets/weekly-approve")
  .patch(approveTimesheets, validate(weeklyApproveSchema), approveWeekHandler);

// Manager/Executive rejects all days in a week for one employee
router
  .route("/timesheets/weekly-reject")
  .patch(rejectTimesheets, validate(weeklyRejectSchema), rejectWeekHandler);

// Approve/Reject single timesheet (kept for compatibility)
router
  .route("/timesheets/:id/approve")
  .post(approveTimesheets, validate(approveTimesheetSchema), approveTimesheetHandler);
router
  .route("/timesheets/:id/reject")
  .post(rejectTimesheets, validate(rejectTimesheetSchema), rejectTimesheetHandler);

// CRUD for a single timesheet record
router
  .route("/timesheets/:id")
  .get(
    authorizeAnyFeature("timesheet", ["view_own_timesheets", "view_others_timesheets"]),
    validate(getTimesheetByIdSchema),
    getTimesheetByIdHandler,
  )
  .put(editOwn, validate(updateTimesheetSchema), updateTimesheetHandler)
  .delete(deleteOwn, validate(deleteTimesheetSchema), deleteTimesheetHandler);

// Bulk delete timesheets (Executive only)
router.post(
  "/timesheets/bulk-delete",
  authorizeFeature("timesheet", "bulk_delete"),
  validate(bulkDeleteIntSchema),
  bulkDeleteTimesheetsHandler,
);

// Update a timesheetJobEntry (coverage / manual entry — owner only)
router.put(
  "/timesheets/job-entries/:entryId",
  authorizeFeature("timesheet", "edit_own_timesheets"),
  validate(updateJobEntryParamsSchema),
  validate(updateJobEntryBodySchema),
  updateTimesheetJobEntryHandler,
);

// Coverage entries for a job — all authenticated roles (no financial data, used for UI badges)
router.get(
  "/timesheets/jobs/:jobId/coverage-entries",
  authorizeAnyFeature("timesheet", ["view_own_timesheets", "view_others_timesheets"]),
  getCoverageEntriesForJobHandler,
);

export default router;
