import { Router } from "express";
import {
  getEmployeesHandler,
  createEmployeeHandler,
  getEmployeeByIdHandler,
  updateEmployeeHandler,
  deleteEmployeeHandler,
} from "../../controllers/EmployeeController.js";
import { authenticate } from "../../middleware/auth.js";

const router = Router();

// Apply authentication middleware to all employee routes
router.use(authenticate);

router
  .route("/employees")
  .get(getEmployeesHandler)
  .post(createEmployeeHandler);
router
  .route("/employees/:id")
  .get(getEmployeeByIdHandler)
  .put(updateEmployeeHandler)
  .delete(deleteEmployeeHandler);

export default router;

