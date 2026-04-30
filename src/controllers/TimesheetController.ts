import type { Request, Response } from "express";
import { uploadToSpaces } from "../services/storage.service.js";
import {
  getTimesheets,
  getTimesheetById,
  createTimesheet,
  updateTimesheet,
  deleteTimesheet,
  approveTimesheet,
  canApproveTimesheet,
  rejectTimesheet,
  getTimesheetsByEmployee,
  getWeeklyTimesheetsByEmployee,
  getMyWeeklyTimesheets,
  getTimesheetKPIs,
  bulkDeleteTimesheets,
  approveWeek,
  rejectWeek,
  confirmWeek,
  logManualTime,
  updateTimesheetJobEntry,
  getMyTimesheetHistory,
  getCoverageEntriesForJob,
} from "../services/timesheet.service.js";
import {
  syncPayrollFromApprovedTimesheet,
  recalcPayrollForEmployeeWeek,
} from "../services/payroll.service.js";
import { logger } from "../utils/logger.js";
import { formatLocalDateStringFromDate } from "../utils/naive-datetime.js";
import { STALE_DATA, staleDataResponse } from "../utils/optimistic-lock.js";
import { getDataFilterConditions } from "../services/featurePermission.service.js";
import { db } from "../config/db.js";
import { eq } from "drizzle-orm";
import { employees } from "../drizzle/schema/org.schema.js";

export const getTimesheetsHandler = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string | undefined;
    const offset = (page - 1) * limit;
    const userId = req.user?.id;

    let timesheetOptions: {
      ownEmployeeId?: number;
      departmentId?: number;
      allTechnicians?: boolean;
      prioritizeEmployeeId?: number;
    } | undefined;

    if (userId) {
      // Always resolve the current user's employee record so their rows sort first
      const [emp] = await db
        .select({ id: employees.id })
        .from(employees)
        .where(eq(employees.userId, userId))
        .limit(1);

      const dataFilter = await getDataFilterConditions(userId, "timesheet");
      if (dataFilter.ownOnly) {
        if (emp) timesheetOptions = { ownEmployeeId: emp.id, prioritizeEmployeeId: emp.id };
      } else if (dataFilter.ownAndTechnicians) {
        // Manager sees their own logs + all technicians' logs, own rows float to top
        timesheetOptions = {
          ...(emp ? { ownEmployeeId: emp.id, prioritizeEmployeeId: emp.id } : {}),
          allTechnicians: true,
        };
      } else if (dataFilter.departmentOnly && dataFilter.departmentId) {
        timesheetOptions = {
          departmentId: dataFilter.departmentId,
          ...(emp ? { prioritizeEmployeeId: emp.id } : {}),
        };
      } else {
        // Executive / no filter — sees all, but own rows still float to top
        if (emp) timesheetOptions = { prioritizeEmployeeId: emp.id };
      }
    }

    const timesheets = await getTimesheets(offset, limit, search, timesheetOptions);

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

export const getTimesheetsByEmployeeHandler = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string | undefined;
    const employeeId = req.query.employeeId as string | undefined;
    const dateFrom = req.query.dateFrom as string | undefined;
    const dateTo = req.query.dateTo as string | undefined;
    const offset = (page - 1) * limit;

    const timesheets = await getTimesheetsByEmployee(
      offset, limit, search, employeeId, dateFrom, dateTo,
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
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getMyTimesheetsHandler = async (req: Request, res: Response) => {
  try {
    const { weekStartDate, search } = req.query;

    let startDate: string;
    if (weekStartDate) {
      startDate = weekStartDate as string;
    } else {
      const now = new Date();
      const currentDay = now.getDay();
      const daysToSubtract = currentDay === 0 ? 6 : currentDay - 1;
      const monday = new Date(now);
      monday.setDate(now.getDate() - daysToSubtract);
      startDate = formatLocalDateStringFromDate(monday);
    }

    const currentUser = (req as any).user;
    if (!currentUser || !currentUser.employeeId) {
      return res.status(400).json({
        success: false,
        message: "Employee information not found. Please ensure you are properly logged in as an employee.",
      });
    }

    const myWeeklyTimesheets = await getMyWeeklyTimesheets(
      currentUser.employeeId,
      startDate,
      search as string | undefined,
    );

    logger.info(`My weekly timesheets fetched for employee: ${currentUser.employeeId}, week: ${startDate}`);
    return res.status(200).json({
      success: true,
      message: "Your weekly timesheets retrieved successfully",
      data: myWeeklyTimesheets,
      employeeId: currentUser.employeeId,
    });
  } catch (error) {
    logger.logApiError("Get my weekly timesheets error", error, req);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getWeeklyTimesheetsByEmployeeHandler = async (req: Request, res: Response) => {
  try {
    const { weekStartDate, employeeId, departmentId, status, page, limit } = req.query;

    let employeeIds: number[] | undefined;
    if (employeeId) {
      if (Array.isArray(employeeId)) {
        employeeIds = employeeId.map((id) => parseInt(id as string, 10)).filter((id) => !isNaN(id));
      } else {
        const str = employeeId.toString().trim();
        const cleaned = str.replace(/^\[|\]$/g, "");
        const ids = cleaned
          .split(",")
          .map((id) => parseInt(id.trim(), 10))
          .filter((id) => !isNaN(id) && id > 0);
        employeeIds = ids.length > 0 ? ids : undefined;
      }
    }

    let effectiveDepartmentId: number | undefined = departmentId
      ? parseInt(departmentId as string, 10)
      : undefined;

    let prioritizeEmployeeId: number | undefined;
    let allTechnicians: boolean = false;

    const userId = req.user?.id;
    if (userId) {
      // Always resolve the current user's employee record so their card sorts first
      const [emp] = await db
        .select({ id: employees.id })
        .from(employees)
        .where(eq(employees.userId, userId))
        .limit(1);
      if (emp) prioritizeEmployeeId = emp.id;

      const dataFilter = await getDataFilterConditions(userId, "timesheet");
      if (dataFilter.ownAndTechnicians) {
        // Manager: own card + all technicians — no department restriction
        allTechnicians = true;
        effectiveDepartmentId = undefined;
      } else if (dataFilter.departmentOnly && dataFilter.departmentId) {
        effectiveDepartmentId = dataFilter.departmentId;
      }
    }

    const weeklyTimesheets = await getWeeklyTimesheetsByEmployee(
      weekStartDate as string,
      employeeIds,
      effectiveDepartmentId,
      status as string | undefined,
      page ? parseInt(page as string, 10) : 1,
      limit ? parseInt(limit as string, 10) : 10,
      prioritizeEmployeeId,
      allTechnicians,
    );

    logger.info("Weekly timesheets by employee fetched successfully");
    return res.status(200).json({
      success: true,
      message: "Weekly timesheets grouped by employee retrieved successfully",
      data: weeklyTimesheets,
    });
  } catch (error) {
    logger.logApiError("Weekly timesheet by employee error", error, req);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getTimesheetByIdHandler = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as unknown as number;
    const timesheet = await getTimesheetById(id);
    if (!timesheet) {
      return res.status(404).json({ success: false, message: "Timesheet not found" });
    }

    const userId = req.user?.id;
    if (userId) {
      const dataFilter = await getDataFilterConditions(userId, "timesheet");
      if (dataFilter.ownOnly) {
        const [emp] = await db
          .select({ id: employees.id })
          .from(employees)
          .where(eq(employees.userId, userId))
          .limit(1);
        if (!emp || timesheet.employeeId !== emp.id) {
          return res.status(403).json({
            success: false,
            message: "Access denied. You can only view your own timesheets.",
          });
        }
      } else if (dataFilter.departmentOnly && dataFilter.departmentId) {
        const [timesheetEmp] = await db
          .select({ departmentId: employees.departmentId })
          .from(employees)
          .where(eq(employees.id, timesheet.employeeId!))
          .limit(1);
        if (!timesheetEmp || timesheetEmp.departmentId !== dataFilter.departmentId) {
          return res.status(403).json({
            success: false,
            message: "Access denied. You can only view timesheets for your department.",
          });
        }
      }
    }

    logger.info("Timesheet fetched successfully");
    return res.status(200).json({ success: true, data: timesheet });
  } catch (error) {
    logger.logApiError("Timesheet error", error, req);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const createTimesheetHandler = async (req: Request, res: Response) => {
  try {
    const { employeeId, sheetDate, breakMinutes, totalHours, overtimeHours, notes } = req.body;

    const timesheet = await createTimesheet({
      employeeId,
      sheetDate,
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
      return res.status(409).json({
        success: false,
        message: "Timesheet for this employee and date already exists",
      });
    }
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const updateTimesheetHandler = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as unknown as number;
    const userId = req.user?.id;

    if (req.userAccessLevel === "edit_own") {
      if (!userId) {
        return res.status(403).json({ success: false, message: "Authentication required" });
      }
      const existing = await getTimesheetById(id);
      if (!existing) {
        return res.status(404).json({ success: false, message: "Timesheet not found" });
      }
      const [emp] = await db
        .select({ id: employees.id })
        .from(employees)
        .where(eq(employees.userId, userId))
        .limit(1);
      if (!emp || existing.employeeId !== emp.id) {
        return res.status(403).json({
          success: false,
          message: "You can only edit your own timesheets",
        });
      }
    }

    const {
      employeeId,
      sheetDate,
      breakMinutes,
      totalHours,
      overtimeHours,
      notes,
      status,
      rejectedBy,
      approvedBy,
      updatedAt: clientUpdatedAt,
    } = req.body;

    const updateData: any = {};
    if (employeeId !== undefined) updateData.employeeId = employeeId;
    if (sheetDate !== undefined) updateData.sheetDate = sheetDate;
    if (breakMinutes !== undefined) updateData.breakMinutes = breakMinutes;
    if (totalHours !== undefined) updateData.totalHours = totalHours;
    if (overtimeHours !== undefined) updateData.overtimeHours = overtimeHours;
    if (notes !== undefined) updateData.notes = notes;
    if (status !== undefined) updateData.status = status;
    if (rejectedBy !== undefined) updateData.rejectedBy = rejectedBy;
    if (approvedBy !== undefined) updateData.approvedBy = approvedBy;

    const timesheet = await updateTimesheet(id, updateData, clientUpdatedAt);

    if (timesheet === STALE_DATA) return res.status(409).json(staleDataResponse);
    if (!timesheet) {
      return res.status(404).json({ success: false, message: "Timesheet not found" });
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
      return res.status(409).send("Timesheet for this employee and date already exists");
    }
    return res.status(500).send("Internal server error");
  }
};

export const deleteTimesheetHandler = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as unknown as number;
    const userId = req.user?.id;
    if (!userId) {
      return res.status(403).json({ success: false, message: "Authentication required" });
    }

    if (req.userAccessLevel === "delete_own") {
      const existing = await getTimesheetById(id);
      if (!existing) {
        return res.status(404).json({ success: false, message: "Timesheet not found" });
      }
      const [emp] = await db
        .select({ id: employees.id })
        .from(employees)
        .where(eq(employees.userId, userId))
        .limit(1);
      if (!emp || existing.employeeId !== emp.id) {
        return res.status(403).json({
          success: false,
          message: "You can only delete your own timesheets",
        });
      }
    }

    const timesheet = await deleteTimesheet(id, userId);
    if (!timesheet) return res.status(404).send("Timesheet not found");

    logger.info("Timesheet deleted successfully");
    return res.status(200).json({ success: true, message: "Timesheet deleted successfully" });
  } catch (error) {
    logger.logApiError("Timesheet error", error, req);
    return res.status(500).json({ success: false, message: "Internal server error" });
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

    const date = new Date(weekStartDate);
    if (isNaN(date.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format for weekStartDate. Please use YYYY-MM-DD format",
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
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const approveTimesheetHandler = async (req: Request, res: Response) => {
  try {
    const timesheetId = req.params.id as unknown as number;
    const { approvedBy, notes } = req.body;

    const existingTimesheet = await getTimesheetById(timesheetId);
    if (!existingTimesheet) {
      return res.status(404).json({ success: false, message: "Timesheet not found" });
    }

    if (existingTimesheet.status === "approved") {
      return res.status(400).json({ success: false, message: "Timesheet is already approved" });
    }

    const approvalCheck = await canApproveTimesheet(approvedBy, timesheetId);
    if (!approvalCheck.allowed) {
      return res.status(403).json({
        success: false,
        message: approvalCheck.message ?? "You are not allowed to approve this timesheet",
      });
    }

    const timesheet = await approveTimesheet(timesheetId, approvedBy, notes);

    let payrollSync: { synced: boolean; reason?: string } = { synced: false };
    try {
      payrollSync = await syncPayrollFromApprovedTimesheet(timesheetId);
    } catch (payrollError: any) {
      logger.warn(`Payroll sync after timesheet approval failed (timesheet ${timesheetId}): ${payrollError?.message ?? payrollError}`);
      payrollSync = { synced: false, reason: payrollError?.message ?? "Payroll sync failed" };
    }

    logger.info(`Timesheet ${timesheetId} approved by ${approvedBy}`);
    return res.status(200).json({
      success: true,
      message: "Timesheet approved successfully",
      data: timesheet,
      payrollSync,
    });
  } catch (error: any) {
    logger.logApiError("Approve timesheet error", error, req);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const rejectTimesheetHandler = async (req: Request, res: Response) => {
  try {
    const timesheetId = req.params.id as unknown as number;
    const { rejectedBy, rejectionReason, notes } = req.body;

    const existingTimesheet = await getTimesheetById(timesheetId);
    if (!existingTimesheet) {
      return res.status(404).json({ success: false, message: "Timesheet not found" });
    }

    if (existingTimesheet.status === "rejected") {
      return res.status(400).json({ success: false, message: "Timesheet is already rejected" });
    }

    const timesheet = await rejectTimesheet(timesheetId, rejectedBy, rejectionReason, notes);

    if (timesheet && existingTimesheet?.employeeId != null && existingTimesheet?.sheetDate) {
      try {
        await recalcPayrollForEmployeeWeek(
          Number(existingTimesheet.employeeId),
          existingTimesheet.sheetDate,
        );
      } catch (payrollError: any) {
        logger.warn(`Payroll recalc after timesheet reject failed (timesheet ${timesheetId}): ${payrollError?.message ?? payrollError}`);
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
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ===========================================================================
// Weekly Bulk Actions (approve / reject / confirm full week)
// ===========================================================================

export const approveWeekHandler = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(403).json({ success: false, message: "Authentication required" });
    }

    const { employeeId, weekStart, weekEnd, notes } = req.body;
    if (!employeeId || !weekStart || !weekEnd) {
      return res.status(400).json({
        success: false,
        message: "employeeId, weekStart, and weekEnd are required",
      });
    }

    const result = await approveWeek(Number(employeeId), weekStart, weekEnd, userId, notes);

    logger.info(`Week approved for employee ${employeeId} (${weekStart} – ${weekEnd}) by ${userId}`);
    return res.status(200).json({
      success: true,
      message: `${result.approved} timesheet day(s) approved for the week`,
      data: result,
    });
  } catch (error) {
    logger.logApiError("Approve week error", error, req);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const rejectWeekHandler = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(403).json({ success: false, message: "Authentication required" });
    }

    const { employeeId, weekStart, weekEnd, rejectionReason, notes } = req.body;
    if (!employeeId || !weekStart || !weekEnd || !rejectionReason) {
      return res.status(400).json({
        success: false,
        message: "employeeId, weekStart, weekEnd, and rejectionReason are required",
      });
    }

    const result = await rejectWeek(
      Number(employeeId),
      weekStart,
      weekEnd,
      userId,
      rejectionReason,
      notes,
    );

    logger.info(`Week rejected for employee ${employeeId} (${weekStart} – ${weekEnd}) by ${userId}`);
    return res.status(200).json({
      success: true,
      message: `${result.rejected} timesheet day(s) rejected for the week`,
      data: result,
    });
  } catch (error) {
    logger.logApiError("Reject week error", error, req);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const confirmWeekHandler = async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    if (!currentUser?.employeeId) {
      return res.status(400).json({
        success: false,
        message: "Employee information not found. Please ensure you are properly logged in as an employee.",
      });
    }

    const { weekStart, weekEnd, notes } = req.body;
    if (!weekStart || !weekEnd) {
      return res.status(400).json({
        success: false,
        message: "weekStart and weekEnd are required",
      });
    }

    const result = await confirmWeek(currentUser.employeeId, weekStart, weekEnd, notes);

    logger.info(`Week confirmed by employee ${currentUser.employeeId} (${weekStart} – ${weekEnd})`);
    return res.status(200).json({
      success: true,
      message: "Week confirmed successfully",
      data: result,
    });
  } catch (error) {
    logger.logApiError("Confirm week error", error, req);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ===========================================================================
// Manual / Coverage Time Logging
// ===========================================================================

/**
 * POST /api/v1/org/timesheets/log-time
 * Available to techs (logs for self) and managers (supply employeeId in body).
 */
export const logTimeHandler = async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    if (!currentUser) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const { employeeId: bodyEmployeeId, jobId, sheetDate, timeIn, timeOut, breakMinutes, entryType, notes, mediaUrls } = req.body;

    // Determine whose timesheet to log against
    let targetEmployeeId: number;
    if (bodyEmployeeId) {
      // Manager is logging on behalf of a tech
      targetEmployeeId = bodyEmployeeId;
    } else {
      // Tech is logging for themselves
      if (!currentUser.employeeId) {
        return res.status(400).json({
          success: false,
          message: "Employee information not found. Please ensure you are logged in as an employee.",
        });
      }
      targetEmployeeId = currentUser.employeeId;
    }

    const result = await logManualTime({
      employeeId: targetEmployeeId,
      ...(jobId !== undefined && jobId !== null ? { jobId } : {}),
      sheetDate,
      timeIn,
      timeOut,
      breakMinutes: breakMinutes ?? 0,
      entryType: entryType ?? "manual",
      ...(notes !== undefined && notes !== null ? { notes } : {}),
      ...(Array.isArray(mediaUrls) ? { mediaUrls } : {}),
      createdBy: currentUser.id,
    });

    logger.info(
      `Time logged manually: employee=${targetEmployeeId}, date=${sheetDate}, hours=${result.jobEntry?.hours}, by=${currentUser.id}`,
    );

    return res.status(201).json({
      success: true,
      message: "Time logged successfully",
      data: {
        timesheet: result.timesheet,
        jobEntry: result.jobEntry,
        jobEntries: result.jobEntries,
      },
      caWarnings: result.caWarnings,
    });
  } catch (error: any) {
    if (error?.message?.includes("blocked")) {
      return res.status(403).json({ success: false, message: error.message });
    }
    logger.logApiError("Log time error", error, req);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * GET /api/v1/org/timesheets/my-history
 * Returns a flat paginated list of a tech's own time-block history.
 */
export const getMyHistoryHandler = async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    if (!currentUser || !currentUser.employeeId) {
      return res.status(400).json({
        success: false,
        message: "Employee information not found. Please ensure you are logged in as an employee.",
      });
    }

    const {
      page, limit, dateFrom, dateTo, jobId, status, sortBy, sortOrder, search,
    } = req.query;

    const result = await getMyTimesheetHistory(currentUser.employeeId, {
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 20,
      ...(dateFrom != null && String(dateFrom) ? { dateFrom: String(dateFrom) } : {}),
      ...(dateTo != null && String(dateTo) ? { dateTo: String(dateTo) } : {}),
      ...(jobId != null && String(jobId) ? { jobId: String(jobId) } : {}),
      ...(status != null && String(status) ? { status: String(status) } : {}),
      sortBy: (sortBy as "date" | "hours") ?? "date",
      sortOrder: (sortOrder as "asc" | "desc") ?? "desc",
      ...(search != null && String(search) ? { search: String(search) } : {}),
    });

    logger.info(`My timesheet history fetched for employee: ${currentUser.employeeId}`);
    return res.status(200).json({
      success: true,
      data: result.data,
      total: result.total,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.logApiError("Get my history error", error, req);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ===========================================================================
// Update a timesheetJobEntry (coverage / manual entry edit)
// ===========================================================================

export const updateTimesheetJobEntryHandler = async (req: Request, res: Response) => {
  try {
    const currentUser = (req as Request & { user?: { id: string; employeeId?: number } }).user;
    if (!currentUser) return res.status(401).json({ success: false, message: "Unauthorized" });

    const entryId = parseInt(String(req.params.entryId), 10);
    if (!entryId || isNaN(entryId)) {
      return res.status(400).json({ success: false, message: "Entry ID is required" });
    }

    const { timeIn, timeOut, breakMinutes, notes } = req.body as {
      timeIn: string;
      timeOut: string;
      breakMinutes: number;
      notes?: string;
    };

    const updated = await updateTimesheetJobEntry(entryId, {
      timeIn,
      timeOut,
      breakMinutes: breakMinutes ?? 0,
      ...(notes !== undefined && { notes }),
    });

    if (!updated) {
      return res.status(404).json({ success: false, message: "Entry not found" });
    }

    logger.info(
      `TimesheetJobEntry updated: entryId=${entryId}, by=${currentUser.id}`,
    );
    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    logger.logApiError("Update timesheet job entry error", error, req);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ===========================================================================
// Coverage entries for a job (for labor tab badges)
// ===========================================================================

export const getCoverageEntriesForJobHandler = async (req: Request, res: Response) => {
  try {
    const rawJobId = req.params.jobId;
    const jobId = Array.isArray(rawJobId) ? rawJobId[0] : rawJobId;
    if (!jobId) {
      return res.status(400).json({ success: false, message: "Job ID is required" });
    }
    const entries = await getCoverageEntriesForJob(String(jobId));
    return res.status(200).json({ success: true, data: entries });
  } catch (error) {
    logger.logApiError("Get coverage entries error", error, req);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ===========================================================================
// Bulk Delete
// ===========================================================================

export const bulkDeleteTimesheetsHandler = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(403).json({ success: false, message: "Authentication required" });
    }

    const { ids } = req.body as { ids: number[] };
    const result = await bulkDeleteTimesheets(ids, userId);

    logger.info(`Bulk deleted ${result.deleted} timesheets by ${userId}`);
    return res.status(200).json({
      success: true,
      message: `${result.deleted} timesheet(s) deleted. ${result.skipped} skipped (already deleted or not found).`,
      data: result,
    });
  } catch (error) {
    logger.logApiError("Bulk delete timesheets error", error, req);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ===========================================================================
// Media upload
// ===========================================================================

/**
 * POST /api/v1/org/timesheets/upload-media
 * Accepts a single file (multipart/form-data field "file"),
 * uploads it to DigitalOcean Spaces under "timesheet-media/",
 * and returns the public URL.
 */
export const uploadTimesheetMediaHandler = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) {
      return res.status(400).json({ success: false, message: "No file provided. Send a file in the 'file' field." });
    }

    const result = await uploadToSpaces(file.buffer, file.originalname, "timesheet-media");

    return res.status(200).json({
      success: true,
      message: "File uploaded successfully",
      url: result.url,
      filePath: result.filePath,
    });
  } catch (error: any) {
    logger.logApiError("Timesheet media upload error", error, req);
    return res.status(500).json({
      success: false,
      message: error?.message || "Failed to upload file",
    });
  }
};
