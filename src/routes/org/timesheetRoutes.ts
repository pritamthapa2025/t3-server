import { Router } from "express";
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
} from "../../controllers/TimesheetController.js";
import { authenticate } from "../../middleware/auth.js";
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
} from "../../validations/timesheet.validations.js";

const router = Router();

// Apply authentication middleware to all timesheet routes
router.use(authenticate);

// Apply timezone transformation to all GET responses
router.use(timesheetTransformer);

router
  .route("/timesheets")
  .get(validate(getTimesheetsQuerySchema), getTimesheetsHandler)
  .post(validate(createTimesheetSchema), createTimesheetHandler);

router
  .route("/timesheets/my-timesheets")
  .get(validate(getMyTimesheetsQuerySchema), getMyTimesheetsHandler);

router
  .route("/timesheets/weekly")
  .get(
    validate(getWeeklyTimesheetsByEmployeeQuerySchema),
    getWeeklyTimesheetsByEmployeeHandler
  );

router
  .route("/timesheets/clock-in")
  .post(validate(clockInSchema), clockInHandler);
router
  .route("/timesheets/clock-out")
  .post(validate(clockOutSchema), clockOutHandler);

router
  .route("/timesheets/:id/approve")
  .post(validate(approveTimesheetSchema), approveTimesheetHandler);
router
  .route("/timesheets/:id/reject")
  .post(validate(rejectTimesheetSchema), rejectTimesheetHandler);

router
  .route("/timesheets/:id")
  .get(validate(getTimesheetByIdSchema), getTimesheetByIdHandler)
  .put(validate(updateTimesheetSchema), updateTimesheetHandler)
  .delete(validate(deleteTimesheetSchema), deleteTimesheetHandler);

export default router;
