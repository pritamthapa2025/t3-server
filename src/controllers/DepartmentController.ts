import type { Request, Response } from "express";
import {
  getDepartments,
  getDepartmentById,
  getDepartmentByName,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getDepartmentKPIs,
} from "../services/department.service.js";
import { logger } from "../utils/logger.js";

// Remove organization validation - departments are T3 internal
// Access control will be based on user roles/permissions instead
const validateOrganizationAccess = (
  req: Request,
  res: Response
): string | null => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(403).json({
      success: false,
      message: "Access denied. Authentication required.",
    });
    return null;
  }
  return userId;
};

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
      teamLeadId,
      primaryLocation,
      shiftCoverage,
      positionPayBands,
    } = req.body;

    const organizationId = validateOrganizationAccess(req, res);
    if (!organizationId) return;

    // Check if department with this name already exists in this organization
    const existingDepartment = await getDepartmentByName(name, organizationId);
    if (existingDepartment) {
      return res.status(409).json({
        success: false,
        message: "Department name already exists",
      });
    }

    const department = await createDepartment({
      name,
      description,
      organizationId,
      teamLeadId,
      primaryLocation,
      shiftCoverage,
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
    // Fallback: handle race condition if two requests create simultaneously
    if (error?.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Department name already exists",
      });
    }
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const updateDepartmentHandler = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const {
      name,
      description,
      teamLeadId,
      primaryLocation,
      shiftCoverage,
      positionPayBands,
    } = req.body;

    const department = await updateDepartment(id, {
      name,
      description,
      teamLeadId,
      primaryLocation,
      shiftCoverage,
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
    if (error.code === "23505") {
      // PostgreSQL unique constraint violation
      return res.status(409).json({
        success: false,
        message: "Department name already exists",
      });
    }
    return res.status(500).json({
      success: false,
      message: "Internal server error",
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
