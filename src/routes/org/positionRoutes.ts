import { Router, type IRouter } from "express";
import {
  getPositionsHandler,
  createPositionHandler,
  getPositionByIdHandler,
  updatePositionHandler,
  deletePositionHandler,
  getPositionsByDepartmentHandler,
  getPositionsGroupedHandler,
} from "../../controllers/PositionController.js";
import { authenticate } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  getPositionsQuerySchema,
  getPositionByIdSchema,
  createPositionSchema,
  updatePositionSchema,
  deletePositionSchema,
  getPositionsGroupedSchema,
} from "../../validations/position.validations.js";

const router: IRouter = Router();

// Apply authentication middleware to all position routes
router.use(authenticate);

router
  .route("/position")
  .get(validate(getPositionsQuerySchema), getPositionsHandler)
  .post(validate(createPositionSchema), createPositionHandler);

// ⚠️  Static routes MUST be registered before /:id to avoid "grouped" being parsed as an ID
router.route("/position/grouped").get(validate(getPositionsGroupedSchema), getPositionsGroupedHandler);
router.route("/position/list").get(getPositionsByDepartmentHandler);

router
  .route("/position/:id")
  .get(validate(getPositionByIdSchema), getPositionByIdHandler)
  .put(validate(updatePositionSchema), updatePositionHandler)
  .delete(validate(deletePositionSchema), deletePositionHandler);

export default router;
