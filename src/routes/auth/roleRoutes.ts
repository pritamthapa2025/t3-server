import { Router } from "express";
import {
  getRolesHandler,
  getRoleByIdHandler,
  createRoleHandler,
  updateRoleHandler,
  deleteRoleHandler,
  checkRoleNameHandler,
  getRolesCountHandler,
} from "../../controllers/RoleController.js";
import { authenticate } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  getRolesQuerySchema,
  getRoleByIdSchema,
  createRoleSchema,
  updateRoleSchema,
  deleteRoleSchema,
  checkRoleNameSchema,
} from "../../validations/role.validations.js";

const router = Router();

// All role routes require authentication
router.use(authenticate);

// GET /roles - Get all roles with pagination and filtering
router
  .route("/roles")
  .get(validate(getRolesQuerySchema), getRolesHandler)
  .post(validate(createRoleSchema), createRoleHandler);

// GET /roles/count - Get roles count
router.route("/roles/count").get(getRolesCountHandler);

// GET /roles/check-name - Check if role name exists
router
  .route("/roles/check-name")
  .get(validate(checkRoleNameSchema), checkRoleNameHandler);

// GET /roles/:id - Get role by ID
// PUT /roles/:id - Update role
// DELETE /roles/:id - Delete role (soft delete)
router
  .route("/roles/:id")
  .get(validate(getRoleByIdSchema), getRoleByIdHandler)
  .put(validate(updateRoleSchema), updateRoleHandler)
  .delete(validate(deleteRoleSchema), deleteRoleHandler);

export default router;
