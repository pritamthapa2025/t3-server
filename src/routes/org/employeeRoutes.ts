import { Router } from "express";
import {
  getEmployeesHandler,
  createEmployeeHandler,
  getEmployeeByIdHandler,
  updateEmployeeHandler,
  deleteEmployeeHandler,
} from "../../controllers/EmployeeController.js";

const router = Router();

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

