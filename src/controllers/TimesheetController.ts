import type { Request, Response } from "express";
import {
  getTimesheets,
  getTimesheetById,
  createTimesheet,
  updateTimesheet,
  deleteTimesheet,
} from "../services/timesheet.service.js";
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

export const getTimesheetByIdHandler = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as unknown as number;

    const timesheet = await getTimesheetById(id);
    if (!timesheet) {
      return res.status(404).send("Timesheet not found");
    }

    logger.info("Timesheet fetched successfully");
    return res.status(200).send(timesheet);
  } catch (error) {
    logger.logApiError("Timesheet error", error, req);
    return res.status(500).send("Internal server error");
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
      status,
      submittedBy,
      approvedBy,
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
      status,
      submittedBy,
      approvedBy,
    });
    logger.info("Timesheet created successfully");
    return res.status(201).send(timesheet);
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
      submittedBy,
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
    if (submittedBy !== undefined) updateData.submittedBy = submittedBy;
    if (approvedBy !== undefined) updateData.approvedBy = approvedBy;

    const timesheet = await updateTimesheet(id, updateData);
    if (!timesheet) {
      return res.status(404).send("Timesheet not found");
    }

    logger.info("Timesheet updated successfully");
    return res.status(200).send(timesheet);
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
    return res.status(200).send("Timesheet deleted successfully");
  } catch (error) {
    logger.logApiError("Timesheet error", error, req);
    return res.status(500).send("Internal server error");
  }
};
