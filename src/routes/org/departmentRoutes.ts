import { Router } from "express";
import {
  getDepartmentsHandler,
  createDepartmentHandler,
  getDepartmentByIdHandler,
  updateDepartmentHandler,
  deleteDepartmentHandler,
  getDepartmentKPIsHandler,
  getDepartmentsListHandler,
} from "../../controllers/DepartmentController.js";
import { authenticate } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { generalTransformer } from "../../middleware/response-transformer.js";
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

// Apply timezone transformation to all GET responses
router.use(generalTransformer);

router.route("/department/kpis").get(getDepartmentKPIsHandler);
router.route("/department/list").get(getDepartmentsListHandler);

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
