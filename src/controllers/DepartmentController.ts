import type { Request, Response } from "express";
import {
  getDepartments,
  getDepartmentById,
  getDepartmentByName,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getDepartmentKPIs,
  getDepartmentsList,
} from "../services/department.service.js";
import { logger } from "../utils/logger.js";
import {
  checkDepartmentNameExists,
  validateUniqueFields,
  buildConflictResponse,
} from "../utils/validation-helpers.js";
import {
  parseDatabaseError,
  isDatabaseError,
} from "../utils/database-error-parser.js";

// Departments are T3 internal - no organization validation needed
// Access control is based on user roles/permissions

export const getDepartmentsHandler = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string | undefined;

    const offset = (page - 1) * limit;

    const departments = await getDepartments(offset, limit, search);

    logger.info("Departments fetched successfully");
    return res.status(200).json({
      success: true,
      data: departments.data,
      total: departments.total,
      pagination: departments.pagination,
    });
  } catch (error) {
    logger.logApiError("Error fetching departments", error, req);
    return res.status(500).send("Internal server error");
  }
};

export const getDepartmentByIdHandler = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);

    const department = await getDepartmentById(id);
    if (!department) {
      return res.status(404).json({
        success: false,
        message: "Department not found",
      });
    }

    logger.info("Department fetched successfully");
    return res.status(200).json({
      success: true,
      data: department,
    });
  } catch (error) {
    logger.logApiError("Error fetching department by ID", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const createDepartmentHandler = async (req: Request, res: Response) => {
  try {
    const {
      name,
      description,
      leadId,
      contactEmail,
      primaryLocation,
      shiftCoverage,
      utilization,
      isActive,
      sortOrder,
      positionPayBands,
    } = req.body;

    // Validate user access (departments are T3 internal, not organization-specific)
    const userId = req.user?.id;
    if (!userId) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Authentication required.",
      });
    }

    // Pre-validate unique fields before attempting to create
    const uniqueFieldChecks = [];

    // Check department name uniqueness
    if (name) {
      uniqueFieldChecks.push({
        field: "name",
        value: name,
        checkFunction: () => checkDepartmentNameExists(name),
        message: `A department with the name '${name}' already exists`,
      });
    }

    // Validate all unique fields
    const validationErrors = await validateUniqueFields(uniqueFieldChecks);
    if (validationErrors.length > 0) {
      return res.status(409).json(buildConflictResponse(validationErrors));
    }

    const department = await createDepartment({
      name,
      description,
      leadId,
      contactEmail,
      primaryLocation,
      shiftCoverage,
      utilization,
      isActive,
      sortOrder,
      positionPayBands,
    });
    logger.info("Department created successfully");
    return res.status(201).json({
      success: true,
      message: "Department created successfully",
      data: department,
    });
  } catch (error: any) {
    logger.logApiError("Error creating department", error, req);

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
      message: "An unexpected error occurred while creating the department",
      detail:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const updateDepartmentHandler = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const {
      name,
      description,
      leadId,
      contactEmail,
      primaryLocation,
      shiftCoverage,
      utilization,
      isActive,
      sortOrder,
      positionPayBands,
    } = req.body;

    // Check if department exists first
    const existingDepartment = await getDepartmentById(id);
    if (!existingDepartment) {
      return res.status(404).json({
        success: false,
        message: "Department not found",
      });
    }

    // Pre-validate unique fields before attempting to update
    const uniqueFieldChecks = [];

    // Check department name uniqueness (if provided and different from current)
    if (name && name !== existingDepartment.department.name) {
      uniqueFieldChecks.push({
        field: "name",
        value: name,
        checkFunction: () => checkDepartmentNameExists(name, id),
        message: `A department with the name '${name}' already exists`,
      });
    }

    // Validate all unique fields
    const validationErrors = await validateUniqueFields(uniqueFieldChecks);
    if (validationErrors.length > 0) {
      return res.status(409).json(buildConflictResponse(validationErrors));
    }

    const department = await updateDepartment(id, {
      name,
      description,
      leadId,
      contactEmail,
      primaryLocation,
      shiftCoverage,
      utilization,
      isActive,
      sortOrder,
      positionPayBands,
    });
    if (!department) {
      return res.status(404).json({
        success: false,
        message: "Department not found",
      });
    }

    logger.info("Department updated successfully");
    return res.status(200).json({
      success: true,
      message: "Department updated successfully",
      data: department,
    });
  } catch (error: any) {
    logger.logApiError("Error updating department", error, req);

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
      message: "An unexpected error occurred while updating the department",
      detail:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const deleteDepartmentHandler = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);

    const department = await deleteDepartment(id);
    if (!department) {
      return res.status(404).json({
        success: false,
        message: "Department not found",
      });
    }

    logger.info("Department deleted successfully");
    return res.status(200).json({
      success: true,
      message: "Department deleted successfully",
    });
  } catch (error) {
    logger.logApiError("Error deleting department", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getDepartmentsListHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const departments = await getDepartmentsList();

    logger.info("Departments list fetched successfully");
    return res.status(200).json({
      success: true,
      data: departments,
    });
  } catch (error) {
    logger.logApiError("Error fetching departments list", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getDepartmentKPIsHandler = async (req: Request, res: Response) => {
  try {
    const kpis = await getDepartmentKPIs();

    logger.info("Department KPIs fetched successfully");
    return res.status(200).json({
      success: true,
      data: kpis,
    });
  } catch (error) {
    logger.logApiError("Error fetching department KPIs", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
