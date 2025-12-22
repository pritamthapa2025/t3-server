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

// Authentication will be applied per route instead of globally to avoid conflicts

// GET /roles - Get all roles with pagination and filtering
router
  .route("/roles")
  .get(authenticate, validate(getRolesQuerySchema), getRolesHandler)
  .post(authenticate, validate(createRoleSchema), createRoleHandler);

// GET /roles/count - Get roles count
router.route("/roles/count").get(authenticate, getRolesCountHandler);

// GET /roles/check-name - Check if role name exists
router
  .route("/roles/check-name")
  .get(authenticate, validate(checkRoleNameSchema), checkRoleNameHandler);

// GET /roles/:id - Get role by ID
// PUT /roles/:id - Update role
// DELETE /roles/:id - Delete role (soft delete)
router
  .route("/roles/:id")
  .get(authenticate, validate(getRoleByIdSchema), getRoleByIdHandler)
  .put(authenticate, validate(updateRoleSchema), updateRoleHandler)
  .delete(authenticate, validate(deleteRoleSchema), deleteRoleHandler);

export default router;
