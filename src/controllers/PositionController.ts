import type { Request, Response } from "express";
import {
  getPositions,
  getPositionById,
  createPosition,
  updatePosition,
  deletePosition,
  getPositionsByDepartment,
} from "../services/position.service.js";
import { logger } from "../utils/logger.js";
import {
  checkPositionNameExists,
  validateUniqueFields,
  buildConflictResponse,
} from "../utils/validation-helpers.js";
import { parseDatabaseError, isDatabaseError } from "../utils/database-error-parser.js";

export const getPositionsHandler = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string | undefined;

    const offset = (page - 1) * limit;

    const positions = await getPositions(offset, limit, search);

    logger.info("Positions fetched successfully");
    return res.status(200).json({
      success: true,
      data: positions.data,
      total: positions.total,
      pagination: positions.pagination,
    });
  } catch (error) {
    logger.logApiError("Error fetching positions", error, req);
    return res.status(500).send("Internal server error");
  }
};

export const getPositionByIdHandler = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);

    const position = await getPositionById(id);
    if (!position) {
      return res.status(404).send("Position not found");
    }

    logger.info("Position fetched successfully");
    return res.status(200).send(position);
  } catch (error) {
    logger.logApiError("Error fetching position by ID", error, req);
    return res.status(500).send("Internal server error");
  }
};

export const createPositionHandler = async (req: Request, res: Response) => {
  try {
    const {
      name,
      departmentId,
      description,
      payRate,
      payType,
      currency,
      notes,
      isActive,
      sortOrder,
    } = req.body;

    // Pre-validate unique fields before attempting to create
    const uniqueFieldChecks = [];

    // Check position name uniqueness within the same department
    if (name && departmentId) {
      uniqueFieldChecks.push({
        field: "name",
        value: name,
        checkFunction: () => checkPositionNameExists(name, departmentId),
        message: `A position with the name '${name}' already exists in this department`,
      });
    }

    // Validate all unique fields
    const validationErrors = await validateUniqueFields(uniqueFieldChecks);
    if (validationErrors.length > 0) {
      return res.status(409).json(buildConflictResponse(validationErrors));
    }

    const position = await createPosition({
      name,
      departmentId,
      description,
      payRate,
      payType,
      currency,
      notes,
      isActive,
      sortOrder,
    });
    logger.info("Position created successfully");
    return res.status(201).send(position);
  } catch (error: any) {
    logger.logApiError("Error creating position", error, req);
    
    // Use database error parser for consistent, human-readable error messages
    if (isDatabaseError(error)) {
      const parsedError = parseDatabaseError(error);
      
      return res.status(parsedError.statusCode).json({
        success: false,
        message: parsedError.userMessage,
        errorCode: parsedError.errorCode,
        suggestions: parsedError.suggestions,
        technicalDetails: process.env.NODE_ENV === "development" 
          ? parsedError.technicalMessage 
          : undefined,
      });
    }
    
    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred while creating the position",
      detail: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const updatePositionHandler = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const {
      name,
      departmentId,
      description,
      payRate,
      payType,
      currency,
      notes,
      isActive,
      sortOrder,
    } = req.body;

    // Check if position exists first
    const existingPosition = await getPositionById(id);
    if (!existingPosition) {
      return res.status(404).json({
        success: false,
        message: "Position not found",
      });
    }

    // Pre-validate unique fields before attempting to update
    const uniqueFieldChecks = [];

    // Determine which department to check against (new departmentId or existing)
    const targetDepartmentId = departmentId || existingPosition.departmentId;

    // Check position name uniqueness within the target department (if provided and different from current)
    if (name && (name !== existingPosition.name || departmentId !== existingPosition.departmentId)) {
      uniqueFieldChecks.push({
        field: "name",
        value: name,
        checkFunction: () => checkPositionNameExists(name, targetDepartmentId, id),
        message: `A position with the name '${name}' already exists in this department`,
      });
    }

    // Validate all unique fields
    const validationErrors = await validateUniqueFields(uniqueFieldChecks);
    if (validationErrors.length > 0) {
      return res.status(409).json(buildConflictResponse(validationErrors));
    }

    const position = await updatePosition(id, {
      name,
      departmentId,
      description,
      payRate,
      payType,
      currency,
      notes,
      isActive,
      sortOrder,
    });
    if (!position) {
      return res.status(404).send("Position not found");
    }

    logger.info("Position updated successfully");
    return res.status(200).send(position);
  } catch (error: any) {
    logger.logApiError("Error updating position", error, req);
    
    // Use database error parser for consistent, human-readable error messages
    if (isDatabaseError(error)) {
      const parsedError = parseDatabaseError(error);
      
      return res.status(parsedError.statusCode).json({
        success: false,
        message: parsedError.userMessage,
        errorCode: parsedError.errorCode,
        suggestions: parsedError.suggestions,
        technicalDetails: process.env.NODE_ENV === "development" 
          ? parsedError.technicalMessage 
          : undefined,
      });
    }
    
    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred while updating the position",
      detail: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const deletePositionHandler = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);

    const position = await deletePosition(id);
    if (!position) {
      return res.status(404).send("Position not found");
    }

    logger.info("Position deleted successfully");
    return res.status(200).send("Position deleted successfully");
  } catch (error) {
    logger.logApiError("Error deleting position", error, req);
    return res.status(500).send("Internal server error");
  }
};

export const getPositionsByDepartmentHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const departmentId = parseInt(req.query.departmentId as string);

    if (!departmentId || isNaN(departmentId)) {
      return res.status(400).json({
        success: false,
        message:
          "departmentId query parameter is required and must be a valid number",
      });
    }

    const positions = await getPositionsByDepartment(departmentId);

    logger.info("Positions by department fetched successfully");
    return res.status(200).json({
      success: true,
      data: positions,
    });
  } catch (error: any) {
    // Log detailed error information
    logger.error("Error fetching positions by department", {
      error: error?.message || String(error),
      code: error?.code,
      detail: error?.detail,
      hint: error?.hint,
    });
    logger.logApiError("Error fetching positions by department", error, req);

    // Return more detailed error in development
    const errorMessage =
      process.env.NODE_ENV === "development" && error?.message
        ? error.message
        : "Internal server error";

    return res.status(500).json({
      success: false,
      message: errorMessage,
    });
  }
};
