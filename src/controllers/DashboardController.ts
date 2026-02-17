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
 */
export const getActiveJobsStats = async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId ?? undefined;
    const { startDate, endDate } = (req as any).query ?? {};
    const dateRange = startDate && endDate ? { startDate, endDate } : undefined;
    const stats = await DashboardService.getActiveJobsStats(
      organizationId,
      dateRange,
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
 */
export const getPriorityJobs = async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId ?? undefined;
    const { limit, search, startDate, endDate } = (req as any).query ?? {};
    const dateRange = startDate && endDate ? { startDate, endDate } : undefined;
    const jobs = await DashboardService.getPriorityJobs(
      organizationId,
      {
        limit: limit ? parseInt(limit as string) : 10,
        search: search as string,
      },
      dateRange,
    );

    return successResponse(res, jobs, "Priority jobs retrieved");
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};
