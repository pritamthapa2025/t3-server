import { Router } from "express";
import {
  getEmployeesHandler,
  createEmployeeHandler,
  getEmployeeByIdHandler,
  updateEmployeeHandler,
  deleteEmployeeHandler,
} from "../../controllers/EmployeeController.js";
import { authenticate } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  getEmployeesQuerySchema,
  getEmployeeByIdSchema,
  createEmployeeSchema,
  updateEmployeeSchema,
  deleteEmployeeSchema,
} from "../../validations/employee.validations.js";

const router = Router();

// Apply authentication middleware to all employee routes
router.use(authenticate);

router
  .route("/employees")
  .get(validate(getEmployeesQuerySchema), getEmployeesHandler)
  .post(validate(createEmployeeSchema), createEmployeeHandler);
router
  .route("/employees/:id")
  .get(validate(getEmployeeByIdSchema), getEmployeeByIdHandler)
  .put(validate(updateEmployeeSchema), updateEmployeeHandler)
  .delete(validate(deleteEmployeeSchema), deleteEmployeeHandler);

export default router;
