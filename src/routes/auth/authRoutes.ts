import { Router } from "express";
import { registerUserHandler } from "../../controllers/AuthController.js";

const router = Router();

router.route("/register").post(registerUserHandler);

// Auth routes will be added here

export default router;
