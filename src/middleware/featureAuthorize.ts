import type { Request, Response, NextFunction } from "express";
import {
  hasFeatureAccess,
  canPerformAction,
  hasModuleAccess,
  getUserModulePermissions,
} from "../services/featurePermission.service.js";
import { logger } from "../utils/logger.js";

/**
 * Feature-Based Authorization Middleware
 * Provides granular permission checking based on features and context
 */

/**
 * Middleware to check if user has access to a specific module
 * Usage: authorizeModule("bids")
 */
export const authorizeModule = (module: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      const hasAccess = await hasModuleAccess(req.user.id, module);

      if (!hasAccess) {
        logger.warn(
          `Module access denied: User ${req.user.id} attempted to access ${module} module`
        );
        return res.status(403).json({
          success: false,
          message: `You do not have access to the ${module} module`,
        });
      }

      // Store module in request for use by other middleware
      req.currentModule = module;
      next();
    } catch (error) {
      logger.logApiError("Module authorization error", error, req);
      return res.status(500).json({
        success: false,
        message: "Authorization check failed",
      });
    }
  };
};

/**
 * Middleware to check if user has access to a specific feature
 * Usage: authorizeFeature("bids", "create")
 */
export const authorizeFeature = (module: string, featureCode: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      const accessLevel = await hasFeatureAccess(req.user.id, module, featureCode);

      if (!accessLevel || accessLevel === "none") {
        logger.warn(
          `Feature access denied: User ${req.user.id} attempted ${featureCode} on ${module}`
        );
        return res.status(403).json({
          success: false,
          message: `You do not have permission to ${featureCode} in ${module}`,
        });
      }

      // Store access level in request for use by controllers
      req.userAccessLevel = accessLevel;
      req.currentModule = module;
      req.currentFeature = featureCode;
      next();
    } catch (error) {
      logger.logApiError("Feature authorization error", error, req);
      return res.status(500).json({
        success: false,
        message: "Authorization check failed",
      });
    }
  };
};

/**
 * Middleware to check if user can perform an action with context
 * Usage: authorizeAction("jobs", "edit", (req) => ({ ownerId: req.params.userId }))
 */
export const authorizeAction = (
  module: string,
  action: string,
  contextFn?: (req: Request) => {
    recordId?: string;
    ownerId?: string;
    assignedTo?: string;
    departmentId?: number;
    status?: string;
  }
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      const context = contextFn ? contextFn(req) : undefined;
      const canPerform = await canPerformAction(req.user.id, module, action, context);

      if (!canPerform) {
        logger.warn(
          `Action denied: User ${req.user.id} cannot ${action} on ${module}`,
          { context }
        );
        return res.status(403).json({
          success: false,
          message: `You do not have permission to ${action} this ${module}`,
        });
      }

      req.currentModule = module;
      req.currentAction = action;
      req.actionContext = context;
      next();
    } catch (error) {
      logger.logApiError("Action authorization error", error, req);
      return res.status(500).json({
        success: false,
        message: "Authorization check failed",
      });
    }
  };
};

/**
 * Middleware to check multiple features at once
 * Usage: authorizeAnyFeature("bids", ["view", "create"])
 */
export const authorizeAnyFeature = (module: string, features: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      let hasAnyAccess = false;
      let grantedFeature = "";

      for (const feature of features) {
        const accessLevel = await hasFeatureAccess(req.user.id, module, feature);
        if (accessLevel && accessLevel !== "none") {
          hasAnyAccess = true;
          grantedFeature = feature;
          req.userAccessLevel = accessLevel;
          break;
        }
      }

      if (!hasAnyAccess) {
        logger.warn(
          `Multiple feature access denied: User ${req.user.id} has no access to any of [${features.join(", ")}] in ${module}`
        );
        return res.status(403).json({
          success: false,
          message: `You do not have permission to access ${module}`,
        });
      }

      req.currentModule = module;
      req.currentFeature = grantedFeature;
      next();
    } catch (error) {
      logger.logApiError("Multiple feature authorization error", error, req);
      return res.status(500).json({
        success: false,
        message: "Authorization check failed",
      });
    }
  };
};

/**
 * Middleware to load user's complete module permissions
 * Usage: loadModulePermissions("bids")
 * This loads all permissions into req.modulePermissions for use by controllers
 */
export const loadModulePermissions = (module: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      const permissions = await getUserModulePermissions(req.user.id, module);
      req.modulePermissions = permissions;
      req.currentModule = module;

      next();
    } catch (error) {
      logger.logApiError("Load module permissions error", error, req);
      return res.status(500).json({
        success: false,
        message: "Failed to load permissions",
      });
    }
  };
};

/**
 * Role-based authorization allowing multiple roles
 * Usage: requireAnyRole("Executive", "Manager")
 */
export const requireAnyRole = (...roleNames: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      const userRole = await getUserRoleWithContext(req.user.id);

      if (!userRole || !roleNames.includes(userRole.roleName)) {
        logger.warn(
          `Role access denied: User ${req.user.id} does not have any of roles [${roleNames.join(", ")}]`
        );
        return res.status(403).json({
          success: false,
          message: `You do not have permission to perform this action`,
        });
      }

      req.userRole = userRole;
      next();
    } catch (error) {
      logger.logApiError("Role authorization error", error, req);
      return res.status(500).json({
        success: false,
        message: "Authorization check failed",
      });
    }
  };
};

/**
 * Advanced: Role-based authorization (for simple cases)
 * Usage: requireRole("Executive")
 */
export const requireRole = (roleName: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      // This would need to be implemented in the feature service
      // For now, we'll use a simple approach
      const userRole = await getUserRoleWithContext(req.user.id);

      if (!userRole || userRole.roleName !== roleName) {
        logger.warn(
          `Role access denied: User ${req.user.id} does not have role ${roleName}`
        );
        return res.status(403).json({
          success: false,
          message: `You must have the ${roleName} role to access this resource`,
        });
      }

      req.userRole = userRole;
      next();
    } catch (error) {
      logger.logApiError("Role authorization error", error, req);
      return res.status(500).json({
        success: false,
        message: "Authorization check failed",
      });
    }
  };
};

/**
 * Utility middleware to add permissions to response headers (for debugging)
 */
export const debugPermissions = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (process.env.NODE_ENV === "development" && req.modulePermissions) {
      res.setHeader("X-User-Role", req.modulePermissions.userRole?.roleName || "unknown");
      res.setHeader("X-Module-Features", req.modulePermissions.features.length.toString());
      res.setHeader("X-UI-Elements", req.modulePermissions.uiElements.length.toString());
    }
    next();
  };
};

// Extend Request interface to include permission properties
declare global {
  namespace Express {
    interface Request {
      currentModule?: string;
      currentFeature?: string;
      currentAction?: string;
      userAccessLevel?: string;
      actionContext?: any;
      modulePermissions?: any;
      userRole?: any;
    }
  }
}

// Import the getUserRoleWithContext function
import { getUserRoleWithContext } from "../services/featurePermission.service.js";
