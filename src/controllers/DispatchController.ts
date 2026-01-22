import type { Request, Response } from "express";
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
  getTechnicianAvailability,
  getTechnicianAvailabilityById,
  createTechnicianAvailability,
  updateTechnicianAvailability,
  deleteTechnicianAvailability,
  getAvailabilityByEmployeeId,
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
      assignedVehicleId,
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
    if (assignedVehicleId) filters.assignedVehicleId = assignedVehicleId as string;
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
  res: Response
) => {
  try {
    const { id } = req.params;
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
  res: Response
) => {
  try {
    const taskData = req.body;

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
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

export const updateDispatchTaskHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Dispatch task ID is required",
      });
    }
    const updateData = req.body;

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
  } catch (error) {
    logger.logApiError("Error updating dispatch task", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const deleteDispatchTaskHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;
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
  res: Response
) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const {
      taskId,
      technicianId,
      status,
      sortBy,
      sortOrder,
    } = req.query;

    const offset = (page - 1) * limit;

    const filters: any = {};

    if (taskId) filters.taskId = taskId as string;
    if (technicianId)
      filters.technicianId = parseInt(technicianId as string);
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
  res: Response
) => {
  try {
    const { id } = req.params;
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
  res: Response
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
  res: Response
) => {
  try {
    const { id } = req.params;
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
  res: Response
) => {
  try {
    const { id } = req.params;
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
  res: Response
) => {
  try {
    const { taskId } = req.params;
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
  res: Response
) => {
  try {
    const { technicianId } = req.params;
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
      filters
    );

    logger.info(
      `Assignments for technician ${technicianId} fetched successfully`
    );
    return res.status(200).json({
      success: true,
      data: assignments,
    });
  } catch (error) {
    logger.logApiError(
      "Error fetching assignments by technician ID",
      error,
      req
    );
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================
// TECHNICIAN AVAILABILITY HANDLERS
// ============================

export const getTechnicianAvailabilityHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const {
      employeeId,
      date,
      status,
      startDate,
      endDate,
      sortBy,
      sortOrder,
    } = req.query;

    const offset = (page - 1) * limit;

    const filters: any = {};

    if (employeeId) filters.employeeId = parseInt(employeeId as string);
    if (date) filters.date = date as string;
    if (status) filters.status = status as string;
    if (startDate) filters.startDate = startDate as string;
    if (endDate) filters.endDate = endDate as string;
    if (sortBy) filters.sortBy = sortBy as string;
    if (sortOrder) filters.sortOrder = sortOrder as "asc" | "desc";

    const result = await getTechnicianAvailability(offset, limit, filters);

    logger.info("Technician availability fetched successfully");
    return res.status(200).json({
      success: true,
      data: result.data,
      total: result.total,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.logApiError("Error fetching technician availability", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getTechnicianAvailabilityByIdHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Technician availability ID is required",
      });
    }

    const availability = await getTechnicianAvailabilityById(id);

    if (!availability) {
      return res.status(404).json({
        success: false,
        message: "Technician availability not found",
      });
    }

    logger.info(`Technician availability ${id} fetched successfully`);
    return res.status(200).json({
      success: true,
      data: availability,
    });
  } catch (error) {
    logger.logApiError("Error fetching technician availability", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const createTechnicianAvailabilityHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const availabilityData = req.body;

    const newAvailability = await createTechnicianAvailability(
      availabilityData
    );

    if (!newAvailability) {
      return res.status(500).json({
        success: false,
        message: "Failed to create technician availability",
      });
    }

    logger.info(
      `Technician availability ${newAvailability.id} created successfully`
    );
    return res.status(201).json({
      success: true,
      data: newAvailability,
      message: "Technician availability created successfully",
    });
  } catch (error: any) {
    logger.logApiError("Error creating technician availability", error, req);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

export const updateTechnicianAvailabilityHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Technician availability ID is required",
      });
    }
    const updateData = req.body;

    const updatedAvailability = await updateTechnicianAvailability(
      id,
      updateData
    );

    if (!updatedAvailability) {
      return res.status(404).json({
        success: false,
        message: "Technician availability not found",
      });
    }

    logger.info(`Technician availability ${id} updated successfully`);
    return res.status(200).json({
      success: true,
      data: updatedAvailability,
      message: "Technician availability updated successfully",
    });
  } catch (error) {
    logger.logApiError("Error updating technician availability", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const deleteTechnicianAvailabilityHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Technician availability ID is required",
      });
    }

    const deletedAvailability = await deleteTechnicianAvailability(id);

    if (!deletedAvailability) {
      return res.status(404).json({
        success: false,
        message: "Technician availability not found",
      });
    }

    logger.info(`Technician availability ${id} deleted successfully`);
    return res.status(200).json({
      success: true,
      message: "Technician availability deleted successfully",
    });
  } catch (error) {
    logger.logApiError("Error deleting technician availability", error, req);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getAvailabilityByEmployeeIdHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { employeeId } = req.params;
    const { startDate, endDate } = req.query;

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: "Employee ID is required",
      });
    }

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Start date and end date are required",
      });
    }

    const availability = await getAvailabilityByEmployeeId(
      parseInt(employeeId),
      startDate as string,
      endDate as string
    );

    logger.info(
      `Availability for employee ${employeeId} fetched successfully`
    );
    return res.status(200).json({
      success: true,
      data: availability,
    });
  } catch (error) {
    logger.logApiError(
      "Error fetching availability by employee ID",
      error,
      req
    );
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};




