import { Router } from "express";
import {
  changePasswordHandler,
  loginUserHandler,
  requestPasswordResetHandler,
  resend2FAHandler,
  resetPasswordHandler,
  verify2FAHandler,
} from "../../controllers/AuthController.js";
import { authenticate } from "../../middleware/auth.js";

const router = Router();

// Public routes (no authentication required)
router.route("/login").post(loginUserHandler);
router.route("/request-password-reset").post(requestPasswordResetHandler);
router.route("/reset-password").post(resetPasswordHandler);
router.route("/verify-2fa").post(verify2FAHandler);
router.route("/resend-2fa").post(resend2FAHandler);

// Protected route (authentication required)
router.route("/change-password").post(authenticate, changePasswordHandler);

export default router;
