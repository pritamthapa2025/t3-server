import type { Request, Response } from "express";
import * as DashboardService from "../services/dashboard.service.js";
import { successResponse, errorResponse } from "../utils/response.js";

/**
 * ============================================================================
 * DASHBOARD CONTROLLER
 * ============================================================================
 * Aggregates data from multiple tables for dashboard overview
 */

/**
 * Get all dashboard overview data in one call
 * GET /api/org/dashboard/overview
 * Query: startDate, endDate (optional, YYYY-MM-DD)
 */
export const getDashboardOverview = async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId ?? undefined;
    const { startDate, endDate } = (req as any).query ?? {};
    const dateRange = startDate && endDate ? { startDate, endDate } : undefined;
    const overview = await DashboardService.getDashboardOverview(
      organizationId,
      dateRange,
    );
    return successResponse(res, overview, "Dashboard overview retrieved");
  } catch (error: any) {
    console.error("Dashboard overview error:", error);
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Get revenue statistics
 * GET /api/org/dashboard/revenue
 * Query: startDate, endDate (optional, YYYY-MM-DD)
 */
export const getRevenueStats = async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId ?? undefined;
    const { startDate, endDate } = (req as any).query ?? {};
    const dateRange = startDate && endDate ? { startDate, endDate } : undefined;
    const stats = await DashboardService.getRevenueStats(
      organizationId,
      dateRange,
    );
    return successResponse(res, stats, "Revenue stats retrieved");
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Get active jobs statistics
 * GET /api/org/dashboard/active-jobs
 * Query: startDate, endDate (optional, YYYY-MM-DD)
 * Technicians only see counts for jobs assigned to them.
 */
export const getActiveJobsStats = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const organizationId = req.user?.organizationId ?? undefined;
    const { startDate, endDate } = (req as any).query ?? {};
    const dateRange = startDate && endDate ? { startDate, endDate } : undefined;

    let assignedToEmployeeId: number | undefined;
    if (userId) {
      const { getDataFilterConditions } = await import("../services/featurePermission.service.js");
      const { getEmployeeByUserId } = await import("../services/auth.service.js");
      const dataFilters = await getDataFilterConditions(userId, "jobs");
      if (dataFilters.assignedOnly) {
        const employee = await getEmployeeByUserId(userId);
        if (employee?.id) assignedToEmployeeId = employee.id;
      }
    }

    const stats = await DashboardService.getActiveJobsStats(
      organizationId,
      dateRange,
      assignedToEmployeeId != null ? { assignedToEmployeeId } : undefined,
    );
    return successResponse(res, stats, "Active jobs stats retrieved");
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Get team utilization statistics
 * GET /api/org/dashboard/team-utilization
 * Query: startDate, endDate (optional, YYYY-MM-DD)
 */
export const getTeamUtilization = async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId ?? undefined;
    const { startDate, endDate } = (req as any).query ?? {};
    const dateRange = startDate && endDate ? { startDate, endDate } : undefined;
    const stats = await DashboardService.getTeamUtilization(
      organizationId,
      dateRange,
    );
    return successResponse(res, stats, "Team utilization retrieved");
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Get today's dispatch information (or dispatch for a given date when startDate/endDate provided)
 * GET /api/org/dashboard/todays-dispatch
 * Query: startDate, endDate (optional, YYYY-MM-DD; when set, dispatch is for that date range)
 */
export const getTodaysDispatch = async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId ?? undefined;
    const { startDate, endDate } = (req as any).query ?? {};
    const dateRange = startDate && endDate ? { startDate, endDate } : undefined;
    const dispatch = await DashboardService.getTodaysDispatch(
      organizationId,
      dateRange,
    );
    return successResponse(res, dispatch, "Today's dispatch retrieved");
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Get active bids statistics
 * GET /api/org/dashboard/active-bids
 * Query: startDate, endDate (optional, YYYY-MM-DD)
 */
export const getActiveBidsStats = async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId ?? undefined;
    const { startDate, endDate } = (req as any).query ?? {};
    const dateRange = startDate && endDate ? { startDate, endDate } : undefined;
    const stats = await DashboardService.getActiveBidsStats(
      organizationId,
      dateRange,
    );
    return successResponse(res, stats, "Active bids stats retrieved");
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Get performance overview
 * GET /api/org/dashboard/performance
 * Query: startDate, endDate (optional, YYYY-MM-DD)
 */
export const getPerformanceOverview = async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId ?? undefined;
    const { startDate, endDate } = (req as any).query ?? {};
    const dateRange = startDate && endDate ? { startDate, endDate } : undefined;
    const performance = await DashboardService.getPerformanceOverview(
      organizationId,
      dateRange,
    );
    return successResponse(res, performance, "Performance overview retrieved");
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Get priority jobs (dashboard table)
 * GET /api/org/dashboard/priority-jobs
 * Query: startDate, endDate (optional, YYYY-MM-DD), limit, search
 * Technicians only see jobs assigned to them.
 */
export const getPriorityJobs = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const organizationId = req.user?.organizationId ?? undefined;
    const { limit, search, startDate, endDate } = (req as any).query ?? {};
    const dateRange = startDate && endDate ? { startDate, endDate } : undefined;

    let assignedToEmployeeId: number | undefined;
    if (userId) {
      const { getDataFilterConditions } = await import("../services/featurePermission.service.js");
      const { getEmployeeByUserId } = await import("../services/auth.service.js");
      const dataFilters = await getDataFilterConditions(userId, "jobs");
      if (dataFilters.assignedOnly) {
        const employee = await getEmployeeByUserId(userId);
        if (employee?.id) assignedToEmployeeId = employee.id;
      }
    }

    const jobs = await DashboardService.getPriorityJobs(
      organizationId,
      {
        limit: limit ? parseInt(limit as string) : 10,
        search: search as string,
        assignedToEmployeeId,
      },
      dateRange,
    );

    return successResponse(res, jobs, "Priority jobs retrieved");
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

// ─── Revenue Target Controllers ───────────────────────────────────────────────

/**
 * List revenue targets
 * GET /api/org/dashboard/goals
 * Query: year (optional)
 */
export const listRevenueTargets = async (req: Request, res: Response) => {
  try {
    const { year } = (req as any).query ?? {};
    const targets = await DashboardService.listRevenueTargets(
      year ? parseInt(year as string) : undefined,
    );
    return successResponse(res, targets, "Revenue targets retrieved");
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Get a single revenue target by id
 * GET /api/org/dashboard/goals/:id
 */
export const getRevenueTargetById = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const target = await DashboardService.getRevenueTargetById(id);
    if (!target) return errorResponse(res, "Revenue target not found", 404);
    return successResponse(res, target, "Revenue target retrieved");
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Create a revenue target
 * POST /api/org/dashboard/goals
 */
export const createRevenueTarget = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id as string | undefined;
    const { month, year, targetAmount, label, notes } = req.body;
    const target = await DashboardService.createRevenueTarget({
      month,
      year,
      targetAmount,
      label,
      notes,
      createdBy: userId,
    });
    return successResponse(res, target, "Revenue target created", 201);
  } catch (error: any) {
    if (error.code === "23505") {
      return errorResponse(res, "A revenue target for this month and year already exists", 409);
    }
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Update a revenue target
 * PUT /api/org/dashboard/goals/:id
 */
export const updateRevenueTarget = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const userId = req.user?.id as string | undefined;
    const { month, year, targetAmount, label, notes } = req.body;
    const target = await DashboardService.updateRevenueTarget(id, {
      month,
      year,
      targetAmount,
      label,
      notes,
      updatedBy: userId,
    });
    if (!target) return errorResponse(res, "Revenue target not found", 404);
    return successResponse(res, target, "Revenue target updated");
  } catch (error: any) {
    if (error.code === "23505") {
      return errorResponse(res, "A revenue target for this month and year already exists", 409);
    }
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Delete (soft) a revenue target
 * DELETE /api/org/dashboard/goals/:id
 */
export const deleteRevenueTarget = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const userId = req.user?.id as string | undefined;
    const result = await DashboardService.deleteRevenueTarget(id, userId);
    if (!result) return errorResponse(res, "Revenue target not found", 404);
    return successResponse(res, result, "Revenue target deleted");
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};
