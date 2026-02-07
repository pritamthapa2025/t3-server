import type { Request, Response } from "express";
import { asSingleString } from "../utils/request-helpers.js";
import { RoleRepository } from "../repositories/RoleRepository.js";
import { logger } from "../utils/logger.js";
import {
  checkRoleNameExists,
  validateUniqueFields,
  buildConflictResponse,
} from "../utils/validation-helpers.js";
import { parseDatabaseError, isDatabaseError } from "../utils/database-error-parser.js";

// Get all roles with pagination and filtering
export const getRolesHandler = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string | undefined;
    const includeDeleted = req.query.includeDeleted === 'true';
    const sortBy = (req.query.sortBy as 'name' | 'createdAt') || 'createdAt';
    const sortOrder = (req.query.sortOrder as 'asc' | 'desc') || 'desc';

    const offset = (page - 1) * limit;

    const result = await RoleRepository.getRoles({
      offset,
      limit,
      search,
      includeDeleted,
      sortBy,
      sortOrder,
    });

    logger.info("Roles fetched successfully");
    return res.status(200).json({
      success: true,
      data: result.data,
      total: result.total,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.logApiError("Error fetching roles", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Get role by ID
export const getRoleByIdHandler = async (req: Request, res: Response) => {
  try {
    const roleId = parseInt(asSingleString(req.params.id) || "0", 10);
    
    const role = await RoleRepository.getRoleById(roleId);
    
    if (!role) {
      return res.status(404).json({
        success: false,
        message: "Role not found",
      });
    }

    logger.info(`Role with ID ${roleId} fetched successfully`);
    return res.status(200).json({
      success: true,
      data: role,
    });
  } catch (error) {
    logger.logApiError("Error fetching role by ID", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Create a new role
export const createRoleHandler = async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;

    // Pre-validate unique fields before attempting to create
    const uniqueFieldChecks = [];

    // Check role name uniqueness
    if (name) {
      uniqueFieldChecks.push({
        field: "name",
        value: name,
        checkFunction: () => checkRoleNameExists(name),
        message: `A role with the name '${name}' already exists`,
      });
    }

    // Validate all unique fields
    const validationErrors = await validateUniqueFields(uniqueFieldChecks);
    if (validationErrors.length > 0) {
      return res.status(409).json(buildConflictResponse(validationErrors));
    }

    const newRole = await RoleRepository.createRole({
      name,
      description,
    });

    logger.info(`Role '${name}' created successfully`);
    return res.status(201).json({
      success: true,
      message: "Role created successfully",
      data: newRole,
    });
  } catch (error: any) {
    logger.logApiError("Error creating role", error, req);

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
      message: "An unexpected error occurred while creating the role",
      detail: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Update a role
export const updateRoleHandler = async (req: Request, res: Response) => {
  try {
    const roleId = parseInt(asSingleString(req.params.id) || "0", 10);
    const { name, description } = req.body;

    // Check if role exists
    const existingRole = await RoleRepository.getRoleById(roleId);
    if (!existingRole) {
      return res.status(404).json({
        success: false,
        message: "Role not found",
      });
    }

    // Pre-validate unique fields before attempting to update
    const uniqueFieldChecks = [];

    // Check role name uniqueness (if provided and different from current)
    if (name && name !== existingRole.name) {
      uniqueFieldChecks.push({
        field: "name",
        value: name,
        checkFunction: () => checkRoleNameExists(name, roleId),
        message: `A role with the name '${name}' already exists`,
      });
    }

    // Validate all unique fields
    const validationErrors = await validateUniqueFields(uniqueFieldChecks);
    if (validationErrors.length > 0) {
      return res.status(409).json(buildConflictResponse(validationErrors));
    }

    const updatedRole = await RoleRepository.updateRole(roleId, {
      name,
      description,
    });

    if (!updatedRole) {
      return res.status(404).json({
        success: false,
        message: "Role not found",
      });
    }

    logger.info(`Role with ID ${roleId} updated successfully`);
    return res.status(200).json({
      success: true,
      message: "Role updated successfully",
      data: updatedRole,
    });
  } catch (error: any) {
    logger.logApiError("Error updating role", error, req);

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
      message: "An unexpected error occurred while updating the role",
      detail: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Delete a role (soft delete)
export const deleteRoleHandler = async (req: Request, res: Response) => {
  try {
    const roleId = parseInt(asSingleString(req.params.id) || "0", 10);

    const deletedRole = await RoleRepository.deleteRole(roleId);
    
    if (!deletedRole) {
      return res.status(404).json({
        success: false,
        message: "Role not found",
      });
    }

    logger.info(`Role with ID ${roleId} deleted successfully`);
    return res.status(200).json({
      success: true,
      message: "Role deleted successfully",
    });
  } catch (error) {
    logger.logApiError("Error deleting role", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Check if role name exists (utility endpoint)
export const checkRoleNameHandler = async (req: Request, res: Response) => {
  try {
    const { name, excludeId } = req.query;
    
    const exists = await RoleRepository.roleNameExists(
      name as string,
      excludeId ? parseInt(excludeId as string) : undefined
    );

    return res.status(200).json({
      success: true,
      exists,
    });
  } catch (error) {
    logger.logApiError("Error checking role name", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Get roles count
export const getRolesCountHandler = async (req: Request, res: Response) => {
  try {
    const count = await RoleRepository.getActiveRolesCount();

    return res.status(200).json({
      success: true,
      data: { count },
    });
  } catch (error) {
    logger.logApiError("Error getting roles count", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
