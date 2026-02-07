import type { Request, Response } from "express";
import { asSingleString } from "../utils/request-helpers.js";
import {
  getModuleUIConfig,
  getSimpleUIConfig,
  getDashboardConfig,
  getNavigationConfig,
  getUserInterfaceConfig,
  getButtonPermissions,
  filterDataByFieldPermissions,
} from "../services/uiPermissions.service.js";
import { logger } from "../utils/logger.js";

/**
 * UI Permissions Controller
 * Provides endpoints for frontend to get UI configuration and permissions
 */

/**
 * Get complete user interface configuration
 * GET /api/auth/user/interface
 */
export const getUserInterfaceHandler = async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const config = await getUserInterfaceConfig(req.user.id);

    return res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    logger.logApiError("Get user interface config error", error, req);
    return res.status(500).json({
      success: false,
      message: "Failed to load interface configuration",
    });
  }
};

/**
 * Get module-specific UI configuration
 * GET /api/auth/user/modules/:module/ui
 */
export const getModuleUIHandler = async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const module = asSingleString(req.params.module);
    if (!module) {
      return res.status(400).json({
        success: false,
        message: "Module parameter is required",
      });
    }

    const config = await getModuleUIConfig(req.user.id, module);

    return res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    logger.logApiError("Get module UI config error", error, req);
    return res.status(500).json({
      success: false,
      message: "Failed to load module UI configuration",
    });
  }
};

/**
 * Get simplified UI configuration for quick checks
 * GET /api/auth/user/modules/:module/ui/simple
 */
export const getSimpleUIHandler = async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const module = asSingleString(req.params.module);
    if (!module) {
      return res.status(400).json({
        success: false,
        message: "Module parameter is required",
      });
    }

    const config = await getSimpleUIConfig(req.user.id, module);

    return res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    logger.logApiError("Get simple UI config error", error, req);
    return res.status(500).json({
      success: false,
      message: "Failed to load UI configuration",
    });
  }
};

/**
 * Get dashboard configuration
 * GET /api/auth/user/dashboard/config
 */
export const getDashboardConfigHandler = async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const config = await getDashboardConfig(req.user.id);

    return res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    logger.logApiError("Get dashboard config error", error, req);
    return res.status(500).json({
      success: false,
      message: "Failed to load dashboard configuration",
    });
  }
};

/**
 * Get navigation configuration
 * GET /api/auth/user/navigation
 */
export const getNavigationConfigHandler = async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const config = await getNavigationConfig(req.user.id);

    return res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    logger.logApiError("Get navigation config error", error, req);
    return res.status(500).json({
      success: false,
      message: "Failed to load navigation configuration",
    });
  }
};

/**
 * Get button permissions for a module
 * GET /api/auth/user/modules/:module/buttons
 */
export const getButtonPermissionsHandler = async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const module = asSingleString(req.params.module);
    if (!module) {
      return res.status(400).json({
        success: false,
        message: "Module parameter is required",
      });
    }

    const buttons = await getButtonPermissions(req.user.id, module);

    return res.json({
      success: true,
      data: { module, buttons },
    });
  } catch (error) {
    logger.logApiError("Get button permissions error", error, req);
    return res.status(500).json({
      success: false,
      message: "Failed to load button permissions",
    });
  }
};

/**
 * Filter data based on field permissions
 * POST /api/auth/user/modules/:module/filter-data
 */
export const filterDataHandler = async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const module = asSingleString(req.params.module);
    const { data } = req.body;

    if (!module) {
      return res.status(400).json({
        success: false,
        message: "Module parameter is required",
      });
    }

    if (!data) {
      return res.status(400).json({
        success: false,
        message: "Data is required",
      });
    }

    const result = await filterDataByFieldPermissions(req.user.id, module, data);

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.logApiError("Filter data error", error, req);
    return res.status(500).json({
      success: false,
      message: "Failed to filter data",
    });
  }
};

/**
 * Check if user can access a specific feature
 * GET /api/auth/user/modules/:module/features/:feature/check
 */
export const checkFeatureAccessHandler = async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const module = asSingleString(req.params.module);
    const feature = asSingleString(req.params.feature);
    
    if (!module || !feature) {
      return res.status(400).json({
        success: false,
        message: "Module and feature parameters are required",
      });
    }

    const config = await getModuleUIConfig(req.user.id, module);
    const featureAccess = config.features.find(f => f.featureCode === feature);

    return res.json({
      success: true,
      data: {
        module,
        feature,
        hasAccess: featureAccess?.available || false,
        accessLevel: featureAccess?.accessLevel || "none",
      },
    });
  } catch (error) {
    logger.logApiError("Check feature access error", error, req);
    return res.status(500).json({
      success: false,
      message: "Failed to check feature access",
    });
  }
};

/**
 * Get user's accessible modules list
 * GET /api/auth/user/modules
 */
export const getUserModulesHandler = async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const config = await getNavigationConfig(req.user.id);

    const modules = config.accessibleModules.map(module => {
      const navItem = [
        ...config.navigation.main,
        ...config.navigation.financial,
        ...config.navigation.settings,
      ].find(item => item.module === module);

      return {
        module,
        label: navItem?.label || module,
        icon: navItem?.icon || "circle",
        route: navItem?.route || `/${module}`,
        features: navItem?.features || [],
      };
    });

    return res.json({
      success: true,
      data: {
        userRole: config.userRole,
        modules,
        totalModules: modules.length,
      },
    });
  } catch (error) {
    logger.logApiError("Get user modules error", error, req);
    return res.status(500).json({
      success: false,
      message: "Failed to load user modules",
    });
  }
};
