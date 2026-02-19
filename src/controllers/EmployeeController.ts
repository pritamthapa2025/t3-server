import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import {
  getEmployees,
  getEmployeesSimple,
  getEmployeeById,
  getInspectors,
  getTechnicians,
  getUnassignedDrivers,
  getEmployeeKPIs,
  getEmployeeJobsAndDispatchForDate,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  bulkDeleteEmployees,
} from "../services/employee.service.js";
import {
  createUser,
  deleteUser,
  getUserById,
  updateUser,
} from "../services/user.service.js";
import { getDepartmentById } from "../services/department.service.js";
import { getPositionById } from "../services/position.service.js";
import { getRoleById, assignRoleToUser } from "../services/role.service.js";
import { hashPassword } from "../utils/hash.js";
import {
  createBankAccount,
  getPrimaryBankAccount,
  updateBankAccount,
} from "../services/bankAccount.service.js";
import { uploadToSpaces } from "../services/storage.service.js";
import { sendNewUserPasswordSetupEmail } from "../services/email.service.js";
import { logger } from "../utils/logger.js";
import {
  checkEmailExists,
  validateUniqueFields,
  buildConflictResponse,
} from "../utils/validation-helpers.js";
import {
  parseDatabaseError,
  isDatabaseError,
} from "../utils/database-error-parser.js";

// Remove organization validation - all employees work for T3
// Access control will be based on user roles/permissions instead

export const getEmployeesHandler = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string | undefined;
    const status = req.query.status as string | undefined;
    const departmentId = req.query.departmentId
      ? parseInt(req.query.departmentId as string, 10)
      : undefined;
    const offset = (page - 1) * limit;

    const result = await getEmployees(offset, limit, {
      ...(search !== undefined && { search }),
      ...(status !== undefined && { status }),
      ...(departmentId !== undefined && { departmentId }),
    });

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

export const getEmployeesSimpleHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const search = req.query.search as string | undefined;
    const positionId = req.query.positionId
      ? parseInt(req.query.positionId as string, 10)
      : undefined;
    const roleId = req.query.roleId
      ? parseInt(req.query.roleId as string, 10)
      : undefined;
    // Get simplified employee list with filters (no pagination)
    const employees = await getEmployeesSimple(search, positionId, roleId);

    logger.info("Employees (simple) fetched successfully");
    return res.status(200).json({
      success: true,
      data: employees,
    });
  } catch (error) {
    logger.logApiError("Error fetching employees (simple)", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getInspectorsHandler = async (req: Request, res: Response) => {
  try {
    const data = await getInspectors();
    logger.info("Inspectors (Executive/Manager) fetched successfully");
    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    logger.logApiError("Error fetching inspectors", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getTechniciansHandler = async (req: Request, res: Response) => {
  try {
    const data = await getTechnicians();
    logger.info("Technicians fetched successfully");
    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    logger.logApiError("Error fetching technicians", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getUnassignedDriversHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const data = await getUnassignedDrivers();
    logger.info("Unassigned drivers fetched successfully");
    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    logger.logApiError("Error fetching unassigned drivers", error, req);
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

export const getEmployeeJobsAndDispatchHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const id = parseInt(req.params.id as string);
    const date = req.query.date as string;

    const result = await getEmployeeJobsAndDispatchForDate(id, date);

    logger.info("Employee jobs and dispatch fetched successfully");
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.logApiError(
      "Error fetching employee jobs and dispatch",
      error,
      req,
    );
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
        } catch {
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
      // Employee fields (employeeId is auto-generated - never read from body)
      userId,
      departmentId,
      positionId,
      reportsTo,
      startDate,
      roleId,
      // Bank account fields
      accountHolderName,
      bankName,
      accountNumber,
      routingNumber,
      accountType,
      branchName,
    } = employeeData;

    // Pre-validate unique fields before attempting to create
    const uniqueFieldChecks = [];

    // Check email uniqueness (only if creating new user)
    if (!userId && email) {
      uniqueFieldChecks.push({
        field: "email",
        value: email,
        checkFunction: () => checkEmailExists(email),
        message: `An account with email '${email}' already exists`,
      });
    }

    // Validate all unique fields
    const validationErrors = await validateUniqueFields(uniqueFieldChecks);
    if (validationErrors.length > 0) {
      return res.status(409).json(buildConflictResponse(validationErrors));
    }

    // Handle file upload if provided
    const file = req.file;
    if (file) {
      try {
        const uploadResult = await uploadToSpaces(
          file.buffer,
          file.originalname,
          "profile-pictures",
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

    // Validate roleId if provided
    if (roleId !== undefined && roleId !== null) {
      const role = await getRoleById(roleId);
      if (!role) {
        return res.status(400).json({
          success: false,
          message: "Invalid role ID",
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

    // Assign role to user if roleId is provided
    if (roleId !== undefined && roleId !== null) {
      try {
        await assignRoleToUser(finalUserId, roleId);
      } catch (roleError: any) {
        // Rollback user creation if role assignment fails
        if (createdUser) {
          try {
            await deleteUser(createdUser.id);
          } catch (cleanupError) {
            logger.logApiError("Failed to cleanup user", cleanupError, req);
          }
        }
        logger.logApiError("Failed to assign role to user", roleError, req);
        return res.status(500).json({
          success: false,
          message: "Failed to assign role to user",
        });
      }
    }

    // Create employee
    let employee;
    try {
      employee = await createEmployee({
        userId: finalUserId,
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
        { expiresIn: "24h" },
      );

      // Send password setup email to the new user
      try {
        await sendNewUserPasswordSetupEmail(
          createdUser.email,
          fullName,
          setupToken,
        );
      } catch (emailError: any) {
        logger.logApiError(
          "Failed to send password setup email",
          emailError,
          req,
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

    // Use database error parser for consistent, human-readable error messages
    if (isDatabaseError(error)) {
      const parsedError = parseDatabaseError(error);

      return res.status(parsedError.statusCode).json({
        success: false,
        message: parsedError.userMessage,
        errorCode: parsedError.errorCode,
        suggestions: parsedError.suggestions,
        // Include technical details in development mode
        technicalDetails:
          process.env.NODE_ENV === "development"
            ? parsedError.technicalMessage
            : undefined,
      });
    }

    // Fallback for non-database errors
    const errorMessage = error.message?.includes("duplicate key")
      ? "A record with this information already exists"
      : "An unexpected error occurred while creating the employee";

    return res.status(500).json({
      success: false,
      message: errorMessage,
      detail:
        process.env.NODE_ENV === "development" ? error.message : undefined,
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

    const {
      // Employee fields (employeeId excluded as per user request)
      departmentId,
      positionId,
      reportsTo,
      roleId,
      status,
      startDate,
      endDate,
      note,
      // User fields
      fullName,
      email,
      phone,
      address,
      city,
      state,
      zipCode,
      // Bank account fields
      accountHolderName,
      bankName,
      accountNumber,
      routingNumber,
      accountType,
    } = req.body;

    // Get the employee to find the userId
    const existingEmployee = await getEmployeeById(id);
    if (!existingEmployee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // Get the user ID for updating user and bank account data
    const userId = existingEmployee.user?.id;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "Employee has no associated user account",
      });
    }

    // Pre-validate unique fields before attempting to update
    const uniqueFieldChecks = [];

    // Check email uniqueness (if provided and different from current)
    if (email && email !== existingEmployee.user?.email) {
      uniqueFieldChecks.push({
        field: "email",
        value: email,
        checkFunction: () => checkEmailExists(email, userId),
        message: `An account with email '${email}' already exists`,
      });
    }

    // Validate all unique fields
    const validationErrors = await validateUniqueFields(uniqueFieldChecks);
    if (validationErrors.length > 0) {
      return res.status(409).json(buildConflictResponse(validationErrors));
    }

    // Validate roleId if provided
    if (roleId !== undefined && roleId !== null) {
      const role = await getRoleById(roleId);
      if (!role) {
        return res.status(400).json({
          success: false,
          message: "Invalid role ID",
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

    // Update employee data
    const employeeUpdateData: any = {};
    if (departmentId !== undefined)
      employeeUpdateData.departmentId = departmentId;
    if (positionId !== undefined) employeeUpdateData.positionId = positionId;
    if (reportsTo !== undefined) employeeUpdateData.reportsTo = reportsTo;
    if (status !== undefined) employeeUpdateData.status = status;
    if (startDate !== undefined)
      employeeUpdateData.startDate = startDate ? new Date(startDate) : null;
    if (endDate !== undefined)
      employeeUpdateData.endDate = endDate ? new Date(endDate) : null;
    if (note !== undefined) employeeUpdateData.note = note;

    let employee = null;
    if (Object.keys(employeeUpdateData).length > 0) {
      employee = await updateEmployee(id, employeeUpdateData);
      if (!employee) {
        return res.status(404).json({
          success: false,
          message: "Employee not found",
        });
      }
    }

    // Update user data if any user fields are provided
    const userUpdateData: any = {};
    if (fullName !== undefined) userUpdateData.fullName = fullName;
    if (email !== undefined) userUpdateData.email = email;
    if (phone !== undefined) userUpdateData.phone = phone;
    if (address !== undefined) userUpdateData.address = address;
    if (city !== undefined) userUpdateData.city = city;
    if (state !== undefined) userUpdateData.state = state;
    if (zipCode !== undefined) userUpdateData.zipCode = zipCode;

    if (Object.keys(userUpdateData).length > 0) {
      try {
        await updateUser(userId, userUpdateData);
      } catch (userError: any) {
        logger.logApiError("Failed to update user", userError, req);
        return res.status(500).json({
          success: false,
          message: "Failed to update user information",
        });
      }
    }

    // Update bank account if any bank fields are provided
    const bankUpdateData: any = {};
    if (accountHolderName !== undefined)
      bankUpdateData.accountHolderName = accountHolderName;
    if (bankName !== undefined) bankUpdateData.bankName = bankName;
    if (accountNumber !== undefined)
      bankUpdateData.accountNumber = accountNumber;
    if (routingNumber !== undefined)
      bankUpdateData.routingNumber = routingNumber;
    if (accountType !== undefined) bankUpdateData.accountType = accountType;

    if (Object.keys(bankUpdateData).length > 0) {
      try {
        // Check if primary bank account exists
        const existingBankAccount = await getPrimaryBankAccount(userId);

        if (existingBankAccount) {
          // Update existing bank account
          await updateBankAccount(userId, bankUpdateData);
        } else {
          // Create new bank account if all required fields are provided
          if (accountHolderName && bankName && accountNumber && accountType) {
            await createBankAccount({
              userId,
              accountHolderName,
              bankName,
              accountNumber,
              routingNumber,
              accountType,
              isPrimary: true,
            });
          }
        }
      } catch (bankError: any) {
        logger.logApiError("Failed to update bank account", bankError, req);
        // Don't fail the entire update if only bank account update fails
      }
    }

    // Update role if roleId is provided
    if (roleId !== undefined && roleId !== null) {
      try {
        await assignRoleToUser(userId, roleId);
      } catch (roleError: any) {
        logger.logApiError("Failed to assign role to user", roleError, req);
        // Don't fail the entire update if only role assignment fails
      }
    }

    // Get updated employee data
    const updatedEmployee = await getEmployeeById(id);

    logger.info("Employee updated successfully");
    return res.status(200).json({
      success: true,
      data: updatedEmployee,
      message: "Employee updated successfully",
    });
  } catch (error: any) {
    logger.logApiError("Error updating employee", error, req);

    // Use database error parser for consistent, human-readable error messages
    if (isDatabaseError(error)) {
      const parsedError = parseDatabaseError(error);

      return res.status(parsedError.statusCode).json({
        success: false,
        message: parsedError.userMessage,
        errorCode: parsedError.errorCode,
        suggestions: parsedError.suggestions,
        technicalDetails:
          process.env.NODE_ENV === "development"
            ? parsedError.technicalMessage
            : undefined,
      });
    }

    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred while updating the employee",
      detail:
        process.env.NODE_ENV === "development" ? error.message : undefined,
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

    const userId = req.user?.id;
    const employee = await deleteEmployee(id, userId);
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
  } catch (error: any) {
    logger.logApiError("Error deleting employee", error, req);

    // Use database error parser for consistent, human-readable error messages
    if (isDatabaseError(error)) {
      const parsedError = parseDatabaseError(error);

      return res.status(parsedError.statusCode).json({
        success: false,
        message: parsedError.userMessage,
        errorCode: parsedError.errorCode,
        suggestions: parsedError.suggestions,
        // Include technical details in development mode
        technicalDetails:
          process.env.NODE_ENV === "development"
            ? parsedError.technicalMessage
            : undefined,
      });
    }

    // Fallback for non-database errors
    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred while deleting the employee",
      detail:
        process.env.NODE_ENV === "development" ? error.message : undefined,
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

// ===========================================================================
// Bulk Delete
// ===========================================================================

export const bulkDeleteEmployeesHandler = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId)
      return res.status(403).json({ success: false, message: "Authentication required" });

    const { ids } = req.body as { ids: number[] };
    const result = await bulkDeleteEmployees(ids, userId);

    logger.info(`Bulk deleted ${result.deleted} employees by ${userId}`);
    return res.status(200).json({
      success: true,
      message: `${result.deleted} employee(s) deleted. ${result.skipped} skipped (already deleted or not found).`,
      data: result,
    });
  } catch (error) {
    logger.logApiError("Bulk delete employees error", error, req);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
