import { Router, type IRouter } from "express";
import {
  getDepartmentsHandler,
  createDepartmentHandler,
  getDepartmentByIdHandler,
  updateDepartmentHandler,
  deleteDepartmentHandler,
  getDepartmentKPIsHandler,
  getDepartmentsListHandler,
  bulkDeleteDepartmentsHandler,
} from "../../controllers/DepartmentController.js";
import { getUsersByRolesHandler } from "../../controllers/UserControler.js";
import { authenticate } from "../../middleware/auth.js";
import { authorizeFeature } from "../../middleware/featureAuthorize.js";
import { validate } from "../../middleware/validate.js";
import { generalTransformer } from "../../middleware/response-transformer.js";
import { bulkDeleteIntSchema } from "../../validations/bulk-delete.validations.js";
import {
  getDepartmentsQuerySchema,
  getDepartmentByIdSchema,
  createDepartmentSchema,
  updateDepartmentSchema,
  deleteDepartmentSchema,
} from "../../validations/department.validations.js";
import { getUsersByRolesSchema } from "../../validations/user.validations.js";

const router: IRouter = Router();

// Apply authentication middleware to all department routes
router.use(authenticate);

// Apply timezone transformation to all GET responses
router.use(generalTransformer);

router.route("/department/kpis").get(getDepartmentKPIsHandler);
router.route("/department/list").get(getDepartmentsListHandler);
router
  .route("/department/leads")
  .get(validate(getUsersByRolesSchema), getUsersByRolesHandler);

router
  .route("/department")
  .get(validate(getDepartmentsQuerySchema), getDepartmentsHandler)
  .post(validate(createDepartmentSchema), createDepartmentHandler);
router
  .route("/department/:id")
  .get(validate(getDepartmentByIdSchema), getDepartmentByIdHandler)
  .put(validate(updateDepartmentSchema), updateDepartmentHandler)
  .delete(validate(deleteDepartmentSchema), deleteDepartmentHandler);

// Bulk delete departments (Executive only)
router.post(
  "/departments/bulk-delete",
  authorizeFeature("departments", "bulk_delete"),
  validate(bulkDeleteIntSchema),
  bulkDeleteDepartmentsHandler,
);

export default router;
