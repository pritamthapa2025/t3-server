import { Router } from "express";
import {
  getDepartmentsHandler,
  createDepartmentHandler,
  getDepartmentByIdHandler,
  updateDepartmentHandler,
  deleteDepartmentHandler,
} from "../../controllers/DepartmentController.js";

const router = Router();

router
  .route("/departments")
  .get(getDepartmentsHandler)
  .post(createDepartmentHandler);
router
  .route("/departments/:id")
  .get(getDepartmentByIdHandler)
  .put(updateDepartmentHandler)
  .delete(deleteDepartmentHandler);

export default router;
