import { Router } from "express";
import {
  getPositionsHandler,
  createPositionHandler,
  getPositionByIdHandler,
  updatePositionHandler,
  deletePositionHandler,
} from "../../controllers/PositionController.js";

const router = Router();

router
  .route("/positions")
  .get(getPositionsHandler)
  .post(createPositionHandler);
router
  .route("/positions/:id")
  .get(getPositionByIdHandler)
  .put(updatePositionHandler)
  .delete(deletePositionHandler);

export default router;

