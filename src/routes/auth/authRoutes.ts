import { Router } from "express";
import {
  changePasswordHandler,
  loginUserHandler,
  requestPasswordResetHandler,
  resend2FAHandler,
  resetPasswordHandler,
  verify2FAHandler,
} from "../../controllers/AuthController.js";

const router = Router();

router.route("/login").post(loginUserHandler);
router.route("/request-password-reset").post(requestPasswordResetHandler);
router.route("/reset-password").post(resetPasswordHandler);
router.route("/change-password").post(changePasswordHandler);
router.route("/verify-2fa").post(verify2FAHandler);
router.route("/resend-2fa").post(resend2FAHandler);

export default router;
