import { Router } from "express";
import {
  changePasswordHandler,
  getCurrentUserHandler,
  loginUserHandler,
  requestChangePasswordHandler,
  requestPasswordResetHandler,
  resend2FAHandler,
  resendChangePasswordOTPHandler,
  resendPasswordResetOTPHandler,
  resetPasswordHandler,
  setupNewPasswordHandler,
  verify2FAHandler,
} from "../../controllers/AuthController.js";
import { authenticate } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  loginSchema,
  verify2FASchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
  requestChangePasswordSchema,
  changePasswordSchema,
  resend2FASchema,
  resendPasswordResetOTPSchema,
  resendChangePasswordOTPSchema,
  setupNewPasswordSchema,
} from "../../validations/auth.validations.js";

const router = Router();

// Public routes (no authentication required)
router.route("/login").post(validate(loginSchema), loginUserHandler);
router.route("/verify-2fa").post(validate(verify2FASchema), verify2FAHandler);
router.route("/resend-2fa").post(validate(resend2FASchema), resend2FAHandler);

router
  .route("/request-password-reset")
  .post(validate(requestPasswordResetSchema), requestPasswordResetHandler);
router
  .route("/reset-password")
  .post(validate(resetPasswordSchema), resetPasswordHandler);

router
  .route("/resend-password-reset-otp")
  .post(validate(resendPasswordResetOTPSchema), resendPasswordResetOTPHandler);

router
  .route("/setup-new-password")
  .post(validate(setupNewPasswordSchema), setupNewPasswordHandler);

// Protected routes (authentication required)
router
  .route("/request-change-password")
  .post(
    authenticate,
    validate(requestChangePasswordSchema),
    requestChangePasswordHandler
  );

router
  .route("/change-password")
  .post(authenticate, validate(changePasswordSchema), changePasswordHandler);

router
  .route("/resend-change-password-otp")
  .post(
    authenticate,
    validate(resendChangePasswordOTPSchema),
    resendChangePasswordOTPHandler
  );

router.route("/me").get(authenticate, getCurrentUserHandler);

export default router;
