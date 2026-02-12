import type { Request, Response } from "express";
import { asSingleString } from "../utils/request-helpers.js";
import {
  parseDatabaseError,
  isDatabaseError,
} from "../utils/database-error-parser.js";
import { uploadToSpaces } from "../services/storage.service.js";
import {
  getDispatchTasks,
  getDispatchTaskById,
  createDispatchTask,
  updateDispatchTask,
  deleteDispatchTask,
  getDispatchAssignments,
  getDispatchAssignmentById,
  createDispatchAssignment,
  updateDispatchAssignment,
  deleteDispatchAssignment,
  getAssignmentsByTaskId,
  getAssignmentsByTechnicianId,
  getAvailableEmployeesForDispatch,
  getEmployeesWithAssignedTasks,
  getDispatchKPIs,
} from "../services/dispatch.service.js";
import { logger } from "../utils/logger.js";

// ============================
// DISPATCH TASKS HANDLERS
// ============================

export const getDispatchTasksHandler = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const {
      search,
      jobId,
      status,
      taskType,
      priority,
      startDate,
      endDate,
      sortBy,
      sortOrder,
    } = req.query;

    const offset = (page - 1) * limit;

    const filters: any = {};

    if (search) filters.search = search as string;
    if (jobId) filters.jobId = jobId as string;
    if (status) filters.status = status as string;
    if (taskType) filters.taskType = taskType as string;
    if (priority) filters.priority = priority as string;
    if (startDate) filters.startDate = startDate as string;
    if (endDate) filters.endDate = endDate as string;
    if (sortBy) filters.sortBy = sortBy as string;
    if (sortOrder) filters.sortOrder = sortOrder as "asc" | "desc";

    const result = await getDispatchTasks(offset, limit, filters);

    logger.info("Dispatch tasks fetched successfully");
    return res.status(200).json({
      success: true,
      data: result.data,
      total: result.total,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.logApiError("Error fetching dispatch tasks", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getDispatchTaskByIdHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const id = asSingleString(req.params.id);
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Dispatch task ID is required",
      });
    }

    const task = await getDispatchTaskById(id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Dispatch task not found",
      });
    }

    logger.info(`Dispatch task ${id} fetched successfully`);
    return res.status(200).json({
      success: true,
      data: task,
    });
  } catch (error) {
    logger.logApiError("Error fetching dispatch task", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const createDispatchTaskHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const taskData = { ...req.body };
    const createdBy = req.user?.id;
    if (createdBy) (taskData as any).createdBy = createdBy;

    // Handle file uploads (attachments_0, attachments_1, ...) and store URLs in attachments
    const files = (req.files as Express.Multer.File[]) || [];
    const attachmentFiles = files.filter((file) =>
      file.fieldname.startsWith("attachments_"),
    );
    if (attachmentFiles.length > 0) {
      const uploadedUrls: string[] = [];
      for (const file of attachmentFiles) {
        try {
          const uploadResult = await uploadToSpaces(
            file.buffer,
            file.originalname,
            "dispatch-task-attachments",
          );
          uploadedUrls.push(uploadResult.url);
        } catch (uploadError: any) {
          logger.logApiError(
            `Error uploading attachment ${file.originalname}`,
            uploadError,
            req,
          );
        }
      }
      taskData.attachments = [
        ...(Array.isArray(taskData.attachments) ? taskData.attachments : []),
        ...uploadedUrls,
      ];
    }

    const newTask = await createDispatchTask(taskData);

    if (!newTask) {
      return res.status(500).json({
        success: false,
        message: "Failed to create dispatch task",
      });
    }

    logger.info(`Dispatch task ${newTask.id} created successfully`);
    return res.status(201).json({
      success: true,
      data: newTask,
      message: "Dispatch task created successfully",
    });
  } catch (error: any) {
    logger.logApiError("Error creating dispatch task", error, req);
    if (isDatabaseError(error)) {
      const parsedError = parseDatabaseError(error);
      return res.status(parsedError.statusCode).json({
        success: false,
        message: parsedError.userMessage,
        errorCode: parsedError.errorCode,
        suggestions: parsedError.suggestions,
      });
    }
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

export const updateDispatchTaskHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const id = asSingleString(req.params.id);
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Dispatch task ID is required",
      });
    }
    const updateData = { ...req.body };

    // Handle file uploads (attachments_0, attachments_1, ...) and append URLs to attachments
    const files = (req.files as Express.Multer.File[]) || [];
    const attachmentFiles = files.filter((file) =>
      file.fieldname.startsWith("attachments_"),
    );
    if (attachmentFiles.length > 0) {
      const uploadedUrls: string[] = [];
      for (const file of attachmentFiles) {
        try {
          const uploadResult = await uploadToSpaces(
            file.buffer,
            file.originalname,
            "dispatch-task-attachments",
          );
          uploadedUrls.push(uploadResult.url);
        } catch (uploadError: any) {
          logger.logApiError(
            `Error uploading attachment ${file.originalname}`,
            uploadError,
            req,
          );
        }
      }
      updateData.attachments = [
        ...(Array.isArray(updateData.attachments)
          ? updateData.attachments
          : []),
        ...uploadedUrls,
      ];
    }

    const updatedTask = await updateDispatchTask(id, updateData);

    if (!updatedTask) {
      return res.status(404).json({
        success: false,
        message: "Dispatch task not found",
      });
    }

    logger.info(`Dispatch task ${id} updated successfully`);
    return res.status(200).json({
      success: true,
      data: updatedTask,
      message: "Dispatch task updated successfully",
    });
  } catch (error: any) {
    logger.logApiError("Error updating dispatch task", error, req);
    if (isDatabaseError(error)) {
      const parsedError = parseDatabaseError(error);
      return res.status(parsedError.statusCode).json({
        success: false,
        message: parsedError.userMessage,
        errorCode: parsedError.errorCode,
        suggestions: parsedError.suggestions,
      });
    }
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

export const deleteDispatchTaskHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const id = asSingleString(req.params.id);
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Dispatch task ID is required",
      });
    }

    const deletedTask = await deleteDispatchTask(id);

    if (!deletedTask) {
      return res.status(404).json({
        success: false,
        message: "Dispatch task not found",
      });
    }

    logger.info(`Dispatch task ${id} deleted successfully`);
    return res.status(200).json({
      success: true,
      message: "Dispatch task deleted successfully",
    });
  } catch (error) {
    logger.logApiError("Error deleting dispatch task", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================
// DISPATCH ASSIGNMENTS HANDLERS
// ============================

export const getDispatchAssignmentsHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const { taskId, technicianId, status, sortBy, sortOrder } = req.query;

    const offset = (page - 1) * limit;

    const filters: any = {};

    if (taskId) filters.taskId = taskId as string;
    if (technicianId) filters.technicianId = parseInt(technicianId as string);
    if (status) filters.status = status as string;
    if (sortBy) filters.sortBy = sortBy as string;
    if (sortOrder) filters.sortOrder = sortOrder as "asc" | "desc";

    const result = await getDispatchAssignments(offset, limit, filters);

    logger.info("Dispatch assignments fetched successfully");
    return res.status(200).json({
      success: true,
      data: result.data,
      total: result.total,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.logApiError("Error fetching dispatch assignments", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getDispatchAssignmentByIdHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const id = asSingleString(req.params.id);
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Dispatch assignment ID is required",
      });
    }

    const assignment = await getDispatchAssignmentById(id);

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Dispatch assignment not found",
      });
    }

    logger.info(`Dispatch assignment ${id} fetched successfully`);
    return res.status(200).json({
      success: true,
      data: assignment,
    });
  } catch (error) {
    logger.logApiError("Error fetching dispatch assignment", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const createDispatchAssignmentHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const assignmentData = req.body;

    const newAssignment = await createDispatchAssignment(assignmentData);

    if (!newAssignment) {
      return res.status(500).json({
        success: false,
        message: "Failed to create dispatch assignment",
      });
    }

    logger.info(`Dispatch assignment ${newAssignment.id} created successfully`);
    return res.status(201).json({
      success: true,
      data: newAssignment,
      message: "Dispatch assignment created successfully",
    });
  } catch (error: any) {
    logger.logApiError("Error creating dispatch assignment", error, req);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

export const updateDispatchAssignmentHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const id = asSingleString(req.params.id);
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Dispatch assignment ID is required",
      });
    }
    const updateData = req.body;

    const updatedAssignment = await updateDispatchAssignment(id, updateData);

    if (!updatedAssignment) {
      return res.status(404).json({
        success: false,
        message: "Dispatch assignment not found",
      });
    }

    logger.info(`Dispatch assignment ${id} updated successfully`);
    return res.status(200).json({
      success: true,
      data: updatedAssignment,
      message: "Dispatch assignment updated successfully",
    });
  } catch (error) {
    logger.logApiError("Error updating dispatch assignment", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const deleteDispatchAssignmentHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const id = asSingleString(req.params.id);
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Dispatch assignment ID is required",
      });
    }

    const deletedAssignment = await deleteDispatchAssignment(id);

    if (!deletedAssignment) {
      return res.status(404).json({
        success: false,
        message: "Dispatch assignment not found",
      });
    }

    logger.info(`Dispatch assignment ${id} deleted successfully`);
    return res.status(200).json({
      success: true,
      message: "Dispatch assignment deleted successfully",
    });
  } catch (error) {
    logger.logApiError("Error deleting dispatch assignment", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getAssignmentsByTaskIdHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const taskId = asSingleString(req.params.taskId);
    if (!taskId) {
      return res.status(400).json({
        success: false,
        message: "Task ID is required",
      });
    }

    const assignments = await getAssignmentsByTaskId(taskId);

    logger.info(`Assignments for task ${taskId} fetched successfully`);
    return res.status(200).json({
      success: true,
      data: assignments,
    });
  } catch (error) {
    logger.logApiError("Error fetching assignments by task ID", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getAssignmentsByTechnicianIdHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const technicianId = asSingleString(req.params.technicianId);
    const { date, startDate, endDate, status } = req.query;

    if (!technicianId) {
      return res.status(400).json({
        success: false,
        message: "Technician ID is required",
      });
    }

    const filters: any = {};
    if (date) filters.date = date as string;
    if (startDate) filters.startDate = startDate as string;
    if (endDate) filters.endDate = endDate as string;
    if (status) filters.status = status as string;

    const assignments = await getAssignmentsByTechnicianId(
      parseInt(technicianId),
      filters,
    );

    logger.info(
      `Assignments for technician ${technicianId} fetched successfully`,
    );
    return res.status(200).json({
      success: true,
      data: assignments,
    });
  } catch (error) {
    logger.logApiError(
      "Error fetching assignments by technician ID",
      error,
      req,
    );
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================
// AVAILABLE EMPLOYEES (for dispatch - who can be assigned)
// ============================

export const getAvailableEmployeesHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    const result = await getAvailableEmployeesForDispatch(offset, limit);

    logger.info("Available employees for dispatch fetched successfully");
    return res.status(200).json({
      success: true,
      data: result.data,
      total: result.total,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.logApiError(
      "Error fetching available employees for dispatch",
      error,
      req,
    );
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================
// EMPLOYEES WITH ASSIGNED TASKS
// ============================

export const getEmployeesWithAssignedTasksHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as string | undefined;
    const offset = (page - 1) * limit;

    const result = await getEmployeesWithAssignedTasks(offset, limit, {
      ...(status && { status }),
    });

    logger.info("Employees with assigned tasks fetched successfully");
    return res.status(200).json({
      success: true,
      data: result.data,
      total: result.total,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.logApiError(
      "Error fetching employees with assigned tasks",
      error,
      req,
    );
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================
// DISPATCH KPIs
// ============================

export const getDispatchKPIsHandler = async (req: Request, res: Response) => {
  try {
    const kpis = await getDispatchKPIs();

    logger.info("Dispatch KPIs fetched successfully");
    return res.status(200).json({
      success: true,
      data: kpis,
    });
  } catch (error: any) {
    logger.logApiError("Error fetching dispatch KPIs", error, req);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};
