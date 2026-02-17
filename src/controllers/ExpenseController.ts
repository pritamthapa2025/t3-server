import type { Request, Response } from "express";
import { asSingleString } from "../utils/request-helpers.js";
import {
  getExpenseCategories,
  getExpenses,
  getExpenseById,
  createExpense,
  updateExpense,
  deleteExpense,
  submitExpense,
  approveExpense,
  rejectExpense,
  getExpenseReceipts,
  getExpenseReceiptById,
  createExpenseReceipt,
  updateExpenseReceipt,
  deleteExpenseReceipt,
  getExpensesKPIs,
} from "../services/expense.service.js";
import {
  getExpenseSummary,
  getEmployeeExpenseSummary,
} from "../services/expenseAnalytics.service.js";
import { logger } from "../utils/logger.js";
import {
  parseDatabaseError,
  isDatabaseError,
} from "../utils/database-error-parser.js";

// ============================
// Expense Categories Controllers
// ============================

export const getExpenseCategoriesHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    const filters = {
      search: req.query.search as string,
    };

    // Clean up undefined values from filters
    const cleanFilters = Object.fromEntries(
      Object.entries(filters).filter(([_, value]) => value !== undefined),
    );
    const result = await getExpenseCategories(
      undefined,
      offset,
      limit,
      cleanFilters as any,
    );

    logger.info("Expense categories fetched successfully");
    return res.status(200).json({
      success: true,
      message: "Expense categories retrieved successfully",
      data: result.data,
      total: result.total,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.logApiError("Error fetching expense categories", error, req);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve expense categories",
    });
  }
};

// ============================
// Expenses Controllers
// ============================

export const getExpensesHandler = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    const filters = {
      status: req.query.status as string,
      expenseType: req.query.expenseType as string,
      paymentMethod: req.query.paymentMethod as string,
      employeeId: req.query.employeeId
        ? parseInt(req.query.employeeId as string)
        : undefined,
      category: req.query.category as string,
      jobId: req.query.jobId as string,
      bidId: req.query.bidId as string,
      vendor: req.query.vendor as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      submittedStartDate: req.query.submittedStartDate as string,
      submittedEndDate: req.query.submittedEndDate as string,
      approvedBy: req.query.approvedBy as string,
      reimbursementStatus: req.query.reimbursementStatus as string,
      hasReceipt:
        req.query.hasReceipt === "true"
          ? true
          : req.query.hasReceipt === "false"
            ? false
            : undefined,
      isReimbursable:
        req.query.isReimbursable === "true"
          ? true
          : req.query.isReimbursable === "false"
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
    const result = await getExpenses(
      undefined,
      offset,
      limit,
      cleanFilters as any,
    );

    logger.info("Expenses fetched successfully");
    return res.status(200).json({
      success: true,
      message: "Expenses retrieved successfully",
      data: result.data,
      total: result.total,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.logApiError("Error fetching expenses", error, req);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve expenses",
    });
  }
};

export const getExpenseByIdHandler = async (req: Request, res: Response) => {
  try {
    const id = asSingleString(req.params.id);
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Expense ID is required",
      });
    }

    const options = {
      includeReceipts: req.query.includeReceipts !== "false",
      includeAllocations: req.query.includeAllocations !== "false",
      includeApprovals: req.query.includeApprovals !== "false",
      includeHistory: req.query.includeHistory === "true",
    };

    const expense = await getExpenseById(undefined, id, options);

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      });
    }

    logger.info("Expense fetched successfully");
    return res.status(200).json({
      success: true,
      message: "Expense retrieved successfully",
      data: expense,
    });
  } catch (error) {
    logger.logApiError("Error fetching expense", error, req);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve expense",
    });
  }
};

export const createExpenseHandler = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User context required.",
      });
    }

    const result = await createExpense(undefined, req.body, userId);

    logger.info("Expense created successfully");
    return res.status(201).json({
      success: true,
      message: "Expense created successfully",
      data: result,
    });
  } catch (error) {
    if (isDatabaseError(error)) {
      const dbError = parseDatabaseError(error);
      if (dbError.statusCode === 400) {
        return res.status(400).json({
          success: false,
          message: "Invalid category, job, or bid reference",
        });
      }
    }

    logger.logApiError("Error creating expense", error, req);
    return res.status(500).json({
      success: false,
      message: "Failed to create expense",
    });
  }
};

export const updateExpenseHandler = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Authentication required.",
      });
    }

    const id = asSingleString(req.params.id);
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Expense ID is required",
      });
    }
    const expense = await updateExpense(undefined, id, req.body, userId);

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      });
    }

    logger.info("Expense updated successfully");
    return res.status(200).json({
      success: true,
      message: "Expense updated successfully",
      data: expense,
    });
  } catch (error) {
    logger.logApiError("Error updating expense", error, req);
    return res.status(500).json({
      success: false,
      message: "Failed to update expense",
    });
  }
};

export const deleteExpenseHandler = async (req: Request, res: Response) => {
  try {
    const id = asSingleString(req.params.id);
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Expense ID is required",
      });
    }
    const expense = await deleteExpense(undefined, id);

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      });
    }

    logger.info("Expense deleted successfully");
    return res.status(200).json({
      success: true,
      message: "Expense deleted successfully",
    });
  } catch (error) {
    logger.logApiError("Error deleting expense", error, req);
    return res.status(500).json({
      success: false,
      message: "Failed to delete expense",
    });
  }
};

export const submitExpenseHandler = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Authentication required.",
      });
    }

    const id = asSingleString(req.params.id);
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Expense ID is required",
      });
    }
    const { notes } = req.body;

    const result = await submitExpense(undefined, id, userId, notes);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Expense not found or cannot be submitted",
      });
    }

    logger.info("Expense submitted successfully");
    return res.status(200).json({
      success: true,
      message: "Expense submitted successfully",
      data: result,
    });
  } catch (error) {
    logger.logApiError("Error submitting expense", error, req);
    return res.status(500).json({
      success: false,
      message: "Failed to submit expense",
    });
  }
};

export const approveExpenseHandler = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Authentication required.",
      });
    }

    const id = asSingleString(req.params.id);
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Expense ID is required",
      });
    }
    const { comments } = req.body;

    const result = await approveExpense(undefined, id, userId, comments);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Expense not found or cannot be approved",
      });
    }

    logger.info("Expense approved successfully");
    return res.status(200).json({
      success: true,
      message: "Expense approved successfully",
      data: result,
    });
  } catch (error) {
    logger.logApiError("Error approving expense", error, req);
    return res.status(500).json({
      success: false,
      message: "Failed to approve expense",
    });
  }
};

export const rejectExpenseHandler = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Authentication required.",
      });
    }

    const id = asSingleString(req.params.id);
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Expense ID is required",
      });
    }
    const { comments, rejectionReason } = req.body;

    const result = await rejectExpense(
      undefined,
      id,
      userId,
      rejectionReason ?? comments,
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Expense not found or cannot be rejected",
      });
    }

    logger.info("Expense rejected successfully");
    return res.status(200).json({
      success: true,
      message: "Expense rejected successfully",
      data: result,
    });
  } catch (error) {
    logger.logApiError("Error rejecting expense", error, req);
    return res.status(500).json({
      success: false,
      message: "Failed to reject expense",
    });
  }
};

// ============================
// Analytics Controllers
// ============================

export const getExpenseSummaryHandler = async (req: Request, res: Response) => {
  try {
    const filters = {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      employeeId: req.query.employeeId
        ? parseInt(req.query.employeeId as string)
        : undefined,
      category: req.query.category as string,
      jobId: req.query.jobId as string,
      departmentId: req.query.departmentId
        ? parseInt(req.query.departmentId as string)
        : undefined,
      status: req.query.status as string,
    };

    // Clean up undefined values from filters
    const cleanFilters = Object.fromEntries(
      Object.entries(filters).filter(([_, value]) => value !== undefined),
    );
    const summary = await getExpenseSummary(undefined, cleanFilters as any);

    logger.info("Expense summary fetched successfully");
    return res.status(200).json({
      success: true,
      message: "Expense summary retrieved successfully",
      data: summary,
    });
  } catch (error) {
    logger.logApiError("Error fetching expense summary", error, req);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve expense summary",
    });
  }
};

export const getEmployeeExpenseSummaryHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const employeeIdParam = asSingleString(req.params.employeeId);
    if (!employeeIdParam) {
      return res.status(400).json({
        success: false,
        message: "Employee ID is required",
      });
    }
    const employeeId = parseInt(employeeIdParam, 10);
    if (isNaN(employeeId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid employee ID",
      });
    }

    const filters = {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      status: req.query.status as string,
    };

    const summary = await getEmployeeExpenseSummary(
      undefined,
      employeeId,
      filters,
    );

    if (!summary) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    logger.info("Employee expense summary fetched successfully");
    return res.status(200).json({
      success: true,
      message: "Employee expense summary retrieved successfully",
      data: summary,
    });
  } catch (error) {
    logger.logApiError("Error fetching employee expense summary", error, req);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve employee expense summary",
    });
  }
};

// ============================
// Expense Receipts
// ============================

export const getExpenseReceiptsHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const expenseId = req.params.expenseId as string;
    const expense = await getExpenseById(undefined, expenseId);
    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      });
    }
    const receipts = await getExpenseReceipts(expenseId);
    return res.status(200).json({
      success: true,
      message: "Receipts retrieved successfully",
      data: receipts,
    });
  } catch (error) {
    logger.logApiError("Error fetching expense receipts", error, req);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve receipts",
    });
  }
};

export const getExpenseReceiptByIdHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const expenseId = req.params.expenseId as string;
    const receiptId = req.params.receiptId as string;
    const expense = await getExpenseById(undefined, expenseId);
    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      });
    }
    const receipt = await getExpenseReceiptById(expenseId!, receiptId!);
    if (!receipt) {
      return res.status(404).json({
        success: false,
        message: "Receipt not found",
      });
    }
    return res.status(200).json({
      success: true,
      message: "Receipt retrieved successfully",
      data: receipt,
    });
  } catch (error) {
    logger.logApiError("Error fetching expense receipt", error, req);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve receipt",
    });
  }
};

export const createExpenseReceiptHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const expenseId = req.params.expenseId as string;
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }
    const expense = await getExpenseById(undefined, expenseId);
    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      });
    }
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Receipt file is required",
      });
    }
    const opts: {
      description?: string;
      receiptDate?: string;
      receiptNumber?: string;
      receiptTotal?: string;
      vendor?: string;
    } = {};
    if (req.body?.description != null)
      opts.description = req.body.description as string;
    if (req.body?.receiptDate != null)
      opts.receiptDate = req.body.receiptDate as string;
    if (req.body?.receiptNumber != null)
      opts.receiptNumber = req.body.receiptNumber as string;
    if (req.body?.receiptTotal != null)
      opts.receiptTotal = req.body.receiptTotal as string;
    if (req.body?.vendor != null) opts.vendor = req.body.vendor as string;

    const receipt = await createExpenseReceipt(
      expenseId!,
      {
        buffer: req.file.buffer,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
      },
      userId,
      Object.keys(opts).length > 0 ? opts : undefined,
    );
    if (!receipt) {
      return res.status(500).json({
        success: false,
        message: "Failed to upload receipt",
      });
    }
    logger.info("Expense receipt uploaded successfully");
    return res.status(201).json({
      success: true,
      message: "Receipt uploaded successfully",
      data: receipt,
    });
  } catch (error) {
    logger.logApiError("Error uploading expense receipt", error, req);
    return res.status(500).json({
      success: false,
      message: "Failed to upload receipt",
    });
  }
};

export const updateExpenseReceiptHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const expenseId = req.params.expenseId as string;
    const receiptId = req.params.receiptId as string;
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }
    const expense = await getExpenseById(undefined, expenseId);
    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      });
    }
    const existingReceipt = await getExpenseReceiptById(expenseId, receiptId);
    if (!existingReceipt) {
      return res.status(404).json({
        success: false,
        message: "Receipt not found",
      });
    }
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Receipt file is required to update",
      });
    }
    const opts: {
      description?: string;
      receiptDate?: string;
      receiptNumber?: string;
      receiptTotal?: string;
      vendor?: string;
    } = {};
    if (req.body?.description != null)
      opts.description = req.body.description as string;
    if (req.body?.receiptDate != null)
      opts.receiptDate = req.body.receiptDate as string;
    if (req.body?.receiptNumber != null)
      opts.receiptNumber = req.body.receiptNumber as string;
    if (req.body?.receiptTotal != null)
      opts.receiptTotal = req.body.receiptTotal as string;
    if (req.body?.vendor != null) opts.vendor = req.body.vendor as string;

    const receipt = await updateExpenseReceipt(
      expenseId!,
      receiptId!,
      {
        buffer: req.file.buffer,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
      },
      Object.keys(opts).length > 0 ? opts : undefined,
    );
    if (!receipt) {
      return res.status(500).json({
        success: false,
        message: "Failed to update receipt",
      });
    }
    logger.info("Expense receipt updated successfully");
    return res.status(200).json({
      success: true,
      message: "Receipt updated successfully",
      data: receipt,
    });
  } catch (error) {
    logger.logApiError("Error updating expense receipt", error, req);
    return res.status(500).json({
      success: false,
      message: "Failed to update receipt",
    });
  }
};

export const deleteExpenseReceiptHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const expenseId = req.params.expenseId as string;
    const receiptId = req.params.receiptId as string;
    const expense = await getExpenseById(undefined, expenseId);
    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      });
    }
    const receipt = await deleteExpenseReceipt(expenseId!, receiptId!);
    if (!receipt) {
      return res.status(404).json({
        success: false,
        message: "Receipt not found",
      });
    }
    logger.info("Expense receipt deleted successfully");
    return res.status(200).json({
      success: true,
      message: "Receipt deleted successfully",
      data: receipt,
    });
  } catch (error) {
    logger.logApiError("Error deleting expense receipt", error, req);
    return res.status(500).json({
      success: false,
      message: "Failed to delete receipt",
    });
  }
};

// ============================
// Expenses KPIs Handler
// ============================

export const getExpensesKPIsHandler = async (req: Request, res: Response) => {
  try {
    const kpis = await getExpensesKPIs();

    logger.info("Expenses KPIs fetched successfully");
    return res.status(200).json({
      success: true,
      data: kpis,
    });
  } catch (error: any) {
    logger.logApiError("Error fetching expenses KPIs", error, req);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};
