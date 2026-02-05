import { Router } from "express";
import * as DashboardController from "../../controllers/DashboardController.js";
import { authenticate } from "../../middleware/auth.js";

const router = Router();

/**
 * ============================================================================
 * DASHBOARD ROUTES - /api/org/dashboard/*
 * ============================================================================
 * Aggregated data endpoints for the main dashboard overview
 */

// Overview Stats - All dashboard cards in one call
router.get("/overview", authenticate, DashboardController.getDashboardOverview);

// Individual Endpoints (for granular updates)
router.get("/revenue", authenticate, DashboardController.getRevenueStats);
router.get(
  "/active-jobs",
  authenticate,
  DashboardController.getActiveJobsStats,
);
router.get(
  "/team-utilization",
  authenticate,
  DashboardController.getTeamUtilization,
);
router.get(
  "/todays-dispatch",
  authenticate,
  DashboardController.getTodaysDispatch,
);
router.get(
  "/active-bids",
  authenticate,
  DashboardController.getActiveBidsStats,
);
router.get(
  "/performance",
  authenticate,
  DashboardController.getPerformanceOverview,
);
router.get("/priority-jobs", authenticate, DashboardController.getPriorityJobs);

export default router;
