import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
} from "../services/user.service.js";
import { createEmployee } from "../services/employee.service.js";
import { getDepartmentById } from "../services/department.service.js";
import { getPositionById } from "../services/position.service.js";
import { hashPassword } from "../utils/hash.js";
import { createBankAccount } from "../services/bankAccount.service.js";
import { uploadToSpaces } from "../services/storage.service.js";
import { sendNewUserPasswordSetupEmail } from "../services/email.service.js";

export const getUsersHandler = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const offset = (page - 1) * limit;

    const users = await getUsers(offset, limit);

    return res.status(200).send({ data: users.data, total: users.total });
  } catch (error) {
    console.error(error);
    return res.status(500).send("Internal server error");
  }
};

export const getUserByIdHandler = async (req: Request, res: Response) => {
  try {
    const user = await getUserById(req.params.id as string);
    if (!user) {
      return res.status(404).send("User not found");
    }

    return res.status(200).send(user);
  } catch (error) {
    console.error(error);
    return res.status(500).send("Internal server error");
  }
};

export const createUserHandler = async (req: Request, res: Response) => {
  let createdUser = null;
  let uploadedFileUrl: string | null = null;
  try {
    // Parse user data - either from JSON body or from form-data field
    let userData: any;
    if (req.headers["content-type"]?.includes("application/json")) {
      // JSON request - data is in req.body
      userData = req.body;
    } else {
      // Multipart form-data - parse JSON from 'data' field
      if (req.body.data) {
        try {
          userData =
            typeof req.body.data === "string"
              ? JSON.parse(req.body.data)
              : req.body.data;
        } catch (parseError) {
          return res.status(400).send("Invalid JSON in 'data' field");
        }
      } else {
        // Fallback: use req.body directly (for backward compatibility)
        userData = req.body;
      }
    }

    const {
      fullName,
      email,
      phone,
      departmentId,
      positionId,
      reportsTo,
      startDate,
      accountHolderName,
      bankName,
      accountNumber,
      routingNumber,
      accountType,
      branchName,
    } = userData;

    // Note: For JSON requests, validation is handled by Zod middleware
    // For form-data requests, validation happens here after parsing req.body.data
    // TODO: Consider moving form-data parsing to middleware for consistent validation

    // Handle file upload if provided
    const file = req.file;
    if (file) {
      try {
        const uploadResult = await uploadToSpaces(
          file.buffer,
          file.originalname,
          "profile-pictures"
        );
        uploadedFileUrl = uploadResult.url;
      } catch (uploadError: any) {
        console.error("File upload error:", uploadError);
        return res
          .status(500)
          .send("Failed to upload profile picture. Please try again.");
      }
    }

    // Validate departmentId if provided
    if (departmentId !== undefined && departmentId !== null) {
      const department = await getDepartmentById(departmentId);
      if (!department) {
        return res.status(400).send("Invalid department ID");
      }
    }

    // Validate positionId if provided
    if (positionId !== undefined && positionId !== null) {
      const position = await getPositionById(positionId);
      if (!position) {
        return res.status(400).send("Invalid position ID");
      }
    }

    // Validate reportsTo (user ID) if provided
    if (reportsTo !== undefined && reportsTo !== null) {
      const manager = await getUserById(reportsTo);
      if (!manager) {
        return res.status(400).send("Invalid reportsTo user ID");
      }
    }

    // Hash default password for all new users
    const defaultPassword = "TempPass2025!ChangeMe";
    const passwordHash = await hashPassword(defaultPassword);

    // Create user with default password (user can change it later)
    createdUser = await createUser({
      fullName,
      email,
      passwordHash,
      phone,
      ...(uploadedFileUrl && { profilePicture: uploadedFileUrl }),
    });

    if (!createdUser) {
      return res.status(500).send("Failed to create user");
    }

    // Create employee - if this fails, we'll rollback by deleting the user
    try {
      await createEmployee({
        userId: createdUser.id,
        departmentId,
        positionId,
        reportsTo,
        startDate: new Date(startDate),
      });
    } catch (employeeError: any) {
      if (createdUser) {
        await deleteUser(createdUser.id);
      }
      throw employeeError;
    }

    // Create bank account if provided
    if (accountHolderName && bankName && accountNumber && accountType) {
      try {
        await createBankAccount({
          userId: createdUser.id,
          accountHolderName,
          bankName,
          accountNumber,
          routingNumber,
          accountType,
          branchName,
          isPrimary: true, // Set as primary if it's the first account
        });
      } catch (bankAccountError: any) {
        // If bank account creation fails, clean up user and employee
        if (createdUser) {
          try {
            await deleteUser(createdUser.id);
          } catch (cleanupError) {
            console.error("Failed to cleanup user:", cleanupError);
          }
        }
        throw bankAccountError;
      }
    }

    // Generate secure token for password setup (valid for 24 hours)
    const setupToken = jwt.sign(
      {
        email: createdUser.email,
        purpose: "new-user-password-setup",
        userId: createdUser.id,
      },
      process.env.JWT_SECRET || "",
      { expiresIn: "24h" }
    );

    // Send password setup email to the new user
    try {
      await sendNewUserPasswordSetupEmail(
        createdUser.email,
        fullName,
        setupToken
      );
    } catch (emailError: any) {
      console.error("Failed to send password setup email:", emailError.message);
      // Note: We don't fail user creation if email fails - log and continue
      // The user can still use the default password to login if needed
    }

    return res.status(201).send("user created successfully");
  } catch (error: any) {
    console.error(error);

    // If user was created but employee creation failed, it's already deleted above
    // But if user creation itself failed, we need to handle it
    if (createdUser && error.code !== "23503") {
      // Try to clean up if there's still a user created
      try {
        await deleteUser(createdUser.id);
      } catch (cleanupError) {
        console.error("Failed to cleanup user:", cleanupError);
      }
    }

    if (error.code === "23505") {
      // PostgreSQL unique constraint violation
      return res.status(409).send("Email or employee ID already exists");
    }
    if (error.code === "23503") {
      // Foreign key constraint violation
      return res
        .status(400)
        .send("Invalid department, position, or reportsTo reference");
    }
    return res.status(500).send("Internal server error");
  }
};

export const updateUserHandler = async (req: Request, res: Response) => {
  try {
    const { fullName, email, phone, isActive, isVerified } = req.body;

    const user = await updateUser(req.params.id as string, {
      fullName,
      email,
      phone,
      isActive,
      isVerified,
    });
    if (!user) {
      return res.status(404).send("User not found");
    }

    return res.status(200).send(user);
  } catch (error: any) {
    console.error(error);
    if (error.code === "23505") {
      // PostgreSQL unique constraint violation
      return res.status(409).send("Email already exists");
    }
    return res.status(500).send("Internal server error");
  }
};

export const deleteUserHandler = async (req: Request, res: Response) => {
  try {
    const user = await deleteUser(req.params.id as string);
    if (!user) {
      return res.status(404).send("User not found");
    }

    return res.status(200).send("User deleted successfully");
  } catch (error) {
    console.error(error);
    return res.status(500).send("Internal server error");
  }
};
