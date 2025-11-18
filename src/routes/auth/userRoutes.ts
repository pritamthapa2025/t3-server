import { Router } from "express";
import {
  getUsersHandler,
  getUserByIdHandler,
  createUserHandler,
  updateUserHandler,
  deleteUserHandler,
} from "../../controllers/UserControler.js";

const router = Router();

router.route("/users").get(getUsersHandler).post(createUserHandler);
router
  .route("/users/:id")
  .get(getUserByIdHandler)
  .put(updateUserHandler)
  .delete(deleteUserHandler);

export default router;
