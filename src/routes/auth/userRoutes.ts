import { Router } from "express";
import {
  getUsersHandler,
  getUserByIdHandler,
  createUserHandler,
  updateUserHandler,
  deleteUserHandler,
} from "../../controllers/UserControler.js";
import { authenticate } from "../../middleware/auth.js";

const router = Router();

// Apply authentication middleware to all user routes
router.use(authenticate);

router.route("/users").get(getUsersHandler).post(createUserHandler);
router
  .route("/users/:id")
  .get(getUserByIdHandler)
  .put(updateUserHandler)
  .delete(deleteUserHandler);

export default router;
