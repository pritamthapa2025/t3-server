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
} from "../services/email.service.js";
import {
  getUserByEmail,
  getUserById,
  getUserByIdForProfile,
  updatePassword,
} from "../services/auth.service.js";

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
      console.error("Failed to send 2FA email:", err.message);
    });

    // Return response immediately without waiting for email
    return res
      .status(200)
      .json({ success: true, message: "2FA code sent to email" });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Login failed" });
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

    // Generate a password reset token (JWT)
    const resetToken = jwt.sign(
      { email: user.email },
      process.env.JWT_SECRET || "",
      { expiresIn: "1h" } // Token expires in 1 hour
    );

    // Send the password reset email with the token
    await sendPasswordResetEmail(user.email, resetToken);

    return res
      .status(200)
      .json({ success: true, message: "Password reset link sent" });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to send reset email" });
  }
};

export const resetPasswordHandler = async (req: Request, res: Response) => {
  const { token, oldPassword, newPassword } = req.body;

  try {
    // Verify the reset token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "") as {
      email: string;
    };
    const email = decoded.email; // Extract email from token

    // Find user by email
    const user = await getUserByEmail(email);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Check if the old password is correct (if required)
    const isOldPasswordValid = await comparePassword(
      oldPassword,
      user.passwordHash
    );
    if (!isOldPasswordValid) {
      return res
        .status(401)
        .json({ success: false, message: "Old password is incorrect" });
    }

    // Hash the new password
    const hashedPassword = await hashPassword(newPassword);

    // Update the password in the database
    await updatePassword(user.id, hashedPassword);

    // Optionally, invalidate the token here (e.g., store it in a blacklist, remove it from DB, etc.)

    return res
      .status(200)
      .json({ success: true, message: "Password updated successfully" });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to reset password" });
  }
};

export const changePasswordHandler = async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;

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

    // Compare the current password with the stored password hash
    const isCurrentPasswordValid = await comparePassword(
      currentPassword,
      user.passwordHash
    );
    if (!isCurrentPasswordValid) {
      return res
        .status(401)
        .json({ success: false, message: "Current password is incorrect" });
    }

    // Hash the new password
    const hashedPassword = await hashPassword(newPassword);

    // Update the password in the database
    await updatePassword(userId, hashedPassword);

    return res
      .status(200)
      .json({ success: true, message: "Password updated successfully" });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ success: false, message: "Password change failed" });
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
    console.error(err);
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
      console.error("Failed to send 2FA email:", err.message);
    });

    return res
      .status(200)
      .json({ success: true, message: "2FA code resent to email" });
  } catch (err) {
    console.error(err);
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
    console.error("Get current user error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to retrieve user data" });
  }
};
