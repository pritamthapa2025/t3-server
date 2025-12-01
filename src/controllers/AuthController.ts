import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { comparePassword, hashPassword } from "../utils/hash.js";
import { generateToken, verifyToken } from "../utils/jwt.js";

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
  updatePassword,
} from "../services/auth.service.js";

export const loginUserHandler = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Email and password are required" });
    }

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

  if (!email) {
    return res
      .status(400)
      .json({ success: false, message: "Email is required" });
  }

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

  if (!token || !oldPassword || !newPassword) {
    return res
      .status(400)
      .json({ success: false, message: "All fields are required" });
  }

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

  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      message: "Current and new passwords are required",
    });
  }

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
    if (!email || !code) {
      return res
        .status(400)
        .json({ success: false, message: "Email and code are required" });
    }

    const valid = await verify2FACode(email, code);
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

    const token = generateToken(user.id);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: { token },
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

  if (!email) {
    return res
      .status(400)
      .json({ success: false, message: "Email is required" });
  }

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
