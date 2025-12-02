import { Router } from "express";
import {
  getDepartmentsHandler,
  createDepartmentHandler,
  getDepartmentByIdHandler,
  updateDepartmentHandler,
  deleteDepartmentHandler,
} from "../../controllers/DepartmentController.js";
import { authenticate } from "../../middleware/auth.js";

const router = Router();

// Apply authentication middleware to all department routes
router.use(authenticate);

router
  .route("/department")
  .get(getDepartmentsHandler)
  .post(createDepartmentHandler);
router
  .route("/department/:id")
  .get(getDepartmentByIdHandler)
  .put(updateDepartmentHandler)
  .delete(deleteDepartmentHandler);

export default router;
