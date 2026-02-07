import type { Request, Response } from "express";
import {
  getTimesheets,
  getTimesheetById,
  createTimesheet,
  updateTimesheet,
  deleteTimesheet,
  clockIn,
  clockOut,
  approveTimesheet,
  canApproveTimesheet,
  rejectTimesheet,
  getTimesheetsByEmployee,
  getWeeklyTimesheetsByEmployee,
  getMyWeeklyTimesheets,
  createTimesheetWithClockData,
  getTimesheetKPIs,
} from "../services/timesheet.service.js";
import {
  syncPayrollFromApprovedTimesheet,
  recalcPayrollForEmployeeWeek,
} from "../services/payroll.service.js";
import { logger } from "../utils/logger.js";

export const getTimesheetsHandler = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string | undefined;

    const offset = (page - 1) * limit;

    const timesheets = await getTimesheets(offset, limit, search);

    logger.info("Timesheets fetched successfully");
    return res.status(200).json({
      success: true,
      data: timesheets.data,
      total: timesheets.total,
      pagination: timesheets.pagination,
    });
  } catch (error) {
    logger.logApiError("Timesheet error", error, req);
    return res.status(500).send("Internal server error");
  }
};

export const getTimesheetsByEmployeeHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string | undefined;
    const employeeId = req.query.employeeId as string | undefined;
    const dateFrom = req.query.dateFrom as string | undefined;
    const dateTo = req.query.dateTo as string | undefined;

    const offset = (page - 1) * limit;

    const timesheets = await getTimesheetsByEmployee(
      offset,
      limit,
      search,
      employeeId,
      dateFrom,
      dateTo
    );

    logger.info("Timesheets by employee fetched successfully");
    return res.status(200).json({
      success: true,
      message: "Timesheets grouped by employee retrieved successfully",
      data: timesheets.data,
      total: timesheets.total,
      pagination: timesheets.pagination,
    });
  } catch (error) {
    logger.logApiError("Timesheet by employee error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// New endpoint for technicians to view only their own timesheets in weekly format
export const getMyTimesheetsHandler = async (req: Request, res: Response) => {
  try {
    const { weekStartDate, search } = req.query;

    // Default to current week's Monday if no weekStartDate provided
    let startDate: string;
    if (weekStartDate) {
      startDate = weekStartDate as string;
    } else {
      // Get current week's Monday
      const now = new Date();
      const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const daysToSubtract = currentDay === 0 ? 6 : currentDay - 1; // If Sunday, go back 6 days
      const monday = new Date(now);
      monday.setDate(now.getDate() - daysToSubtract);
      startDate = monday.toISOString().split("T")[0]!;
    }

    // Get the current user's employee ID from the authenticated request
    const currentUser = (req as any).user;
    if (!currentUser || !currentUser.employeeId) {
      return res.status(400).json({
        success: false,
        message:
          "Employee information not found. Please ensure you are properly logged in as an employee.",
      });
    }

    const myWeeklyTimesheets = await getMyWeeklyTimesheets(
      currentUser.employeeId,
      startDate,
      search as string | undefined
    );

    logger.info(
      `My weekly timesheets fetched successfully for employee: ${currentUser.employeeId}, week: ${startDate}`
    );
    return res.status(200).json({
      success: true,
      message: "Your weekly timesheets retrieved successfully",
      data: myWeeklyTimesheets,
      employeeId: currentUser.employeeId,
    });
  } catch (error) {
    logger.logApiError("Get my weekly timesheets error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getWeeklyTimesheetsByEmployeeHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { weekStartDate, employeeId, departmentId, status, page, limit } =
      req.query;

    // Handle employeeId - can be single value, array, or comma-separated string like "[14,16]" or "14,16"
    let employeeIds: number[] | undefined;
    if (employeeId) {
      if (Array.isArray(employeeId)) {
        employeeIds = employeeId.map((id) => parseInt(id as string, 10)).filter((id) => !isNaN(id));
      } else {
        const str = employeeId.toString().trim();
        // Remove brackets if present
        const cleaned = str.replace(/^\[|\]$/g, '');
        // Split by comma and parse
        const ids = cleaned.split(',').map((id) => {
          const trimmed = id.trim();
          return parseInt(trimmed, 10);
        }).filter((id) => !isNaN(id) && id > 0);
        
        employeeIds = ids.length > 0 ? ids : undefined;
      }
    }

    const weeklyTimesheets = await getWeeklyTimesheetsByEmployee(
      weekStartDate as string,
      employeeIds,
      departmentId ? parseInt(departmentId as string, 10) : undefined,
      status as string | undefined,
      page ? parseInt(page as string, 10) : 1,
      limit ? parseInt(limit as string, 10) : 10
    );

    logger.info("Weekly timesheets by employee fetched successfully");
    return res.status(200).json({
      success: true,
      message: "Weekly timesheets grouped by employee retrieved successfully",
      data: weeklyTimesheets,
    });
  } catch (error) {
    logger.logApiError("Weekly timesheet by employee error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getTimesheetByIdHandler = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as unknown as number;

    const timesheet = await getTimesheetById(id);
    if (!timesheet) {
      return res.status(404).json({
        success: false,
        message: "Timesheet not found",
      });
    }

    logger.info("Timesheet fetched successfully");
    return res.status(200).json({
      success: true,
      data: timesheet,
    });
  } catch (error) {
    logger.logApiError("Timesheet error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const createTimesheetHandler = async (req: Request, res: Response) => {
  try {
    const {
      employeeId,
      sheetDate,
      clockIn,
      clockOut,
      breakMinutes,
      totalHours,
      overtimeHours,
      notes,
    } = req.body;

    const timesheet = await createTimesheet({
      employeeId,
      sheetDate,
      clockIn,
      clockOut,
      breakMinutes,
      totalHours,
      overtimeHours,
      notes,
    });
    logger.info("Timesheet created successfully");
    return res.status(201).json({
      success: true,
      message: "Timesheet created successfully",
      data: timesheet,
    });
  } catch (error: any) {
    logger.logApiError("Timesheet error", error, req);
    if (error.code === "23505") {
      // PostgreSQL unique constraint violation
      return res.status(409).json({
        success: false,
        message: "Timesheet for this employee and date already exists",
      });
    }
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const updateTimesheetHandler = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as unknown as number;

    const {
      employeeId,
      sheetDate,
      clockIn,
      clockOut,
      breakMinutes,
      totalHours,
      overtimeHours,
      notes,
      status,
      rejectedBy,
      approvedBy,
    } = req.body;

    const updateData: any = {};
    if (employeeId !== undefined) updateData.employeeId = employeeId;
    if (sheetDate !== undefined) updateData.sheetDate = sheetDate;
    if (clockIn !== undefined) updateData.clockIn = clockIn;
    if (clockOut !== undefined) updateData.clockOut = clockOut;
    if (breakMinutes !== undefined) updateData.breakMinutes = breakMinutes;
    if (totalHours !== undefined) updateData.totalHours = totalHours;
    if (overtimeHours !== undefined) updateData.overtimeHours = overtimeHours;
    if (notes !== undefined) updateData.notes = notes;
    if (status !== undefined) updateData.status = status;
    if (rejectedBy !== undefined) updateData.rejectedBy = rejectedBy;
    if (approvedBy !== undefined) updateData.approvedBy = approvedBy;

    const timesheet = await updateTimesheet(id, updateData);
    if (!timesheet) {
      return res.status(404).json({
        success: false,
        message: "Timesheet not found",
      });
    }

    logger.info("Timesheet updated successfully");
    return res.status(200).json({
      success: true,
      message: "Timesheet updated successfully",
      data: timesheet,
    });
  } catch (error: any) {
    logger.logApiError("Timesheet error", error, req);
    if (error.code === "23505") {
      // PostgreSQL unique constraint violation
      return res
        .status(409)
        .send("Timesheet for this employee and date already exists");
    }
    return res.status(500).send("Internal server error");
  }
};

export const deleteTimesheetHandler = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as unknown as number;

    const timesheet = await deleteTimesheet(id);
    if (!timesheet) {
      return res.status(404).send("Timesheet not found");
    }

    logger.info("Timesheet deleted successfully");
    return res.status(200).json({
      success: true,
      message: "Timesheet deleted successfully",
    });
  } catch (error) {
    logger.logApiError("Timesheet error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const clockInHandler = async (req: Request, res: Response) => {
  try {
    const { employeeId, clockInDate, clockInTime, jobIds, notes } = req.body;

    const timesheet = await clockIn({
      employeeId,
      clockInDate,
      clockInTime,
      jobIds,
      notes,
    });

    logger.info("Employee clocked in successfully");
    return res.status(201).json({
      success: true,
      message: "Clocked in successfully",
      data: timesheet,
    });
  } catch (error: any) {
    logger.logApiError("Clock-in error", error, req);

    if (error.message === "Employee has already clocked in today") {
      return res.status(409).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const clockOutHandler = async (req: Request, res: Response) => {
  try {
    const {
      employeeId,
      clockOutDate,
      clockOutTime,
      jobIds,
      notes,
      breakMinutes,
    } = req.body;

    const timesheet = await clockOut({
      employeeId,
      clockOutDate,
      clockOutTime,
      jobIds,
      notes,
      breakMinutes,
    });

    logger.info("Employee clocked out successfully");
    return res.status(200).json({
      success: true,
      message: "Clocked out successfully",
      data: timesheet,
    });
  } catch (error: any) {
    logger.logApiError("Clock-out error", error, req);

    if (
      error.message ===
      "No clock-in record found for today. Please clock in first."
    ) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const createTimesheetWithClockDataHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const {
      employeeId,
      clockInDate,
      clockInTime,
      clockOutDate,
      clockOutTime,
      breakMinutes,
      notes,
    } = req.body;

    const timesheet = await createTimesheetWithClockData({
      employeeId,
      clockInDate,
      clockInTime,
      clockOutDate,
      clockOutTime,
      breakMinutes,
      notes,
    });

    logger.info("Timesheet created successfully with clock data");
    return res.status(201).json({
      success: true,
      message: "Timesheet created successfully",
      data: timesheet,
    });
  } catch (error: any) {
    logger.logApiError("Create timesheet with clock data error", error, req);

    if (
      error.message === "Timesheet for this employee and date already exists" ||
      error.code === "23505"
    ) {
      // PostgreSQL unique constraint violation
      return res.status(409).json({
        success: false,
        message: "Timesheet for this employee and date already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getTimesheetKPIsHandler = async (req: Request, res: Response) => {
  try {
    const { weekStartDate } = req.query;

    if (!weekStartDate || typeof weekStartDate !== "string") {
      return res.status(400).json({
        success: false,
        message: "weekStartDate query parameter is required",
      });
    }

    // Validate that weekStartDate is a Monday
    const date = new Date(weekStartDate);
    if (isNaN(date.getTime())) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid date format for weekStartDate. Please use YYYY-MM-DD format",
      });
    }

    if (date.getDay() !== 1) {
      return res.status(400).json({
        success: false,
        message: "Week start date must be a Monday (start of the work week)",
      });
    }

    const kpis = await getTimesheetKPIs(weekStartDate);

    logger.info("Timesheet KPIs fetched successfully");
    return res.status(200).json({
      success: true,
      message: "Timesheet KPIs retrieved successfully",
      data: kpis,
    });
  } catch (error) {
    logger.logApiError("Get timesheet KPIs error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const approveTimesheetHandler = async (req: Request, res: Response) => {
  try {
    const timesheetId = req.params.id as unknown as number;
    const { approvedBy, notes } = req.body;

    // First check if timesheet exists
    const existingTimesheet = await getTimesheetById(timesheetId);
    if (!existingTimesheet) {
      return res.status(404).json({
        success: false,
        message: "Timesheet not found",
      });
    }

    // Check if timesheet is already approved
    if (existingTimesheet.status === "approved") {
      return res.status(400).json({
        success: false,
        message: "Timesheet is already approved",
      });
    }

    // Role-based approval: Technician → Manager/Executive; Manager → Executive only
    const approvalCheck = await canApproveTimesheet(approvedBy, timesheetId);
    if (!approvalCheck.allowed) {
      return res.status(403).json({
        success: false,
        message: approvalCheck.message ?? "You are not allowed to approve this timesheet",
      });
    }

    const timesheet = await approveTimesheet(timesheetId, approvedBy, notes);

    // Sync hourly payroll for this week (create or update payroll entry from approved timesheets)
    try {
      await syncPayrollFromApprovedTimesheet(timesheetId);
    } catch (payrollError: any) {
      logger.warn(`Payroll sync after timesheet approval failed (timesheet ${timesheetId}): ${payrollError?.message ?? payrollError}`);
      // Approval still succeeds; payroll can be fixed or synced later
    }

    logger.info(`Timesheet ${timesheetId} approved by ${approvedBy}`);
    return res.status(200).json({
      success: true,
      message: "Timesheet approved successfully",
      data: timesheet,
    });
  } catch (error: any) {
    logger.logApiError("Approve timesheet error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const rejectTimesheetHandler = async (req: Request, res: Response) => {
  try {
    const timesheetId = req.params.id as unknown as number;
    const { rejectedBy, rejectionReason, notes } = req.body;

    // First check if timesheet exists
    const existingTimesheet = await getTimesheetById(timesheetId);
    if (!existingTimesheet) {
      return res.status(404).json({
        success: false,
        message: "Timesheet not found",
      });
    }

    // Check if timesheet is already rejected
    if (existingTimesheet.status === "rejected") {
      return res.status(400).json({
        success: false,
        message: "Timesheet is already rejected",
      });
    }

    const timesheet = await rejectTimesheet(
      timesheetId,
      rejectedBy,
      rejectionReason,
      notes
    );

    // Recalc payroll for this employee/week so the rejected day is excluded (hourly only)
    if (timesheet && existingTimesheet?.employeeId != null && existingTimesheet?.sheetDate) {
      try {
        await recalcPayrollForEmployeeWeek(
          Number(existingTimesheet.employeeId),
          existingTimesheet.sheetDate,
        );
      } catch (payrollError: any) {
        logger.warn(
          `Payroll recalc after timesheet reject failed (timesheet ${timesheetId}): ${payrollError?.message ?? payrollError}`,
        );
      }
    }

    logger.info(`Timesheet ${timesheetId} rejected by ${rejectedBy}`);
    return res.status(200).json({
      success: true,
      message: "Timesheet rejected successfully",
      data: timesheet,
    });
  } catch (error: any) {
    logger.logApiError("Reject timesheet error", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
