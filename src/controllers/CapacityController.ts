import type { Request, Response } from "express";
import { z } from "zod";
import * as capacityService from "../services/capacity.service.js";

// Dashboard KPIs - Status cards (In Field, Available, Suspended, Total Technicians)
export const getDashboardKPIs = async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Organization access required",
      });
    }

    const { date } = req.query;

    const kpis = await capacityService.getDashboardKPIs(
      organizationId,
      date as string
    );

    res.json({
      success: true,
      data: kpis,
    });
  } catch (error: any) {
    console.error("Error fetching dashboard KPIs:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard KPIs",
      error: error.message,
    });
  }
};

// Overall Utilization metrics and trend
export const getUtilizationMetrics = async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Organization access required",
      });
    }

    const {
      startDate,
      endDate,
      departmentId,
      periodType = "monthly",
    } = req.query;

    const metrics = await capacityService.getUtilizationMetrics(
      organizationId,
      {
        startDate: startDate as string,
        endDate: endDate as string,
        departmentId: departmentId
          ? parseInt(departmentId as string)
          : undefined,
        periodType: periodType as "daily" | "weekly" | "monthly" | "quarterly",
      }
    );

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error: any) {
    console.error("Error fetching utilization metrics:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch utilization metrics",
      error: error.message,
    });
  }
};

// Utilization chart data (historical trend)
export const getUtilizationChartData = async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Organization access required",
      });
    }

    const {
      startDate,
      endDate,
      periodType = "monthly",
      departmentId,
    } = req.query;

    const chartData = await capacityService.getUtilizationChartData(
      organizationId,
      {
        startDate: startDate as string,
        endDate: endDate as string,
        periodType: periodType as "daily" | "weekly" | "monthly" | "quarterly",
        departmentId: departmentId
          ? parseInt(departmentId as string)
          : undefined,
      }
    );

    res.json({
      success: true,
      data: chartData,
    });
  } catch (error: any) {
    console.error("Error fetching utilization chart data:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch utilization chart data",
      error: error.message,
    });
  }
};

// Coverage by Team - table data
export const getCoverageByTeam = async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Organization access required",
      });
    }

    const { date } = req.query;

    const teamCoverage = await capacityService.getCoverageByTeam(
      organizationId,
      date as string
    );

    res.json({
      success: true,
      data: teamCoverage,
    });
  } catch (error: any) {
    console.error("Error fetching team coverage:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch team coverage",
      error: error.message,
    });
  }
};

// Real-time employee availability
export const getEmployeeAvailability = async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Organization access required",
      });
    }

    const { status, departmentId, page = 1, limit = 10 } = req.query;

    const result = await capacityService.getEmployeeAvailability(
      parseInt(page as string),
      parseInt(limit as string),
      {
        organizationId,
        status: status as string,
        departmentId: departmentId
          ? parseInt(departmentId as string)
          : undefined,
      }
    );

    res.json({
      success: true,
      data: result.employees,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: result.total,
        pages: Math.ceil(result.total / parseInt(limit as string)),
      },
    });
  } catch (error: any) {
    console.error("Error fetching employee availability:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch employee availability",
      error: error.message,
    });
  }
};

// Update employee availability status
export const updateEmployeeAvailability = async (
  req: Request,
  res: Response
) => {
  try {
    const organizationId = req.user?.organizationId;
    const userId = req.user?.id;
    if (!organizationId || !userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const { employeeId } = req.params;
    const updateData = req.body;

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: "Employee ID is required",
      });
    }

    const updatedAvailability =
      await capacityService.updateEmployeeAvailability(parseInt(employeeId), {
        ...updateData,
        updatedBy: userId,
        lastUpdated: new Date(),
      });

    res.json({
      success: true,
      message: "Employee availability updated successfully",
      data: updatedAvailability,
    });
  } catch (error: any) {
    console.error("Error updating employee availability:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update employee availability",
      error: error.message,
    });
  }
};

// Resource allocations (job assignments)
export const getResourceAllocations = async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Organization access required",
      });
    }

    const {
      startDate,
      endDate,
      employeeId,
      jobId,
      status,
      priority,
      page = 1,
      limit = 10,
    } = req.query;

    const result = await capacityService.getResourceAllocations(
      parseInt(page as string),
      parseInt(limit as string),
      {
        organizationId,
        startDate: startDate as string,
        endDate: endDate as string,
        employeeId: employeeId ? parseInt(employeeId as string) : undefined,
        jobId: jobId as string,
        status: status as string,
        priority: priority ? parseInt(priority as string) : undefined,
      }
    );

    res.json({
      success: true,
      data: result.allocations,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: result.total,
        pages: Math.ceil(result.total / parseInt(limit as string)),
      },
    });
  } catch (error: any) {
    console.error("Error fetching resource allocations:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch resource allocations",
      error: error.message,
    });
  }
};

// Create resource allocation
export const createResourceAllocation = async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    const userId = req.user?.id;
    if (!organizationId || !userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const allocationData = req.body;

    const newAllocation = await capacityService.createResourceAllocation({
      ...allocationData,
      createdBy: userId,
      assignedBy: userId,
    });

    res.status(201).json({
      success: true,
      message: "Resource allocation created successfully",
      data: newAllocation,
    });
  } catch (error: any) {
    console.error("Error creating resource allocation:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create resource allocation",
      error: error.message,
    });
  }
};

// Update resource allocation
export const updateResourceAllocation = async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    const userId = req.user?.id;
    if (!organizationId || !userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const { allocationId } = req.params;
    const updateData = req.body;

    if (!allocationId) {
      return res.status(400).json({
        success: false,
        message: "Allocation ID is required",
      });
    }

    const updatedAllocation = await capacityService.updateResourceAllocation(
      allocationId,
      {
        ...updateData,
        updatedAt: new Date(),
      }
    );

    res.json({
      success: true,
      message: "Resource allocation updated successfully",
      data: updatedAllocation,
    });
  } catch (error: any) {
    console.error("Error updating resource allocation:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update resource allocation",
      error: error.message,
    });
  }
};

// Employee shifts
export const getEmployeeShifts = async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Organization access required",
      });
    }

    const {
      startDate,
      endDate,
      employeeId,
      departmentId,
      isActive,
      page = 1,
      limit = 10,
    } = req.query;

    const result = await capacityService.getEmployeeShifts(
      parseInt(page as string),
      parseInt(limit as string),
      {
        organizationId,
        startDate: startDate as string,
        endDate: endDate as string,
        employeeId: employeeId ? parseInt(employeeId as string) : undefined,
        departmentId: departmentId
          ? parseInt(departmentId as string)
          : undefined,
        isActive: isActive === "true",
      }
    );

    res.json({
      success: true,
      data: result.shifts,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: result.total,
        pages: Math.ceil(result.total / parseInt(limit as string)),
      },
    });
  } catch (error: any) {
    console.error("Error fetching employee shifts:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch employee shifts",
      error: error.message,
    });
  }
};

// Create employee shift
export const createEmployeeShift = async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    const userId = req.user?.id;
    if (!organizationId || !userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const shiftData = req.body;

    const newShift = await capacityService.createEmployeeShift({
      ...shiftData,
      createdBy: userId,
    });

    res.status(201).json({
      success: true,
      message: "Employee shift created successfully",
      data: newShift,
    });
  } catch (error: any) {
    console.error("Error creating employee shift:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create employee shift",
      error: error.message,
    });
  }
};

// Update employee shift
export const updateEmployeeShift = async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Organization access required",
      });
    }

    const { shiftId } = req.params;
    const updateData = req.body;

    if (!shiftId) {
      return res.status(400).json({
        success: false,
        message: "Shift ID is required",
      });
    }

    const updatedShift = await capacityService.updateEmployeeShift(
      parseInt(shiftId),
      {
        ...updateData,
        updatedAt: new Date(),
      }
    );

    res.json({
      success: true,
      message: "Employee shift updated successfully",
      data: updatedShift,
    });
  } catch (error: any) {
    console.error("Error updating employee shift:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update employee shift",
      error: error.message,
    });
  }
};

// Delete employee shift
export const deleteEmployeeShift = async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Organization access required",
      });
    }

    const { shiftId } = req.params;

    if (!shiftId) {
      return res.status(400).json({
        success: false,
        message: "Shift ID is required",
      });
    }

    await capacityService.deleteEmployeeShift(parseInt(shiftId));

    res.json({
      success: true,
      message: "Employee shift deleted successfully",
    });
  } catch (error: any) {
    console.error("Error deleting employee shift:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete employee shift",
      error: error.message,
    });
  }
};

// Department capacity overview
export const getDepartmentCapacityOverview = async (
  req: Request,
  res: Response
) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Organization access required",
      });
    }

    const { startDate, endDate, periodType = "daily" } = req.query;

    const overview = await capacityService.getDepartmentCapacityOverview(
      organizationId,
      {
        startDate: startDate as string,
        endDate: endDate as string,
        periodType: periodType as "daily" | "weekly" | "monthly" | "quarterly",
      }
    );

    res.json({
      success: true,
      data: overview,
    });
  } catch (error: any) {
    console.error("Error fetching department capacity overview:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch department capacity overview",
      error: error.message,
    });
  }
};

// Capacity planning templates
export const getCapacityPlanningTemplates = async (
  req: Request,
  res: Response
) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Organization access required",
      });
    }

    const { departmentId, isActive, page = 1, limit = 10 } = req.query;

    const result = await capacityService.getCapacityPlanningTemplates(
      parseInt(page as string),
      parseInt(limit as string),
      {
        organizationId,
        departmentId: departmentId
          ? parseInt(departmentId as string)
          : undefined,
        isActive: isActive === "true",
      }
    );

    res.json({
      success: true,
      data: result.templates,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: result.total,
        pages: Math.ceil(result.total / parseInt(limit as string)),
      },
    });
  } catch (error: any) {
    console.error("Error fetching capacity planning templates:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch capacity planning templates",
      error: error.message,
    });
  }
};

// Create capacity planning template
export const createCapacityPlanningTemplate = async (
  req: Request,
  res: Response
) => {
  try {
    const organizationId = req.user?.organizationId;
    const userId = req.user?.id;
    if (!organizationId || !userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const templateData = req.body;

    const newTemplate = await capacityService.createCapacityPlanningTemplate({
      ...templateData,
      createdBy: userId,
    });

    res.status(201).json({
      success: true,
      message: "Capacity planning template created successfully",
      data: newTemplate,
    });
  } catch (error: any) {
    console.error("Error creating capacity planning template:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create capacity planning template",
      error: error.message,
    });
  }
};

// Assignments & Managers - Team assignments with contact details
// T3 employees can see all teams (no organization filtering needed)
export const getTeamAssignments = async (req: Request, res: Response) => {
  try {
    // No organizationId needed - T3 employees work for the company and see all teams
    const teamAssignments = await capacityService.getTeamAssignments();

    res.json({
      success: true,
      data: teamAssignments,
    });
  } catch (error: any) {
    console.error("Error fetching team assignments:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch team assignments",
      error: error.message,
    });
  }
};
