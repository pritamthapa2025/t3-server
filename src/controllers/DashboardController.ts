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
 */
export const getDashboardOverview = async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId ?? undefined;
    const overview =
      await DashboardService.getDashboardOverview(organizationId);
    return successResponse(res, overview, "Dashboard overview retrieved");
  } catch (error: any) {
    console.error("Dashboard overview error:", error);
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Get revenue statistics
 * GET /api/org/dashboard/revenue
 */
export const getRevenueStats = async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId ?? undefined;
    const stats = await DashboardService.getRevenueStats(organizationId);
    return successResponse(res, stats, "Revenue stats retrieved");
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Get active jobs statistics
 * GET /api/org/dashboard/active-jobs
 */
export const getActiveJobsStats = async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId ?? undefined;
    const stats = await DashboardService.getActiveJobsStats(organizationId);
    return successResponse(res, stats, "Active jobs stats retrieved");
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Get team utilization statistics
 * GET /api/org/dashboard/team-utilization
 */
export const getTeamUtilization = async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId ?? undefined;
    const stats = await DashboardService.getTeamUtilization(organizationId);
    return successResponse(res, stats, "Team utilization retrieved");
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Get today's dispatch information
 * GET /api/org/dashboard/todays-dispatch
 */
export const getTodaysDispatch = async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId ?? undefined;
    const dispatch = await DashboardService.getTodaysDispatch(organizationId);
    return successResponse(res, dispatch, "Today's dispatch retrieved");
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Get active bids statistics
 * GET /api/org/dashboard/active-bids
 */
export const getActiveBidsStats = async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId ?? undefined;
    const stats = await DashboardService.getActiveBidsStats(organizationId);
    return successResponse(res, stats, "Active bids stats retrieved");
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Get performance overview
 * GET /api/org/dashboard/performance
 */
export const getPerformanceOverview = async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId ?? undefined;
    const performance =
      await DashboardService.getPerformanceOverview(organizationId);
    return successResponse(res, performance, "Performance overview retrieved");
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Get priority jobs (dashboard table)
 * GET /api/org/dashboard/priority-jobs
 */
export const getPriorityJobs = async (req: Request, res: Response) => {
  try {
    const organizationId = req.user?.organizationId ?? undefined;
    const { limit, search } = req.query;
    const jobs = await DashboardService.getPriorityJobs(organizationId, {
      limit: limit ? parseInt(limit as string) : 10,
      search: search as string,
    });

    return successResponse(res, jobs, "Priority jobs retrieved");
  } catch (error: any) {
    return errorResponse(res, error.message, 500);
  }
};
