import { Router } from "express";
import {
  getUserInterfaceHandler,
  getModuleUIHandler,
  getSimpleUIHandler,
  getDashboardConfigHandler,
  getNavigationConfigHandler,
  getButtonPermissionsHandler,
  filterDataHandler,
  checkFeatureAccessHandler,
  getUserModulesHandler,
} from "../../controllers/UIPermissionsController.js";
import { authenticate } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { z } from "zod";

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

// Validation schemas
const moduleParamSchema = z.object({
  params: z.object({
    module: z.string().min(1, "Module is required"),
  }),
});

const featureParamSchema = z.object({
  params: z.object({
    module: z.string().min(1, "Module is required"),
    feature: z.string().min(1, "Feature is required"),
  }),
});

const filterDataSchema = z.object({
  body: z.object({
    data: z.record(z.string(), z.any()).describe("Data object to filter"),
  }),
});

/**
 * UI Permissions Routes
 * Provides endpoints for frontend applications to get UI configuration
 */

// Get complete user interface configuration
router.get(
  "/interface",
  getUserInterfaceHandler
);

// Get user's accessible modules
router.get(
  "/modules",
  getUserModulesHandler
);

// Get dashboard configuration
router.get(
  "/dashboard/config",
  getDashboardConfigHandler
);

// Get navigation configuration
router.get(
  "/navigation",
  getNavigationConfigHandler
);

// Get module-specific UI configuration
router.get(
  "/modules/:module/ui",
  validate(moduleParamSchema),
  getModuleUIHandler
);

// Get simplified UI configuration for a module
router.get(
  "/modules/:module/ui/simple",
  validate(moduleParamSchema),
  getSimpleUIHandler
);

// Get button permissions for a module
router.get(
  "/modules/:module/buttons",
  validate(moduleParamSchema),
  getButtonPermissionsHandler
);

// Check specific feature access
router.get(
  "/modules/:module/features/:feature/check",
  validate(featureParamSchema),
  checkFeatureAccessHandler
);

// Filter data based on field permissions
router.post(
  "/modules/:module/filter-data",
  validate(moduleParamSchema),
  validate(filterDataSchema),
  filterDataHandler
);

export default router;
