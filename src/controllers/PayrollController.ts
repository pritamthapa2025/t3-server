import type { Request, Response } from "express";
import {
  getPayrollDashboard,
  getPayrollEntries,
  getPayrollEntryById,
  createPayrollEntry,
  updatePayrollEntry,
  deletePayrollEntry,
  approvePayrollEntry,
  rejectPayrollEntry,
  processPayrollRun,
  getPayrollRunById,
  getPayrollRuns,
  createPayrollRun,
} from "../services/payroll.service.js";
import { logger } from "../utils/logger.js";

export const getPayrollDashboardHandler = async (req: Request, res: Response) => {
  try {
    const organizationId = req.query.organizationId as string;
    const payPeriodId = req.query.payPeriodId as string;
    const dateFrom = req.query.dateFrom as string | undefined;
    const dateTo = req.query.dateTo as string | undefined;

    const dashboard = await getPayrollDashboard(organizationId, {
      payPeriodId,
      dateFrom,
      dateTo,
    });

    logger.info("Payroll dashboard fetched successfully");
    return res.status(200).json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    logger.logApiError("Error fetching payroll dashboard", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getPayrollEntriesHandler = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string | undefined;
    const organizationId = req.query.organizationId as string;
    const payPeriodId = req.query.payPeriodId as string | undefined;
    const status = req.query.status as string | undefined;
    const employeeId = req.query.employeeId as string | undefined;

    const offset = (page - 1) * limit;

    const result = await getPayrollEntries(offset, limit, {
      search,
      organizationId,
      payPeriodId,
      status,
      employeeId,
    });

    logger.info("Payroll entries fetched successfully");
    return res.status(200).json({
      success: true,
      data: result.data,
      total: result.total,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.logApiError("Error fetching payroll entries", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getPayrollEntryByIdHandler = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invalid payroll entry ID provided",
      });
    }

    const payrollEntry = await getPayrollEntryById(id);
    if (!payrollEntry) {
      return res.status(404).json({
        success: false,
        message: "Payroll entry not found",
      });
    }

    logger.info("Payroll entry fetched successfully");
    return res.status(200).json({
      success: true,
      data: payrollEntry,
    });
  } catch (error) {
    logger.logApiError("Error fetching payroll entry details", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const createPayrollEntryHandler = async (req: Request, res: Response) => {
  try {
    const payrollEntryData = req.body;
    const createdBy = (req as any).user?.id;

    const newPayrollEntry = await createPayrollEntry({
      ...payrollEntryData,
      createdBy,
    });

    logger.info("Payroll entry created successfully");
    return res.status(201).json({
      success: true,
      message: "Payroll entry created successfully",
      data: newPayrollEntry,
    });
  } catch (error) {
    logger.logApiError("Error creating payroll entry", error, req);

    if ((error as any).code === "DUPLICATE_ENTRY") {
      return res.status(400).json({
        success: false,
        message: "Payroll entry already exists for this employee in the selected period",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const updatePayrollEntryHandler = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const updateData = req.body;
    const updatedBy = (req as any).user?.id;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invalid payroll entry ID provided",
      });
    }

    const updatedPayrollEntry = await updatePayrollEntry(id, {
      ...updateData,
      updatedBy,
    });

    if (!updatedPayrollEntry) {
      return res.status(404).json({
        success: false,
        message: "Payroll entry not found",
      });
    }

    logger.info("Payroll entry updated successfully");
    return res.status(200).json({
      success: true,
      message: "Payroll entry updated successfully",
      data: updatedPayrollEntry,
    });
  } catch (error) {
    logger.logApiError("Error updating payroll entry", error, req);

    if ((error as any).code === "ENTRY_LOCKED") {
      return res.status(400).json({
        success: false,
        message: "Cannot update locked payroll entry",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const deletePayrollEntryHandler = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const deletedBy = (req as any).user?.id;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invalid payroll entry ID provided",
      });
    }

    const deleted = await deletePayrollEntry(id, deletedBy);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Payroll entry not found",
      });
    }

    logger.info("Payroll entry deleted successfully");
    return res.status(200).json({
      success: true,
      message: "Payroll entry deleted successfully",
    });
  } catch (error) {
    logger.logApiError("Error deleting payroll entry", error, req);

    if ((error as any).code === "ENTRY_LOCKED") {
      return res.status(400).json({
        success: false,
        message: "Cannot delete locked payroll entry",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const approvePayrollEntryHandler = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const approvedBy = (req as any).user?.id;
    const notes = req.body.notes as string | undefined;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invalid payroll entry ID provided",
      });
    }

    const approvedEntry = await approvePayrollEntry(id, approvedBy, notes);

    if (!approvedEntry) {
      return res.status(404).json({
        success: false,
        message: "Payroll entry not found",
      });
    }

    logger.info("Payroll entry approved successfully");
    return res.status(200).json({
      success: true,
      message: "Payroll entry approved successfully",
      data: approvedEntry,
    });
  } catch (error) {
    logger.logApiError("Error approving payroll entry", error, req);

    if ((error as any).code === "ALREADY_APPROVED") {
      return res.status(400).json({
        success: false,
        message: "Payroll entry is already approved",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const rejectPayrollEntryHandler = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const rejectedBy = (req as any).user?.id;
    const reason = req.body.reason as string;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invalid payroll entry ID provided",
      });
    }

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required",
      });
    }

    const rejectedEntry = await rejectPayrollEntry(id, rejectedBy, reason);

    if (!rejectedEntry) {
      return res.status(404).json({
        success: false,
        message: "Payroll entry not found",
      });
    }

    logger.info("Payroll entry rejected successfully");
    return res.status(200).json({
      success: true,
      message: "Payroll entry rejected successfully",
      data: rejectedEntry,
    });
  } catch (error) {
    logger.logApiError("Error rejecting payroll entry", error, req);

    if ((error as any).code === "ALREADY_PROCESSED") {
      return res.status(400).json({
        success: false,
        message: "Cannot reject already processed payroll entry",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Payroll Run Handlers
export const getPayrollRunsHandler = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string | undefined;
    const organizationId = req.query.organizationId as string;
    const status = req.query.status as string | undefined;

    const offset = (page - 1) * limit;

    const result = await getPayrollRuns(offset, limit, {
      search,
      organizationId,
      status,
    });

    logger.info("Payroll runs fetched successfully");
    return res.status(200).json({
      success: true,
      data: result.data,
      total: result.total,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.logApiError("Error fetching payroll runs", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getPayrollRunByIdHandler = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invalid payroll run ID provided",
      });
    }

    const payrollRun = await getPayrollRunById(id);
    if (!payrollRun) {
      return res.status(404).json({
        success: false,
        message: "Payroll run not found",
      });
    }

    logger.info("Payroll run fetched successfully");
    return res.status(200).json({
      success: true,
      data: payrollRun,
    });
  } catch (error) {
    logger.logApiError("Error fetching payroll run details", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const createPayrollRunHandler = async (req: Request, res: Response) => {
  try {
    const payrollRunData = req.body;
    const createdBy = (req as any).user?.id;

    const newPayrollRun = await createPayrollRun({
      ...payrollRunData,
      createdBy,
    });

    logger.info("Payroll run created successfully");
    return res.status(201).json({
      success: true,
      message: "Payroll run created successfully",
      data: newPayrollRun,
    });
  } catch (error) {
    logger.logApiError("Error creating payroll run", error, req);

    if ((error as any).code === "DUPLICATE_RUN") {
      return res.status(400).json({
        success: false,
        message: "Payroll run already exists for this period",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const processPayrollRunHandler = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const processedBy = (req as any).user?.id;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invalid payroll run ID provided",
      });
    }

    const processedRun = await processPayrollRun(id, processedBy);

    if (!processedRun) {
      return res.status(404).json({
        success: false,
        message: "Payroll run not found",
      });
    }

    logger.info("Payroll run processed successfully");
    return res.status(200).json({
      success: true,
      message: "Payroll run processed successfully",
      data: processedRun,
    });
  } catch (error) {
    logger.logApiError("Error processing payroll run", error, req);

    if ((error as any).code === "ALREADY_PROCESSED") {
      return res.status(400).json({
        success: false,
        message: "Payroll run is already processed",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};





