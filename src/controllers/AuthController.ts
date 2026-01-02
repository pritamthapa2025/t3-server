import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { comparePassword, hashPassword } from "../utils/hash.js";
import { generateToken, verifyToken } from "../utils/jwt.js";
import { db } from "../config/db.js";
import { userRoles, roles, users } from "../drizzle/schema/auth.schema.js";
import { employees } from "../drizzle/schema/org.schema.js";

import {
  generate2FACode,
  store2FACode,
  verify2FACode,
  delete2FACode,
} from "../utils/twoFactor.js";
import {
  generateDeviceToken,
  storeTrustedDevice,
  validateDeviceToken,
  getUserTrustedDevices,
  revokeTrustedDevice,
  revokeAllUserDevices,
} from "../utils/trusted-device.js";
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
import { ErrorMessages, handleDatabaseError } from "../utils/error-messages.js";
import {
  parseDatabaseError,
  isDatabaseError,
} from "../utils/database-error-parser.js";

export const loginUserHandler = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = await getUserByEmail(email);
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: ErrorMessages.invalidCredentials() });
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      return res
        .status(401)
        .json({ success: false, message: ErrorMessages.invalidCredentials() });
    }

    // Check for trusted device token
    const deviceToken = req.cookies?.device_token;
    logger.info("Device token check", { 
      hasDeviceToken: !!deviceToken, 
      userId: user.id,
      cookieKeys: Object.keys(req.cookies || {}),
      deviceTokenLength: deviceToken?.length,
      requestOrigin: req.headers.origin,
      requestHost: req.headers.host,
      cookieHeader: req.headers.cookie,
      userAgent: req.headers['user-agent']
    });
    
    if (deviceToken) {
      const trustedUserId = await validateDeviceToken(deviceToken);
      logger.info("Device token validation result", { 
        trustedUserId, 
        userIdMatch: trustedUserId === user.id,
        expectedUserId: user.id 
      });
      
      if (trustedUserId === user.id) {
        // Device is trusted, skip 2FA and login directly

        // Fetch user's role
        const [userRole] = await db
          .select({
            roleName: roles.name,
          })
          .from(userRoles)
          .innerJoin(roles, eq(userRoles.roleId, roles.id))
          .where(eq(userRoles.userId, user.id))
          .limit(1);

        // Fetch employee data if user is an employee
        const [employeeData] = await db
          .select({
            id: employees.id,
            employeeId: employees.employeeId,
          })
          .from(employees)
          .where(eq(employees.userId, user.id))
          .limit(1);

        const token = generateToken(user.id);

        logger.info("Login successful via trusted device", { userId: user.id });
        return res.status(200).json({
          success: true,
          message: "Login successful",
          requiresVerification: false,
          data: {
            token,
            user: {
              id: user.id,
              name: user.fullName,
              email: user.email,
              role: userRole?.roleName || null,
              ...(employeeData && {
                employeeTableId: employeeData.id,
                employeeId: employeeData.employeeId,
              }),
            },
            trustedDevice: true,
          },
        });
      } else {
        // Invalid or expired device token, clear the cookie
        res.clearCookie("device_token");
      }
    }

    // No trusted device or invalid token, proceed with 2FA
    const code = generate2FACode();
    await store2FACode(email, code);

    // send to user via email (fire and forget - don't wait for it)
    send2FACode(email, code).catch((err) => {
      logger.logApiError("Failed to send 2FA email", err, req);
    });

    // Return response immediately without waiting for email
    logger.info("2FA code sent to email");
    return res.status(200).json({
      success: true,
      message: "2FA code sent to email",
      requiresVerification: true,
    });
  } catch (err: any) {
    logger.logApiError("Login error", err, req);
    return res.status(500).json({
      success: false,
      message:
        "Unable to process login request. Please try again or contact support.",
    });
  }
};

export const verify2FAHandler = async (req: Request, res: Response) => {
  try {
    const { email, code, rememberDevice } = req.body;

    // Ensure code is a string and trim any whitespace
    const codeString = String(code).trim();

    // Validate code format before verification
    if (!/^\d{6}$/.test(codeString)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid 2FA code format. Please enter a 6-digit code containing only numbers.",
      });
    }

    const valid = await verify2FACode(email, codeString);
    if (!valid) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid or expired 2FA code. Please request a new code if needed.",
      });
    }

    const user = await getUserByEmail(email);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: ErrorMessages.notFound("User"),
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

    // Fetch employee data if user is an employee
    const [employeeData] = await db
      .select({
        id: employees.id,
        employeeId: employees.employeeId,
      })
      .from(employees)
      .where(eq(employees.userId, user.id))
      .limit(1);

    const token = generateToken(user.id);

    // Handle "Remember Device" functionality
    let deviceTokenSet = false;
    if (rememberDevice === true || rememberDevice === "true") {
      try {
        const deviceToken = generateDeviceToken();
        const trustedDevice = await storeTrustedDevice(
          user.id,
          deviceToken,
          req,
          30
        ); // 30 days

        // Set secure httpOnly cookie with device token
        const cookieOptions = {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax" as const, // Recommended for same-site applications
          maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days in milliseconds
          path: "/", // Explicitly set path to root
        };
        
        res.cookie("device_token", deviceToken, cookieOptions);

        deviceTokenSet = true;
        logger.info("Device token set for user", {
          userId: user.id,
          deviceId: trustedDevice?.id,
          deviceTokenLength: deviceToken.length,
          cookieOptions,
          nodeEnv: process.env.NODE_ENV,
          requestOrigin: req.headers.origin,
          requestHost: req.headers.host
        });
      } catch (deviceError) {
        logger.logApiError("Failed to set device token", deviceError, req);
        // Continue with login even if device token fails
      }
    }

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
          ...(employeeData && {
            employeeTableId: employeeData.id,
            employeeId: employeeData.employeeId,
          }),
        },
        deviceRemembered: deviceTokenSet,
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

    // Fetch employee data if user is an employee
    const [employeeData] = await db
      .select({
        id: employees.id,
        employeeId: employees.employeeId,
      })
      .from(employees)
      .where(eq(employees.userId, user.id))
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
        ...(employeeData && {
          employeeTableId: employeeData.id,
          employeeId: employeeData.employeeId,
        }),
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

// ============= TRUSTED DEVICE MANAGEMENT =============

export const getTrustedDevicesHandler = async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const devices = await getUserTrustedDevices(req.user.id);

    logger.info("Retrieved trusted devices for user", { userId: req.user.id });
    return res.status(200).json({
      success: true,
      message: "Trusted devices retrieved successfully",
      data: devices,
    });
  } catch (err: any) {
    logger.logApiError("Get trusted devices error", err, req);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve trusted devices",
    });
  }
};

export const revokeTrustedDeviceHandler = async (
  req: Request,
  res: Response
) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { deviceId } = req.params;

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: "Device ID is required",
      });
    }

    const success = await revokeTrustedDevice(req.user.id, deviceId);

    if (!success) {
      return res.status(404).json({
        success: false,
        message: "Trusted device not found or already revoked",
      });
    }

    logger.info("Trusted device revoked", { userId: req.user.id, deviceId });
    return res.status(200).json({
      success: true,
      message: "Trusted device revoked successfully",
    });
  } catch (err: any) {
    logger.logApiError("Revoke trusted device error", err, req);
    return res.status(500).json({
      success: false,
      message: "Failed to revoke trusted device",
    });
  }
};

export const revokeAllTrustedDevicesHandler = async (
  req: Request,
  res: Response
) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const revokedCount = await revokeAllUserDevices(req.user.id);

    // Clear the current device cookie as well
    res.clearCookie("device_token");

    logger.info("All trusted devices revoked", {
      userId: req.user.id,
      count: revokedCount,
    });
    return res.status(200).json({
      success: true,
      message: `Successfully revoked ${revokedCount} trusted devices`,
      data: { revokedCount },
    });
  } catch (err: any) {
    logger.logApiError("Revoke all trusted devices error", err, req);
    return res.status(500).json({
      success: false,
      message: "Failed to revoke trusted devices",
    });
  }
};

export const logoutHandler = async (req: Request, res: Response) => {
  try {
    // Clear the device token cookie on logout
    res.clearCookie("device_token");

    logger.info("User logged out successfully");
    return res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (err: any) {
    logger.logApiError("Logout error", err, req);
    return res.status(500).json({
      success: false,
      message: "Failed to logout",
    });
  }
};

// Debug endpoint to check cookies
export const debugCookiesHandler = async (req: Request, res: Response) => {
  try {
    logger.info("Debug cookies endpoint called", {
      cookieKeys: Object.keys(req.cookies || {}),
      cookies: req.cookies,
      cookieHeader: req.headers.cookie,
      requestOrigin: req.headers.origin,
      requestHost: req.headers.host,
      userAgent: req.headers['user-agent']
    });

    return res.status(200).json({
      success: true,
      message: "Cookie debug info",
      data: {
        cookieKeys: Object.keys(req.cookies || {}),
        cookies: req.cookies || {},
        cookieHeader: req.headers.cookie || null,
        requestOrigin: req.headers.origin || null,
        requestHost: req.headers.host || null,
      }
    });
  } catch (err: any) {
    logger.logApiError("Debug cookies error", err, req);
    return res.status(500).json({
      success: false,
      message: "Failed to debug cookies",
    });
  }
};
