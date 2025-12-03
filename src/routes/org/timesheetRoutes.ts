import { Router } from "express";
import {
  getTimesheetsHandler,
  createTimesheetHandler,
  getTimesheetByIdHandler,
  updateTimesheetHandler,
  deleteTimesheetHandler,
} from "../../controllers/TimesheetController.js";
import { authenticate } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  getTimesheetsQuerySchema,
  getTimesheetByIdSchema,
  createTimesheetSchema,
  updateTimesheetSchema,
  deleteTimesheetSchema,
} from "../../validations/timesheet.validations.js";

const router = Router();

// Apply authentication middleware to all timesheet routes
router.use(authenticate);

router
  .route("/timesheets")
  .get(validate(getTimesheetsQuerySchema), getTimesheetsHandler)
  .post(validate(createTimesheetSchema), createTimesheetHandler);
router
  .route("/timesheets/:id")
  .get(validate(getTimesheetByIdSchema), getTimesheetByIdHandler)
  .put(validate(updateTimesheetSchema), updateTimesheetHandler)
  .delete(validate(deleteTimesheetSchema), deleteTimesheetHandler);

export default router;
