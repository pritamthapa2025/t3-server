import type { Request, Response } from "express";
import {
  getDashboardKPIs,
  getComplianceCases,
  getComplianceCaseById,
  createComplianceCase,
  updateComplianceCase,
  deleteComplianceCase,
  updateCaseStatus,
  getViolationWatchlist,
  getViolationCounts,
  createEmployeeViolation,
} from "../services/compliance.service.js";
import { logger } from "../utils/logger.js";

// Dashboard KPIs Handler
export const getDashboardKPIsHandler = async (req: Request, res: Response) => {
  try {
    const { dateFrom, dateTo } = req.query;

    const kpis = await getDashboardKPIs({
      dateFrom: dateFrom as string,
      dateTo: dateTo as string,
    });

    logger.info("Dashboard KPIs fetched successfully");
    return res.status(200).json({
      success: true,
      data: kpis,
    });
  } catch (error) {
    logger.logApiError("Error fetching dashboard KPIs", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Get Compliance Cases Handler
export const getComplianceCasesHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const {
      search,
      organizationId,
      jobId,
      employeeId,
      type,
      severity,
      status,
      assignedTo,
      dueFrom,
      dueTo,
      sortBy,
      sortOrder,
    } = req.query;

    const offset = (page - 1) * limit;

    const filters: any = {};

    if (search) filters.search = search as string;
    if (organizationId) filters.organizationId = organizationId as string;
    if (jobId) filters.jobId = jobId as string;
    if (employeeId) filters.employeeId = parseInt(employeeId as string);
    if (type) filters.type = type as string;
    if (severity) filters.severity = severity as string;
    if (status) filters.status = status as string;
    if (assignedTo) filters.assignedTo = assignedTo as string;
    if (dueFrom) filters.dueFrom = dueFrom as string;
    if (dueTo) filters.dueTo = dueTo as string;
    if (sortBy) filters.sortBy = sortBy as string;
    if (sortOrder) filters.sortOrder = sortOrder as "asc" | "desc";

    const result = await getComplianceCases(offset, limit, filters);

    logger.info("Compliance cases fetched successfully");
    return res.status(200).json({
      success: true,
      data: result.data,
      total: result.total,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.logApiError("Error fetching compliance cases", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Get Compliance Case by ID Handler
export const getComplianceCaseByIdHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Case ID is required",
      });
    }

    const complianceCase = await getComplianceCaseById(id);

    if (!complianceCase) {
      return res.status(404).json({
        success: false,
        message: "Compliance case not found",
      });
    }

    logger.info(`Compliance case ${id} fetched successfully`);
    return res.status(200).json({
      success: true,
      data: complianceCase,
    });
  } catch (error) {
    logger.logApiError("Error fetching compliance case", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Create Compliance Case Handler
export const createComplianceCaseHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const caseData = req.body;

    // organizationId is optional - only include if provided in body and is a valid client UUID
    // Don't use req.user.organizationId as it may be "t3-org-default" which is not a valid UUID
    // The service will validate and only include organizationId if it's a valid client UUID

    const newCase = await createComplianceCase(caseData);

    if (!newCase) {
      return res.status(500).json({
        success: false,
        message: "Failed to create compliance case",
      });
    }

    logger.info(`Compliance case ${newCase.caseNumber} created successfully`);
    return res.status(201).json({
      success: true,
      data: newCase,
      message: "Compliance case created successfully",
    });
  } catch (error) {
    logger.logApiError("Error creating compliance case", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Update Compliance Case Handler
export const updateComplianceCaseHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Case ID is required",
      });
    }
    const updateData = req.body;

    const updatedCase = await updateComplianceCase(id, updateData);

    if (!updatedCase) {
      return res.status(404).json({
        success: false,
        message: "Compliance case not found",
      });
    }

    logger.info(`Compliance case ${id} updated successfully`);
    return res.status(200).json({
      success: true,
      data: updatedCase,
      message: "Compliance case updated successfully",
    });
  } catch (error) {
    logger.logApiError("Error updating compliance case", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Delete Compliance Case Handler (Soft Delete)
export const deleteComplianceCaseHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Case ID is required",
      });
    }

    const deletedCase = await deleteComplianceCase(id);

    if (!deletedCase) {
      return res.status(404).json({
        success: false,
        message: "Compliance case not found",
      });
    }

    logger.info(`Compliance case ${id} deleted successfully`);
    return res.status(200).json({
      success: true,
      message: "Compliance case deleted successfully",
    });
  } catch (error) {
    logger.logApiError("Error deleting compliance case", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Update Case Status Handler
export const updateCaseStatusHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Case ID is required",
      });
    }
    const { status, notes, resolvedBy, resolvedDate } = req.body;

    const updatedCase = await updateCaseStatus(
      id,
      status,
      notes,
      resolvedBy,
      resolvedDate ? new Date(resolvedDate) : undefined,
    );

    if (!updatedCase) {
      return res.status(404).json({
        success: false,
        message: "Compliance case not found",
      });
    }

    logger.info(`Compliance case ${id} status updated to ${status}`);
    return res.status(200).json({
      success: true,
      data: updatedCase,
      message: "Case status updated successfully",
    });
  } catch (error) {
    logger.logApiError("Error updating case status", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Get Violation Watchlist Handler
export const getViolationWatchlistHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const { organizationId, minViolations, sortBy, sortOrder } = req.query;

    const offset = (page - 1) * limit;

    const watchlistFilters: any = {
      // minViolations defaults to 3 if not provided (handled by validation)
      minViolations: minViolations ? parseInt(minViolations as string) : 3,
    };
    if (organizationId)
      watchlistFilters.organizationId = organizationId as string;
    if (sortBy) watchlistFilters.sortBy = sortBy as string;
    if (sortOrder) watchlistFilters.sortOrder = sortOrder as "asc" | "desc";

    const result = await getViolationWatchlist(offset, limit, watchlistFilters);

    logger.info("Violation watchlist fetched successfully");
    return res.status(200).json({
      success: true,
      data: result.data,
      total: result.total,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.logApiError("Error fetching violation watchlist", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Create Employee Violation Handler
export const createEmployeeViolationHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    // organizationId is optional - only include if provided in body and is a valid client UUID
    // Don't use req.user.organizationId as it may be "t3-org-default" which is not a valid UUID
    const organizationId = req.body.organizationId; // Get from request body, not from user context
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required",
      });
    }

    const violationData = {
      ...req.body,
      // Only include organizationId if it's provided in the body (service will validate it)
      ...(organizationId && { organizationId }),
      createdBy: userId,
    };

    const violation = await createEmployeeViolation(violationData);

    if (!violation) {
      return res.status(500).json({
        success: false,
        message: "Failed to create employee violation",
      });
    }

    logger.info(`Employee violation created successfully: ${violation.id}`);
    return res.status(201).json({
      success: true,
      message: "Employee violation created successfully",
      data: violation,
    });
  } catch (error) {
    logger.logApiError("Error creating employee violation", error, req);
    return res.status(500).json({
      success: false,
      message: "Failed to create employee violation",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Get Violation Counts Handler
export const getViolationCountsHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { organizationId, jobId, employeeId, dateFrom, dateTo, groupBy } =
      req.query;

    const countFilters: any = {};
    if (organizationId) countFilters.organizationId = organizationId as string;
    if (jobId) countFilters.jobId = jobId as string;
    if (employeeId) countFilters.employeeId = parseInt(employeeId as string);
    if (dateFrom) countFilters.dateFrom = dateFrom as string;
    if (dateTo) countFilters.dateTo = dateTo as string;
    if (groupBy) countFilters.groupBy = groupBy as string;

    const counts = await getViolationCounts(countFilters);

    logger.info("Violation counts fetched successfully");
    return res.status(200).json({
      success: true,
      data: counts,
    });
  } catch (error) {
    logger.logApiError("Error fetching violation counts", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
