import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import {
  getEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  getEmployeeKPIs,
} from "../services/employee.service.js";
import {
  createUser,
  deleteUser,
  getUserById,
} from "../services/user.service.js";
import { getDepartmentById } from "../services/department.service.js";
import { getPositionById } from "../services/position.service.js";
import { hashPassword } from "../utils/hash.js";
import { createBankAccount } from "../services/bankAccount.service.js";
import { uploadToSpaces } from "../services/storage.service.js";
import { sendNewUserPasswordSetupEmail } from "../services/email.service.js";
import { logger } from "../utils/logger.js";

// Remove organization validation - all employees work for T3
// Access control will be based on user roles/permissions instead

export const getEmployeesHandler = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string | undefined;

    const offset = (page - 1) * limit;

    // All T3 employees - no organization filtering needed
    const result = await getEmployees(offset, limit, search);

    logger.info("Employees fetched successfully");
    return res.status(200).json({
      success: true,
      data: result.data,
      total: result.total,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.logApiError("Error fetching employees", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getEmployeeByIdHandler = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);

    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid employee ID provided",
      });
    }

    const employee = await getEmployeeById(id);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    logger.info("Employee fetched successfully");
    return res.status(200).json({
      success: true,
      data: employee,
    });
  } catch (error) {
    logger.logApiError("Error fetching employee details", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const createEmployeeHandler = async (req: Request, res: Response) => {
  let createdUser = null;
  let uploadedFileUrl: string | null = null;
  try {
    // Parse employee data - either from JSON body or from form-data field
    let employeeData: any;
    if (req.headers["content-type"]?.includes("application/json")) {
      // JSON request - data is in req.body
      employeeData = req.body;
    } else {
      // Multipart form-data - parse JSON from 'data' field
      if (req.body.data) {
        try {
          employeeData =
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
        employeeData = req.body;
      }
    }

    const {
      // User fields
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
      // Employee fields
      userId,
      employeeId,
      departmentId,
      positionId,
      reportsTo,
      startDate,
      // Bank account fields
      accountHolderName,
      bankName,
      accountNumber,
      routingNumber,
      accountType,
      branchName,
    } = employeeData;

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

    // Validate departmentId if provided
    if (departmentId !== undefined && departmentId !== null) {
      const department = await getDepartmentById(departmentId);
      if (!department) {
        return res.status(400).json({
          success: false,
          message: "Invalid department ID",
        });
      }
    }

    // Validate positionId if provided
    if (positionId !== undefined && positionId !== null) {
      const position = await getPositionById(positionId);
      if (!position) {
        return res.status(400).json({
          success: false,
          message: "Invalid position ID",
        });
      }
    }

    // Validate reportsTo (user ID) if provided
    if (reportsTo !== undefined && reportsTo !== null) {
      const manager = await getUserById(reportsTo);
      if (!manager) {
        return res.status(400).json({
          success: false,
          message: "Invalid reportsTo user ID",
        });
      }
    }

    // Create user if userId is not provided (new user)
    if (!userId) {
      if (!fullName || !email) {
        return res.status(400).json({
          success: false,
          message: "fullName and email are required when creating a new user",
        });
      }

      // Hash default password for all new users
      const defaultPassword = "TempPass2025!ChangeMe";
      const passwordHash = await hashPassword(defaultPassword);

      // Create user
      createdUser = await createUser({
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
    } else {
      // Validate existing user
      const existingUser = await getUserById(userId);
      if (!existingUser) {
        return res.status(400).json({
          success: false,
          message: "Invalid userId provided",
        });
      }
    }

    const finalUserId = userId || createdUser!.id;

    // Create employee
    let employee;
    try {
      employee = await createEmployee({
        userId: finalUserId,
        employeeId,
        departmentId,
        positionId,
        reportsTo,
        startDate: startDate ? new Date(startDate) : new Date(),
      });
    } catch (employeeError: any) {
      // Rollback user creation if employee creation fails
      if (createdUser) {
        try {
          await deleteUser(createdUser.id);
        } catch (cleanupError) {
          logger.logApiError("Failed to cleanup user", cleanupError, req);
        }
      }
      throw employeeError;
    }

    // Create bank account if provided
    if (accountHolderName && bankName && accountNumber && accountType) {
      try {
        await createBankAccount({
          userId: finalUserId,
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
            logger.logApiError("Failed to cleanup user", cleanupError, req);
          }
        }
        throw bankAccountError;
      }
    }

    // Send password setup email if new user was created
    if (createdUser) {
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
        logger.logApiError(
          "Failed to send password setup email",
          emailError,
          req
        );
        // Note: We don't fail employee creation if email fails
      }
    }

    logger.info("Employee created successfully");
    return res.status(201).json({
      success: true,
      data: employee,
      message: "Employee created successfully",
    });
  } catch (error: any) {
    logger.logApiError("Error creating employee", error, req);

    // Cleanup if user was created
    if (createdUser && error.code !== "23503") {
      try {
        await deleteUser(createdUser.id);
      } catch (cleanupError) {
        logger.logApiError("Failed to cleanup user", cleanupError, req);
      }
    }

    if (error.code === "23505") {
      // PostgreSQL unique constraint violation
      return res.status(409).json({
        success: false,
        message: "Email or employee ID already exists",
      });
    }
    if (error.code === "23503") {
      // Foreign key constraint violation
      return res.status(400).json({
        success: false,
        message: "Invalid department, position, or reportsTo reference",
      });
    }
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const updateEmployeeHandler = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);

    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid employee ID provided",
      });
    }

    const { userId, employeeId, departmentId, positionId, reportsTo } =
      req.body;

    const employee = await updateEmployee(id, {
      userId,
      employeeId,
      departmentId,
      positionId,
      reportsTo,
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    logger.info("Employee updated successfully");
    return res.status(200).json({
      success: true,
      data: employee,
      message: "Employee updated successfully",
    });
  } catch (error: any) {
    logger.logApiError("Error updating employee", error, req);
    if (error.code === "23505") {
      // PostgreSQL unique constraint violation
      return res.status(409).json({
        success: false,
        message: "Employee ID already exists",
      });
    }
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const deleteEmployeeHandler = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);

    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid employee ID provided",
      });
    }

    const employee = await deleteEmployee(id);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    logger.info("Employee deleted successfully");
    return res.status(200).json({
      success: true,
      message: "Employee deleted successfully",
    });
  } catch (error) {
    logger.logApiError("Error deleting employee", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getEmployeeKPIsHandler = async (req: Request, res: Response) => {
  try {
    const kpis = await getEmployeeKPIs();

    logger.info("Employee KPIs fetched successfully");
    return res.status(200).json({
      success: true,
      data: kpis,
    });
  } catch (error) {
    logger.logApiError("Error fetching employee KPIs", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
