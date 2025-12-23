import type { Request, Response } from "express";
import {
  getExpenseReports,
  getExpenseReportById,
  createExpenseReport,
  updateExpenseReport,
  deleteExpenseReport,
  submitExpenseReport,
} from "../services/expenseReport.service.js";
import { logger } from "../utils/logger.js";
import {
  parseDatabaseError,
  isDatabaseError,
} from "../utils/database-error-parser.js";

// ============================
// Expense Reports Controllers
// ============================

export const getExpenseReportsHandler = async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Organization context required.",
      });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    const filters = {
      status: req.query.status as string,
      employeeId: req.query.employeeId ? parseInt(req.query.employeeId as string) : undefined,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      submittedStartDate: req.query.submittedStartDate as string,
      submittedEndDate: req.query.submittedEndDate as string,
      approvedBy: req.query.approvedBy as string,
      search: req.query.search as string,
      sortBy: req.query.sortBy as string,
      sortOrder: req.query.sortOrder as "asc" | "desc",
      includeDeleted: req.query.includeDeleted === "true",
    };

    // Clean up undefined values from filters
    const cleanFilters = Object.fromEntries(
      Object.entries(filters).filter(([_, value]) => value !== undefined)
    );
    const result = await getExpenseReports(organizationId, offset, limit, cleanFilters as any);

    logger.info("Expense reports fetched successfully");
    return res.status(200).json({
      success: true,
      message: "Expense reports retrieved successfully",
      data: result.data,
      total: result.total,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.logApiError("Error fetching expense reports", error, req);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve expense reports",
    });
  }
};

export const getExpenseReportByIdHandler = async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Organization context required.",
      });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Report ID is required",
      });
    }
    const report = await getExpenseReportById(organizationId, id);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Expense report not found",
      });
    }

    logger.info("Expense report fetched successfully");
    return res.status(200).json({
      success: true,
      message: "Expense report retrieved successfully",
      data: report,
    });
  } catch (error) {
    logger.logApiError("Error fetching expense report", error, req);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve expense report",
    });
  }
};

export const createExpenseReportHandler = async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    const userId = req.user?.id;
    const employeeId = req.user?.employeeId;

    if (!organizationId || !userId || !employeeId) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Employee context required.",
      });
    }

    const result = await createExpenseReport(organizationId, employeeId, req.body, userId);

    logger.info("Expense report created successfully");
    return res.status(201).json({
      success: true,
      message: "Expense report created successfully",
      data: result,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not valid for this report")) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    logger.logApiError("Error creating expense report", error, req);
    return res.status(500).json({
      success: false,
      message: "Failed to create expense report",
    });
  }
};

export const updateExpenseReportHandler = async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    const userId = req.user?.id;

    if (!organizationId || !userId) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Organization context required.",
      });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Report ID is required",
      });
    }
    const report = await updateExpenseReport(organizationId, id, req.body, userId);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Expense report not found",
      });
    }

    logger.info("Expense report updated successfully");
    return res.status(200).json({
      success: true,
      message: "Expense report updated successfully",
      data: report,
    });
  } catch (error) {
    logger.logApiError("Error updating expense report", error, req);
    return res.status(500).json({
      success: false,
      message: "Failed to update expense report",
    });
  }
};

export const deleteExpenseReportHandler = async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Organization context required.",
      });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Report ID is required",
      });
    }
    const report = await deleteExpenseReport(organizationId, id);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Expense report not found",
      });
    }

    logger.info("Expense report deleted successfully");
    return res.status(200).json({
      success: true,
      message: "Expense report deleted successfully",
    });
  } catch (error) {
    logger.logApiError("Error deleting expense report", error, req);
    return res.status(500).json({
      success: false,
      message: "Failed to delete expense report",
    });
  }
};

export const submitExpenseReportHandler = async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    const userId = req.user?.id;

    if (!organizationId || !userId) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Organization context required.",
      });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Report ID is required",
      });
    }
    const { notes } = req.body;

    const result = await submitExpenseReport(organizationId, id, userId, notes);

    if (!result.report) {
      return res.status(404).json({
        success: false,
        message: "Expense report not found or cannot be submitted",
      });
    }

    logger.info("Expense report submitted successfully");
    return res.status(200).json({
      success: true,
      message: "Expense report submitted successfully",
      data: result,
    });
  } catch (error) {
    logger.logApiError("Error submitting expense report", error, req);
    return res.status(500).json({
      success: false,
      message: "Failed to submit expense report",
    });
  }
};
