import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { comparePassword, hashPassword } from "../utils/hash.js";
import { generateToken, verifyToken } from "../utils/jwt.js";
import { db } from "../config/db.js";
import { userRoles, roles, users } from "../drizzle/schema/auth.schema.js";

import {
  generate2FACode,
  store2FACode,
  verify2FACode,
  delete2FACode,
} from "../utils/twoFactor.js";
import {
  send2FACode,
  sendPasswordResetEmail,
  sendPasswordResetOTP,
  sendChangePasswordOTP,
} from "../services/email.service.js";
import {
  getUserByEmail,
  getUserById,
  getUserByIdForProfile,
  updatePassword,
} from "../services/auth.service.js";
import { logger } from "../utils/logger.js";

export const loginUserHandler = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = await getUserByEmail(email);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    // generate and store 2FA code (encrypted in Redis)
    const code = generate2FACode();
    await store2FACode(email, code);

    // send to user via email (fire and forget - don't wait for it)
    send2FACode(email, code).catch((err) => {
      logger.logApiError("Failed to send 2FA email", err, req);
    });

    // Return response immediately without waiting for email
    logger.info("2FA code sent to email");
    return res
      .status(200)
      .json({ success: true, message: "2FA code sent to email" });
  } catch (err: any) {
    logger.logApiError("Login error", err, req);
    return res.status(500).json({ success: false, message: "Login failed" });
  }
};

export const verify2FAHandler = async (req: Request, res: Response) => {
  try {
    const { email, code } = req.body;

    // Ensure code is a string and trim any whitespace
    const codeString = String(code).trim();

    // Validate code format before verification
    if (!/^\d{6}$/.test(codeString)) {
      return res.status(400).json({
        success: false,
        message: "Invalid 2FA code format. Code must be exactly 6 digits",
      });
    }

    const valid = await verify2FACode(email, codeString);
    if (!valid) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid 2FA code" });
    }

    const user = await getUserByEmail(email);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Fetch user's role
    const [userRole] = await db
      .select({
        roleName: roles.name,
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, user.id))
      .limit(1);

    const token = generateToken(user.id);

    logger.info("2FA verification successful");
    return res.status(200).json({
      success: true,
      message: "Verification successful",
      data: {
        token,
        user: {
          id: user.id,
          name: user.fullName,
          email: user.email,
          role: userRole?.roleName || null,
        },
      },
    });
  } catch (err: any) {
    logger.logApiError("2FA verification error", err, req);
    return res
      .status(500)
      .json({ success: false, message: "2FA verification failed" });
  }
};

export const resend2FAHandler = async (req: Request, res: Response) => {
  const { email } = req.body;

  try {
    // Check if the user exists
    const user = await getUserByEmail(email);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Delete the old 2FA code to invalidate it
    await delete2FACode(email);

    // Generate a new 2FA code
    const code = generate2FACode();
    await store2FACode(email, code); // Store the new code in Redis with an expiry time

    // Send the 2FA code to the user's email
    send2FACode(email, code).catch((err) => {
      logger.logApiError("Failed to send 2FA email", err, req);
    });

    logger.info("2FA code resent to email");
    return res
      .status(200)
      .json({ success: true, message: "2FA code resent to email" });
  } catch (err) {
    logger.logApiError("Resend 2FA error", err, req);
    return res
      .status(500)
      .json({ success: false, message: "Failed to resend 2FA code" });
  }
};

export const getCurrentUserHandler = async (req: Request, res: Response) => {
  try {
    // User is already authenticated by middleware and attached to req.user
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    // Get full user data for profile
    const user = await getUserByIdForProfile(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Fetch user's role
    const [userRole] = await db
      .select({
        roleName: roles.name,
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, user.id))
      .limit(1);

    logger.info("Current user retrieved successfully");
    return res.status(200).json({
      success: true,
      message: "User retrieved successfully",
      data: {
        id: user.id,
        name: user.fullName,
        email: user.email,
        phone: user.phone || null,
        profilePicture: user.profilePicture || null,
        isActive: user.isActive,
        isVerified: user.isVerified,
        role: userRole?.roleName || null,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (err: any) {
    logger.logApiError("Get current user error", err, req);
    return res
      .status(500)
      .json({ success: false, message: "Failed to retrieve user data" });
  }
};

export const requestPasswordResetHandler = async (
  req: Request,
  res: Response
) => {
  const { email } = req.body;

  try {
    // Check if the user exists
    const user = await getUserByEmail(email);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Generate a password reset OTP
    const resetOTP = generate2FACode();

    // Store the OTP with email as key (same system as 2FA)
    await store2FACode(`reset_${email}`, resetOTP);

    // Send the password reset OTP via email
    await sendPasswordResetOTP(user.email, resetOTP);

    logger.info("Password reset OTP sent to email");
    return res.status(200).json({
      success: true,
      message: "Password reset OTP sent to your email",
    });
  } catch (err) {
    logger.logApiError("Request password reset error", err, req);
    return res
      .status(500)
      .json({ success: false, message: "Failed to send reset OTP" });
  }
};

export const verifyResetTokenHandler = async (req: Request, res: Response) => {
  const { email, otp } = req.body;

  try {
    // Ensure OTP is a string and trim any whitespace
    const otpString = String(otp).trim();

    // Validate OTP format before verification
    if (!/^\d{6}$/.test(otpString)) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP format. OTP must be exactly 6 digits",
      });
    }

    // Verify the reset OTP using the same key format as request
    const isValidOTP = await verify2FACode(`reset_${email}`, otpString);
    if (!isValidOTP) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired OTP" });
    }

    // Find user by email
    const user = await getUserByEmail(email);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Generate a short-lived verification token (10 minutes)
    const verificationToken = jwt.sign(
      {
        email: user.email,
        userId: user.id,
        purpose: "password-reset-token-verified",
      },
      process.env.JWT_SECRET || "",
      { expiresIn: "10m" }
    );

    // Delete the OTP since it's been verified (prevent reuse)
    await delete2FACode(`reset_${email}`);

    logger.info("Reset token verified successfully");
    return res.status(200).json({
      success: true,
      message: "Reset token verified successfully",
      data: {
        verificationToken,
      },
    });
  } catch (err) {
    logger.logApiError("Verify reset token error", err, req);
    return res
      .status(500)
      .json({ success: false, message: "Failed to verify reset token" });
  }
};

export const confirmPasswordResetHandler = async (
  req: Request,
  res: Response
) => {
  const { verificationToken, newPassword } = req.body;

  try {
    // Verify the verification token
    const decoded = jwt.verify(
      verificationToken,
      process.env.JWT_SECRET || ""
    ) as {
      email: string;
      purpose: string;
      userId: string;
    };

    // Validate token purpose
    if (decoded.purpose !== "password-reset-token-verified") {
      return res.status(400).json({
        success: false,
        message: "Invalid verification token purpose",
      });
    }

    // Find user by email from token
    const user = await getUserByEmail(decoded.email);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Verify user ID matches token
    if (user.id !== decoded.userId) {
      return res.status(400).json({
        success: false,
        message: "Invalid verification token",
      });
    }

    // Hash the new password
    const hashedPassword = await hashPassword(newPassword);

    // Update the password in the database
    await updatePassword(user.id, hashedPassword);

    logger.info("Password reset successfully");
    return res
      .status(200)
      .json({ success: true, message: "Password reset successfully" });
  } catch (err: any) {
    logger.logApiError("Confirm password reset error", err, req);

    // Handle JWT specific errors
    if (err.name === "TokenExpiredError") {
      return res.status(400).json({
        success: false,
        message:
          "Verification token has expired. Please verify your OTP again.",
      });
    }

    if (err.name === "JsonWebTokenError") {
      return res.status(400).json({
        success: false,
        message: "Invalid verification token.",
      });
    }

    return res
      .status(500)
      .json({ success: false, message: "Failed to reset password" });
  }
};

// Keep the original for backward compatibility if needed
export const resetPasswordHandler = async (req: Request, res: Response) => {
  const { email, otp, newPassword } = req.body;

  try {
    // Ensure OTP is a string and trim any whitespace
    const otpString = String(otp).trim();

    // Validate OTP format before verification
    if (!/^\d{6}$/.test(otpString)) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP format. OTP must be exactly 6 digits",
      });
    }

    // Verify the reset OTP using the same key format as request
    const isValidOTP = await verify2FACode(`reset_${email}`, otpString);
    if (!isValidOTP) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired OTP" });
    }

    // Find user by email
    const user = await getUserByEmail(email);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Hash the new password
    const hashedPassword = await hashPassword(newPassword);

    // Update the password in the database
    await updatePassword(user.id, hashedPassword);

    logger.info("Password reset successfully");
    return res
      .status(200)
      .json({ success: true, message: "Password reset successfully" });
  } catch (err) {
    logger.logApiError("Reset password error", err, req);
    return res
      .status(500)
      .json({ success: false, message: "Failed to reset password" });
  }
};

export const resendPasswordResetOTPHandler = async (
  req: Request,
  res: Response
) => {
  const { email } = req.body;

  try {
    // Check if the user exists
    const user = await getUserByEmail(email);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Delete the old password reset OTP to invalidate it
    await delete2FACode(`reset_${email}`);

    // Generate a new password reset OTP
    const resetOTP = generate2FACode();

    // Store the new OTP with the same key format
    await store2FACode(`reset_${email}`, resetOTP);

    // Send the new password reset OTP via email
    sendPasswordResetOTP(user.email, resetOTP).catch((err) => {
      logger.logApiError("Failed to send password reset OTP", err, req);
    });

    logger.info("New password reset OTP sent to email");
    return res.status(200).json({
      success: true,
      message: "New password reset OTP sent to your email",
    });
  } catch (err) {
    logger.logApiError("Resend password reset OTP error", err, req);
    return res
      .status(500)
      .json({ success: false, message: "Failed to resend password reset OTP" });
  }
};

export const requestChangePasswordHandler = async (
  req: Request,
  res: Response
) => {
  if (!req.user?.id) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  const userId = req.user.id;

  try {
    // Find the user from the database
    const user = await getUserById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Generate a password change OTP
    const changeOTP = generate2FACode();

    // Store the OTP with user email as key
    await store2FACode(`change_${user.email}`, changeOTP);

    // Send the password change OTP via email
    await sendChangePasswordOTP(user.email, changeOTP);

    logger.info("Password change OTP sent to email");
    return res.status(200).json({
      success: true,
      message: "Password change OTP sent to your email",
    });
  } catch (err) {
    logger.logApiError("Request change password error", err, req);
    return res
      .status(500)
      .json({ success: false, message: "Failed to send change password OTP" });
  }
};

export const changePasswordHandler = async (req: Request, res: Response) => {
  const { otp, newPassword } = req.body;

  if (!req.user?.id) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  const userId = req.user.id;

  try {
    // Find the user from the database
    const user = await getUserById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Ensure OTP is a string and trim any whitespace
    const otpString = String(otp).trim();

    // Validate OTP format before verification
    if (!/^\d{6}$/.test(otpString)) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP format. OTP must be exactly 6 digits",
      });
    }

    // Verify the change password OTP
    const isValidOTP = await verify2FACode(`change_${user.email}`, otpString);
    if (!isValidOTP) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired OTP" });
    }

    // Hash the new password
    const hashedPassword = await hashPassword(newPassword);

    // Update the password in the database
    await updatePassword(userId, hashedPassword);

    logger.info("Password changed successfully");
    return res
      .status(200)
      .json({ success: true, message: "Password changed successfully" });
  } catch (err) {
    logger.logApiError("Change password error", err, req);
    return res
      .status(500)
      .json({ success: false, message: "Password change failed" });
  }
};

export const resendChangePasswordOTPHandler = async (
  req: Request,
  res: Response
) => {
  if (!req.user?.id) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  const userId = req.user.id;

  try {
    // Find the user from the database
    const user = await getUserById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Delete the old change password OTP to invalidate it
    await delete2FACode(`change_${user.email}`);

    // Generate a new password change OTP
    const changeOTP = generate2FACode();

    // Store the new OTP with the same key format
    await store2FACode(`change_${user.email}`, changeOTP);

    // Send the new password change OTP via email
    sendChangePasswordOTP(user.email, changeOTP).catch((err) => {
      logger.logApiError("Failed to send password change OTP", err, req);
    });

    logger.info("New password change OTP sent to email");
    return res.status(200).json({
      success: true,
      message: "New password change OTP sent to your email",
    });
  } catch (err) {
    logger.logApiError("Resend change password OTP error", err, req);
    return res.status(500).json({
      success: false,
      message: "Failed to resend password change OTP",
    });
  }
};

export const setupNewPasswordHandler = async (req: Request, res: Response) => {
  const { token, newPassword } = req.body;

  try {
    // Verify the setup token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "") as {
      email: string;
      purpose: string;
      userId: string;
    };

    // Validate token purpose
    if (decoded.purpose !== "new-user-password-setup") {
      return res.status(400).json({
        success: false,
        message: "Invalid token purpose",
      });
    }

    // Find user by email from token
    const user = await getUserByEmail(decoded.email);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Verify user ID matches token
    if (user.id !== decoded.userId) {
      return res.status(400).json({
        success: false,
        message: "Invalid token",
      });
    }

    // Hash the new password
    const hashedPassword = await hashPassword(newPassword);

    // Update the password in the database
    await updatePassword(user.id, hashedPassword);

    logger.info("Password set up successfully");
    return res.status(200).json({
      success: true,
      message:
        "Password set up successfully. You can now login with your new password.",
    });
  } catch (err: any) {
    logger.logApiError("Setup new password error", err, req);

    // Handle JWT specific errors
    if (err.name === "TokenExpiredError") {
      return res.status(400).json({
        success: false,
        message:
          "Setup link has expired. Please contact support for a new link.",
      });
    }

    if (err.name === "JsonWebTokenError") {
      return res.status(400).json({
        success: false,
        message: "Invalid setup link.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to set up password",
    });
  }
};
