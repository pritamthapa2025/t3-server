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
import { validate } from "../../middleware/validate.js";
import {
  loginSchema,
  verify2FASchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
  changePasswordSchema,
  resend2FASchema,
} from "../../validations/auth.validations.js";

const router = Router();

// Public routes (no authentication required)
router.route("/login").post(validate(loginSchema), loginUserHandler);
router
  .route("/request-password-reset")
  .post(validate(requestPasswordResetSchema), requestPasswordResetHandler);
router
  .route("/reset-password")
  .post(validate(resetPasswordSchema), resetPasswordHandler);
router.route("/verify-2fa").post(validate(verify2FASchema), verify2FAHandler);
router.route("/resend-2fa").post(validate(resend2FASchema), resend2FAHandler);

// Protected route (authentication required)
router
  .route("/change-password")
  .post(authenticate, validate(changePasswordSchema), changePasswordHandler);

export default router;
