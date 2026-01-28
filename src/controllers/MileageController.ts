import type { Request, Response } from "express";
import {
  getMileageLogs,
  getMileageLogById,
  createMileageLog,
  updateMileageLog,
  deleteMileageLog,
  verifyMileageLog,
  getMileageSummary,
} from "../services/mileage.service.js";
import { logger } from "../utils/logger.js";
import {
  parseDatabaseError,
  isDatabaseError,
} from "../utils/database-error-parser.js";

// ============================
// Mileage Logs Controllers
// ============================

export const getMileageLogsHandler = async (req: Request, res: Response) => {
  try {
    // organizationId is required - can be provided in query params
    const organizationId = req.query.organizationId as string | undefined;
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: "organizationId is required in query parameters",
      });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    const filters = {
      employeeId: req.query.employeeId
        ? parseInt(req.query.employeeId as string)
        : undefined,
      expenseId: req.query.expenseId as string,
      jobId: req.query.jobId as string,
      bidId: req.query.bidId as string,
      mileageType: req.query.mileageType as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      isVerified:
        req.query.isVerified === "true"
          ? true
          : req.query.isVerified === "false"
            ? false
            : undefined,
      search: req.query.search as string,
      sortBy: req.query.sortBy as string,
      sortOrder: req.query.sortOrder as "asc" | "desc",
      includeDeleted: req.query.includeDeleted === "true",
    };

    // Clean up undefined values from filters
    const cleanFilters = Object.fromEntries(
      Object.entries(filters).filter(([_, value]) => value !== undefined),
    );
    const result = await getMileageLogs(
      organizationId,
      offset,
      limit,
      cleanFilters as any,
    );

    logger.info("Mileage logs fetched successfully");
    return res.status(200).json({
      success: true,
      message: "Mileage logs retrieved successfully",
      data: result.data,
      total: result.total,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.logApiError("Error fetching mileage logs", error, req);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve mileage logs",
    });
  }
};

export const getMileageLogByIdHandler = async (req: Request, res: Response) => {
  try {
    // organizationId is optional - can be provided in query params or derived from mileage log
    const organizationId = req.query.organizationId as string | undefined;

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Mileage log ID is required",
      });
    }
    const log = await getMileageLogById(organizationId, id);

    if (!log) {
      return res.status(404).json({
        success: false,
        message: "Mileage log not found",
      });
    }

    logger.info("Mileage log fetched successfully");
    return res.status(200).json({
      success: true,
      message: "Mileage log retrieved successfully",
      data: log,
    });
  } catch (error) {
    logger.logApiError("Error fetching mileage log", error, req);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve mileage log",
    });
  }
};

export const createMileageLogHandler = async (req: Request, res: Response) => {
  try {
    // organizationId is required in request body
    const organizationId = req.body.organizationId;
    const employeeId = req.user?.employeeId;

    if (!organizationId || !employeeId) {
      return res.status(400).json({
        success: false,
        message:
          "organizationId is required in request body and employee context required",
      });
    }

    const log = await createMileageLog(organizationId, employeeId, req.body);

    logger.info("Mileage log created successfully");
    return res.status(201).json({
      success: true,
      message: "Mileage log created successfully",
      data: log,
    });
  } catch (error) {
    if (isDatabaseError(error)) {
      const dbError = parseDatabaseError(error);
      if (dbError.statusCode === 400) {
        return res.status(400).json({
          success: false,
          message: "Invalid expense, job, or bid reference",
        });
      }
    }

    logger.logApiError("Error creating mileage log", error, req);
    return res.status(500).json({
      success: false,
      message: "Failed to create mileage log",
    });
  }
};

export const updateMileageLogHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Mileage log ID is required",
      });
    }

    // Get mileage log first to derive organizationId
    const existingLog = await getMileageLogById(undefined, id);
    if (!existingLog) {
      return res.status(404).json({
        success: false,
        message: "Mileage log not found",
      });
    }

    const organizationId =
      existingLog.organizationId || (req.query.organizationId as string);
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: "Could not determine organization context for mileage log",
      });
    }

    const log = await updateMileageLog(organizationId, id, req.body);

    if (!log) {
      return res.status(404).json({
        success: false,
        message: "Mileage log not found",
      });
    }

    logger.info("Mileage log updated successfully");
    return res.status(200).json({
      success: true,
      message: "Mileage log updated successfully",
      data: log,
    });
  } catch (error) {
    logger.logApiError("Error updating mileage log", error, req);
    return res.status(500).json({
      success: false,
      message: "Failed to update mileage log",
    });
  }
};

export const deleteMileageLogHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Mileage log ID is required",
      });
    }

    // Get mileage log first to derive organizationId
    const existingLog = await getMileageLogById(undefined, id);
    if (!existingLog) {
      return res.status(404).json({
        success: false,
        message: "Mileage log not found",
      });
    }

    const organizationId =
      existingLog.organizationId || (req.query.organizationId as string);
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: "Could not determine organization context for mileage log",
      });
    }

    const log = await deleteMileageLog(organizationId, id);

    if (!log) {
      return res.status(404).json({
        success: false,
        message: "Mileage log not found",
      });
    }

    logger.info("Mileage log deleted successfully");
    return res.status(200).json({
      success: true,
      message: "Mileage log deleted successfully",
    });
  } catch (error) {
    logger.logApiError("Error deleting mileage log", error, req);
    return res.status(500).json({
      success: false,
      message: "Failed to delete mileage log",
    });
  }
};

export const verifyMileageLogHandler = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required",
      });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Mileage log ID is required",
      });
    }

    // Get mileage log first to derive organizationId
    const existingLog = await getMileageLogById(undefined, id);
    if (!existingLog) {
      return res.status(404).json({
        success: false,
        message: "Mileage log not found",
      });
    }

    const organizationId =
      existingLog.organizationId || (req.query.organizationId as string);
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: "Could not determine organization context for mileage log",
      });
    }

    const log = await verifyMileageLog(organizationId, id, userId);

    if (!log) {
      return res.status(404).json({
        success: false,
        message: "Mileage log not found",
      });
    }

    logger.info("Mileage log verified successfully");
    return res.status(200).json({
      success: true,
      message: "Mileage log verified successfully",
      data: log,
    });
  } catch (error) {
    logger.logApiError("Error verifying mileage log", error, req);
    return res.status(500).json({
      success: false,
      message: "Failed to verify mileage log",
    });
  }
};

export const getMileageSummaryHandler = async (req: Request, res: Response) => {
  try {
    // organizationId is required - can be provided in query params
    const organizationId = req.query.organizationId as string | undefined;
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: "organizationId is required in query parameters",
      });
    }

    const filters = {
      employeeId: req.query.employeeId
        ? parseInt(req.query.employeeId as string)
        : undefined,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      mileageType: req.query.mileageType as string,
    };

    // Clean up undefined values from filters
    const cleanFilters = Object.fromEntries(
      Object.entries(filters).filter(([_, value]) => value !== undefined),
    );
    const summary = await getMileageSummary(
      organizationId,
      cleanFilters as any,
    );

    logger.info("Mileage summary fetched successfully");
    return res.status(200).json({
      success: true,
      message: "Mileage summary retrieved successfully",
      data: summary,
    });
  } catch (error) {
    logger.logApiError("Error fetching mileage summary", error, req);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve mileage summary",
    });
  }
};
