import { Router } from "express";
import {
  getPositionsHandler,
  createPositionHandler,
  getPositionByIdHandler,
  updatePositionHandler,
  deletePositionHandler,
} from "../../controllers/PositionController.js";
import { authenticate } from "../../middleware/auth.js";

const router = Router();

// Apply authentication middleware to all position routes
router.use(authenticate);

router.route("/position").get(getPositionsHandler).post(createPositionHandler);
router
  .route("/position/:id")
  .get(getPositionByIdHandler)
  .put(updatePositionHandler)
  .delete(deletePositionHandler);

export default router;
