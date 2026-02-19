import { Router, type IRouter } from "express";
import * as DashboardController from "../../controllers/DashboardController.js";
import { authenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/featureAuthorize.js";
import { validate } from "../../middleware/validate.js";
import {
  dashboardDateRangeQuerySchema,
  createRevenueTargetSchema,
  updateRevenueTargetSchema,
  revenueTargetIdParamSchema,
  revenueTargetListQuerySchema,
} from "../../validations/dashboard.validations.js";

const router: IRouter = Router();

/**
 * ============================================================================
 * DASHBOARD ROUTES - /api/org/dashboard/*
 * ============================================================================
 * Aggregated data endpoints for the main dashboard overview.
 * All GETs accept optional query: startDate, endDate (YYYY-MM-DD) to filter data.
 */

// Overview Stats - All dashboard cards in one call
router.get(
  "/overview",
  authenticate,
  validate(dashboardDateRangeQuerySchema),
  DashboardController.getDashboardOverview,
);

// Individual Endpoints (for granular updates)
router.get(
  "/revenue",
  authenticate,
  validate(dashboardDateRangeQuerySchema),
  DashboardController.getRevenueStats,
);
router.get(
  "/active-jobs",
  authenticate,
  validate(dashboardDateRangeQuerySchema),
  DashboardController.getActiveJobsStats,
);
router.get(
  "/team-utilization",
  authenticate,
  validate(dashboardDateRangeQuerySchema),
  DashboardController.getTeamUtilization,
);
router.get(
  "/todays-dispatch",
  authenticate,
  validate(dashboardDateRangeQuerySchema),
  DashboardController.getTodaysDispatch,
);
router.get(
  "/active-bids",
  authenticate,
  validate(dashboardDateRangeQuerySchema),
  DashboardController.getActiveBidsStats,
);
router.get(
  "/performance",
  authenticate,
  validate(dashboardDateRangeQuerySchema),
  DashboardController.getPerformanceOverview,
);
router.get(
  "/priority-jobs",
  authenticate,
  validate(dashboardDateRangeQuerySchema),
  DashboardController.getPriorityJobs,
);

// ─── Revenue Targets / Goals (create/update/delete: Executive only) ───────────

router
  .route("/goals")
  .get(authenticate, validate(revenueTargetListQuerySchema), DashboardController.listRevenueTargets)
  .post(authenticate, requireRole("Executive"), validate(createRevenueTargetSchema), DashboardController.createRevenueTarget);

router
  .route("/goals/:id")
  .get(authenticate, validate(revenueTargetIdParamSchema), DashboardController.getRevenueTargetById)
  .put(authenticate, requireRole("Executive"), validate(updateRevenueTargetSchema), DashboardController.updateRevenueTarget)
  .delete(authenticate, requireRole("Executive"), validate(revenueTargetIdParamSchema), DashboardController.deleteRevenueTarget);

export default router;
