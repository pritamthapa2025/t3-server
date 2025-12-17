import { Router } from "express";
import { z } from "zod";
import * as capacityController from "../../controllers/CapacityController.js";
import { authenticate } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  getDashboardKPIsQuerySchema,
  getUtilizationMetricsQuerySchema,
  getUtilizationChartDataQuerySchema,
  getCoverageByTeamQuerySchema,
  getEmployeeAvailabilityQuerySchema,
  updateEmployeeAvailabilitySchema,
  getResourceAllocationsQuerySchema,
  createResourceAllocationSchema,
  updateResourceAllocationSchema,
  getEmployeeShiftsQuerySchema,
  createEmployeeShiftSchema,
  updateEmployeeShiftSchema,
  getDepartmentCapacityOverviewQuerySchema,
  getCapacityPlanningTemplatesQuerySchema,
  createCapacityPlanningTemplateSchema,
} from "../../validations/capacity.validations.js";

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// Dashboard KPIs
router.get(
  "/dashboard/kpis",
  validate(z.object({ query: getDashboardKPIsQuerySchema })),
  capacityController.getDashboardKPIs
);

// Utilization metrics and trends
router.get(
  "/utilization/metrics",
  validate(z.object({ query: getUtilizationMetricsQuerySchema })),
  capacityController.getUtilizationMetrics
);

// Utilization chart data
router.get(
  "/utilization/chart-data",
  validate(z.object({ query: getUtilizationChartDataQuerySchema })),
  capacityController.getUtilizationChartData
);

// Coverage by team
router.get(
  "/coverage/team",
  validate(z.object({ query: getCoverageByTeamQuerySchema })),
  capacityController.getCoverageByTeam
);

// Employee Availability Routes
router.get(
  "/availability",
  validate(z.object({ query: getEmployeeAvailabilityQuerySchema })),
  capacityController.getEmployeeAvailability
);

router.put(
  "/availability/:employeeId",
  validate(z.object({ 
    body: updateEmployeeAvailabilitySchema,
    params: z.object({ employeeId: z.string() })
  })),
  capacityController.updateEmployeeAvailability
);

// Resource Allocations Routes
router.get(
  "/allocations",
  validate(z.object({ query: getResourceAllocationsQuerySchema })),
  capacityController.getResourceAllocations
);

router.post(
  "/allocations",
  validate(z.object({ body: createResourceAllocationSchema })),
  capacityController.createResourceAllocation
);

router.put(
  "/allocations/:allocationId",
  validate(z.object({ 
    body: updateResourceAllocationSchema,
    params: z.object({ allocationId: z.string().uuid() })
  })),
  capacityController.updateResourceAllocation
);

// Employee Shifts Routes
router.get(
  "/shifts",
  validate(z.object({ query: getEmployeeShiftsQuerySchema })),
  capacityController.getEmployeeShifts
);

router.post(
  "/shifts",
  validate(z.object({ body: createEmployeeShiftSchema })),
  capacityController.createEmployeeShift
);

router.put(
  "/shifts/:shiftId",
  validate(z.object({ 
    body: updateEmployeeShiftSchema,
    params: z.object({ shiftId: z.string() })
  })),
  capacityController.updateEmployeeShift
);

router.delete(
  "/shifts/:shiftId",
  validate(z.object({ 
    params: z.object({ shiftId: z.string() })
  })),
  capacityController.deleteEmployeeShift
);

// Department Capacity Overview
router.get(
  "/capacity/overview",
  validate(z.object({ query: getDepartmentCapacityOverviewQuerySchema })),
  capacityController.getDepartmentCapacityOverview
);

// Capacity Planning Templates Routes
router.get(
  "/templates",
  validate(z.object({ query: getCapacityPlanningTemplatesQuerySchema })),
  capacityController.getCapacityPlanningTemplates
);

router.post(
  "/templates",
  validate(z.object({ body: createCapacityPlanningTemplateSchema })),
  capacityController.createCapacityPlanningTemplate
);

// Team Assignments & Managers
router.get(
  "/assignments/teams",
  capacityController.getTeamAssignments
);

export default router;