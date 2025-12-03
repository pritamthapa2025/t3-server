import { Router } from "express";
import {
  getDepartmentsHandler,
  createDepartmentHandler,
  getDepartmentByIdHandler,
  updateDepartmentHandler,
  deleteDepartmentHandler,
} from "../../controllers/DepartmentController.js";
import { authenticate } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  getDepartmentsQuerySchema,
  getDepartmentByIdSchema,
  createDepartmentSchema,
  updateDepartmentSchema,
  deleteDepartmentSchema,
} from "../../validations/department.validations.js";

const router = Router();

// Apply authentication middleware to all department routes
router.use(authenticate);

router
  .route("/department")
  .get(validate(getDepartmentsQuerySchema), getDepartmentsHandler)
  .post(validate(createDepartmentSchema), createDepartmentHandler);
router
  .route("/department/:id")
  .get(validate(getDepartmentByIdSchema), getDepartmentByIdHandler)
  .put(validate(updateDepartmentSchema), updateDepartmentHandler)
  .delete(validate(deleteDepartmentSchema), deleteDepartmentHandler);

export default router;
