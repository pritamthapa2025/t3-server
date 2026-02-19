import { Router, type IRouter } from "express";
import {
  getPositionsHandler,
  createPositionHandler,
  getPositionByIdHandler,
  updatePositionHandler,
  deletePositionHandler,
  getPositionsByDepartmentHandler,
} from "../../controllers/PositionController.js";
import { authenticate } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  getPositionsQuerySchema,
  getPositionByIdSchema,
  createPositionSchema,
  updatePositionSchema,
  deletePositionSchema,
} from "../../validations/position.validations.js";

const router: IRouter = Router();

// Apply authentication middleware to all position routes
router.use(authenticate);


router
  .route("/position")
  .get(validate(getPositionsQuerySchema), getPositionsHandler)
  .post(validate(createPositionSchema), createPositionHandler);
router.route("/position/list").get(getPositionsByDepartmentHandler);
router
  .route("/position/:id")
  .get(validate(getPositionByIdSchema), getPositionByIdHandler)
  .put(validate(updatePositionSchema), updatePositionHandler)
  .delete(validate(deletePositionSchema), deletePositionHandler);

export default router;
