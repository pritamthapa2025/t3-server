import type { Request, Response } from "express";
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
} from "../services/user.service.js";
import { hashPassword } from "../utils/hash.js";
import { uploadToSpaces } from "../services/storage.service.js";
import { logger } from "../utils/logger.js";

export const getUsersHandler = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string | undefined;

    const offset = (page - 1) * limit;

    const users = await getUsers(offset, limit, search);

    logger.info("Users fetched successfully");
    return res.status(200).json({
      success: true,
      data: users.data,
      total: users.total,
      pagination: users.pagination,
    });
  } catch (error) {
    logger.logApiError("Error fetching users", error, req);
    return res.status(500).send("Internal server error");
  }
};

export const getUserByIdHandler = async (req: Request, res: Response) => {
  try {
    const user = await getUserById(req.params.id as string);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    logger.info("User fetched successfully");
    return res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    logger.logApiError("Error fetching user by ID", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const createUserHandler = async (req: Request, res: Response) => {
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
          return res.status(400).json({
            success: false,
            message: "Invalid JSON in 'data' field",
          });
        }
      } else {
        // Fallback: use req.body directly
        userData = req.body;
      }
    }

    const {
      fullName,
      email,
      phone,
      address,
      city,
      state,
      zipCode,
      dateOfBirth,
      emergencyContactName,
      emergencyContactPhone,
    } = userData;

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
        logger.logApiError("File upload error", uploadError, req);
        return res.status(500).json({
          success: false,
          message: "Failed to upload profile picture. Please try again.",
        });
      }
    }

    // Hash default password for all new users
    const defaultPassword = "TempPass2025!ChangeMe";
    const passwordHash = await hashPassword(defaultPassword);

    // Create user
    const createdUser = await createUser({
      fullName,
      email,
      passwordHash,
      phone,
      address,
      city,
      state,
      zipCode,
      dateOfBirth,
      emergencyContactName,
      emergencyContactPhone,
      ...(uploadedFileUrl && { profilePicture: uploadedFileUrl }),
    });

    if (!createdUser) {
      return res.status(500).json({
        success: false,
        message: "Failed to create user",
      });
    }

    logger.info("User created successfully");
    return res.status(201).json({
      success: true,
      message: "User created successfully",
      data: createdUser,
    });
  } catch (error: any) {
    logger.logApiError("Error creating user", error, req);

    if (error.code === "23505") {
      // PostgreSQL unique constraint violation
      return res.status(409).json({
        success: false,
        message: "Email already exists",
      });
    }
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const updateUserHandler = async (req: Request, res: Response) => {
  let uploadedFileUrl: string | null = null;
  try {
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
        logger.logApiError("File upload error", uploadError, req);
        return res.status(500).json({
          success: false,
          message: "Failed to upload profile picture. Please try again.",
        });
      }
    }

    const {
      fullName,
      email,
      phone,
      address,
      city,
      state,
      zipCode,
      dateOfBirth,
      emergencyContactName,
      emergencyContactPhone,
      isActive,
      isVerified,
    } = req.body;

    const user = await updateUser(req.params.id as string, {
      fullName,
      email,
      phone,
      address,
      city,
      state,
      zipCode,
      dateOfBirth,
      emergencyContactName,
      emergencyContactPhone,
      ...(uploadedFileUrl && { profilePicture: uploadedFileUrl }),
      isActive,
      isVerified,
    });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    logger.info("User updated successfully");
    return res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error: any) {
    logger.logApiError("Error updating user", error, req);
    if (error.code === "23505") {
      // PostgreSQL unique constraint violation
      return res.status(409).json({
        success: false,
        message: "Email already exists",
      });
    }
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const deleteUserHandler = async (req: Request, res: Response) => {
  try {
    const user = await deleteUser(req.params.id as string);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    logger.info("User deleted successfully");
    return res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    logger.logApiError("Error deleting user", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
