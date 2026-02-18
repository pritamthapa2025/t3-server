import { Router, type IRouter } from "express";
import {
  getTimesheetsHandler,
  createTimesheetHandler,
  getTimesheetByIdHandler,
  updateTimesheetHandler,
  deleteTimesheetHandler,
  clockInHandler,
  clockOutHandler,
  approveTimesheetHandler,
  rejectTimesheetHandler,
  getWeeklyTimesheetsByEmployeeHandler,
  getMyTimesheetsHandler,
  createTimesheetWithClockDataHandler,
  getTimesheetKPIsHandler,
  bulkDeleteTimesheetsHandler,
} from "../../controllers/TimesheetController.js";
import { authenticate } from "../../middleware/auth.js";
import {
  authorizeFeature,
  authorizeAnyFeature,
} from "../../middleware/featureAuthorize.js";
import { validate } from "../../middleware/validate.js";
import { timesheetTransformer } from "../../middleware/response-transformer.js";
import {
  getTimesheetsQuerySchema,
  getTimesheetByIdSchema,
  createTimesheetSchema,
  updateTimesheetSchema,
  deleteTimesheetSchema,
  clockInSchema,
  clockOutSchema,
  approveTimesheetSchema,
  rejectTimesheetSchema,
  getWeeklyTimesheetsByEmployeeQuerySchema,
  getMyTimesheetsQuerySchema,
  createTimesheetWithClockDataSchema,
  getTimesheetKPIsQuerySchema,
} from "../../validations/timesheet.validations.js";
import { bulkDeleteIntSchema } from "../../validations/bulk-delete.validations.js";

const router: IRouter = Router();

// Apply authentication middleware to all timesheet routes
router.use(authenticate);

// Apply timezone transformation to all GET responses
router.use(timesheetTransformer);

// All roles can view their own timesheets and create/submit entries
const viewOwn = authorizeFeature("timesheet", "view_own_timesheets");
const createEntry = authorizeFeature("timesheet", "create_timesheet_entry");
const editOwn = authorizeFeature("timesheet", "edit_own_timesheets");
const deleteOwn = authorizeFeature("timesheet", "delete_own_timesheets");
// Manager/Executive only
const viewOthers = authorizeFeature("timesheet", "view_others_timesheets");
const approveTimesheets = authorizeFeature("timesheet", "approve_timesheets");
const rejectTimesheets = authorizeFeature("timesheet", "reject_timesheets");
// KPIs include labor costs — Manager/Executive
const viewLaborCosts = authorizeFeature("timesheet", "view_labor_costs");

// All roles see their own timesheets; Managers/Executives also see all
router
  .route("/timesheets")
  .get(
    authorizeAnyFeature("timesheet", [
      "view_own_timesheets",
      "view_others_timesheets",
    ]),
    validate(getTimesheetsQuerySchema),
    getTimesheetsHandler,
  )
  .post(createEntry, validate(createTimesheetSchema), createTimesheetHandler);

// All roles can view their own timesheets
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
  .get(
    viewLaborCosts,
    validate(getTimesheetKPIsQuerySchema),
    getTimesheetKPIsHandler,
  );

// All roles can clock in/out
router
  .route("/timesheets/clock-in")
  .post(createEntry, validate(clockInSchema), clockInHandler);
router
  .route("/timesheets/clock-out")
  .post(createEntry, validate(clockOutSchema), clockOutHandler);

router
  .route("/timesheets/clock")
  .post(
    createEntry,
    validate(createTimesheetWithClockDataSchema),
    createTimesheetWithClockDataHandler,
  );

// Approve/Reject — Manager/Executive only
router
  .route("/timesheets/:id/approve")
  .post(
    approveTimesheets,
    validate(approveTimesheetSchema),
    approveTimesheetHandler,
  );
router
  .route("/timesheets/:id/reject")
  .post(
    rejectTimesheets,
    validate(rejectTimesheetSchema),
    rejectTimesheetHandler,
  );

// All roles can view, edit and delete own timesheets
router
  .route("/timesheets/:id")
  .get(
    authorizeAnyFeature("timesheet", [
      "view_own_timesheets",
      "view_others_timesheets",
    ]),
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

export default router;
