import { eq, and } from "drizzle-orm";
import { db } from "../config/db.js";
import {
  features,
  roleFeatures,
  uiElements,
  roleUIElements,
  dataFilters,
  fieldPermissions,
} from "../drizzle/schema/features.schema.js";
import { roles, userRoles } from "../drizzle/schema/auth.schema.js";
import { employees } from "../drizzle/schema/org.schema.js";
import { permissionModuleEnum } from "../drizzle/enums/auth.enums.js";

// Type helper for module enum
type ModuleType = (typeof permissionModuleEnum.enumValues)[number];

/**
 * Feature-Based Permission Service
 * Handles complex permission checking based on features, UI elements, and data filtering
 */

type UserRoleContext = {
  roleId: number;
  roleName: string;
  roleDescription: string | null;
  employeeId: number | null;
  departmentId: number | null;
  positionId: number | null;
};

async function fetchUserRoleWithContextFromDb(
  userId: string,
): Promise<UserRoleContext | null> {
  const [result] = await db
    .select({
      roleId: roles.id,
      roleName: roles.name,
      roleDescription: roles.description,
      employeeId: employees.id,
      departmentId: employees.departmentId,
      positionId: employees.positionId,
    })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .leftJoin(employees, eq(employees.userId, userId))
    .where(and(eq(userRoles.userId, userId), eq(roles.isDeleted, false)))
    .limit(1);

  return result || null;
}

const ROLE_CONTEXT_CACHE_TTL_MS = parseInt(
  process.env.ROLE_CONTEXT_CACHE_TTL_MS || "60000",
  10,
);
const roleContextCache = new Map<
  string,
  { expiresAt: number; value: UserRoleContext | null }
>();
const roleContextInflight = new Map<
  string,
  Promise<UserRoleContext | null>
>();

/**
 * Role + employee context — deduped in-flight and TTL-cached so parallel
 * module permission loads (UI / nav) only hit the DB once per user.
 */
export const getUserRoleWithContext = async (
  userId: string,
): Promise<UserRoleContext | null> => {
  const now = Date.now();
  const cached = roleContextCache.get(userId);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  let inflight = roleContextInflight.get(userId);
  if (!inflight) {
    inflight = fetchUserRoleWithContextFromDb(userId)
      .then((value) => {
        roleContextCache.set(userId, {
          expiresAt: Date.now() + ROLE_CONTEXT_CACHE_TTL_MS,
          value,
        });
        roleContextInflight.delete(userId);
        return value;
      })
      .catch((err) => {
        roleContextInflight.delete(userId);
        throw err;
      });
    roleContextInflight.set(userId, inflight);
  }
  return inflight;
};

const HAS_FEATURE_ACCESS_CACHE_TTL_MS = parseInt(
  process.env.HAS_FEATURE_ACCESS_CACHE_TTL_MS || "20000",
  10,
);
const hasFeatureAccessCache = new Map<
  string,
  { expiresAt: number; accessLevel: string | null }
>();

/**
 * Check if user has access to a specific feature
 * @param userId - User ID
 * @param module - Module name (e.g., "bids", "jobs")
 * @param featureCode - Feature code (e.g., "create", "view", "edit_own")
 * @returns Access level or null if no access
 */
export const hasFeatureAccess = async (
  userId: string,
  module: string,
  featureCode: string
): Promise<string | null> => {
  if (HAS_FEATURE_ACCESS_CACHE_TTL_MS > 0) {
    const key = `${userId}::${module}::${featureCode}`;
    const now = Date.now();
    const hit = hasFeatureAccessCache.get(key);
    if (hit && hit.expiresAt > now) {
      return hit.accessLevel;
    }
  }

  const moduleTyped = module as ModuleType;
  const result = await db
    .select({
      accessLevel: roleFeatures.accessLevel,
      conditions: roleFeatures.conditions,
    })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .innerJoin(roleFeatures, eq(roles.id, roleFeatures.roleId))
    .innerJoin(features, eq(roleFeatures.featureId, features.id))
    .where(
      and(
        eq(userRoles.userId, userId),
        eq(features.module, moduleTyped),
        eq(features.featureCode, featureCode),
        eq(roles.isDeleted, false),
        eq(features.isActive, true),
        eq(roleFeatures.isActive, true)
      )
    )
    .limit(1);

  const level = result[0]?.accessLevel || null;

  if (HAS_FEATURE_ACCESS_CACHE_TTL_MS > 0) {
    const key = `${userId}::${module}::${featureCode}`;
    hasFeatureAccessCache.set(key, {
      expiresAt: Date.now() + HAS_FEATURE_ACCESS_CACHE_TTL_MS,
      accessLevel: level,
    });
  }

  return level;
};

/**
 * Check if user can perform a specific action on a module
 * @param userId - User ID
 * @param module - Module name
 * @param action - Action type ("view", "create", "edit", "delete", "approve")
 * @param context - Additional context (recordId, ownerId, etc.)
 */
export const canPerformAction = async (
  userId: string,
  module: string,
  action: string,
  context?: {
    recordId?: string;
    ownerId?: string;
    assignedTo?: string;
    departmentId?: number;
    status?: string;
  }
): Promise<boolean> => {
  // Get user's role and context
  const userRole = await getUserRoleWithContext(userId);
  if (!userRole) return false;

  // Check feature access
  const accessLevel = await hasFeatureAccess(userId, module, action);
  if (!accessLevel || accessLevel === "none") return false;

  // Apply context-based filtering
  switch (accessLevel) {
    case "view_own":
    case "edit_own":
    case "delete_own":
      return context?.ownerId === userId;

    case "view_assigned":
    case "edit_assigned":
      return context?.assignedTo === userId;

    case "view_team":
    case "edit_team":
      return context?.departmentId === userRole.departmentId;

    case "view":
    case "create":
    case "edit_all":
    case "delete_all":
    case "approve":
    case "admin":
      return true;

    default:
      return false;
  }
};

/** Short-lived cache for module feature lists (e.g. authorizeModule / settings). */
const MODULE_FEATURES_CACHE_TTL_MS = parseInt(
  process.env.MODULE_FEATURES_CACHE_TTL_MS || "60000",
  10,
);

async function loadUserModuleFeaturesFromDb(userId: string, module: string) {
  const moduleTyped = module as ModuleType;
  return db
    .select({
      featureCode: features.featureCode,
      featureName: features.featureName,
      accessLevel: roleFeatures.accessLevel,
      conditions: roleFeatures.conditions,
      description: features.description,
    })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .innerJoin(roleFeatures, eq(roles.id, roleFeatures.roleId))
    .innerJoin(features, eq(roleFeatures.featureId, features.id))
    .where(
      and(
        eq(userRoles.userId, userId),
        eq(features.module, moduleTyped),
        eq(roles.isDeleted, false),
        eq(features.isActive, true),
        eq(roleFeatures.isActive, true)
      )
    );
}

type UserModuleFeatureRow = Awaited<
  ReturnType<typeof loadUserModuleFeaturesFromDb>
>[number];

const moduleFeaturesCache = new Map<
  string,
  { expiresAt: number; rows: UserModuleFeatureRow[] }
>();

/**
 * Get all features accessible to a user for a specific module
 */
export const getUserModuleFeatures = async (
  userId: string,
  module: string
) => {
  const key = `${userId}::${module}`;
  const now = Date.now();
  const hit = moduleFeaturesCache.get(key);
  if (hit && hit.expiresAt > now) {
    return hit.rows;
  }
  const rows = await loadUserModuleFeaturesFromDb(userId, module);
  moduleFeaturesCache.set(key, {
    expiresAt: now + MODULE_FEATURES_CACHE_TTL_MS,
    rows,
  });
  return rows;
};

/**
 * Get UI elements visible to a user for a specific module
 */
export const getUserUIElements = async (userId: string, module: string) => {
  const moduleTyped = module as ModuleType;
  const result = await db
    .select({
      elementCode: uiElements.elementCode,
      elementName: uiElements.elementName,
      elementType: uiElements.elementType,
      isVisible: roleUIElements.isVisible,
      isEnabled: roleUIElements.isEnabled,
      conditions: roleUIElements.conditions,
    })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .innerJoin(roleUIElements, eq(roles.id, roleUIElements.roleId))
    .innerJoin(uiElements, eq(roleUIElements.uiElementId, uiElements.id))
    .where(
      and(
        eq(userRoles.userId, userId),
        eq(uiElements.module, moduleTyped),
        eq(roles.isDeleted, false),
        eq(uiElements.isActive, true)
      )
    );

  return result;
};

/**
 * Get field permissions for a user in a specific module
 */
export const getUserFieldPermissions = async (
  userId: string,
  module: string
) => {
  const moduleTyped = module as ModuleType;
  const result = await db
    .select({
      fieldName: fieldPermissions.fieldName,
      accessLevel: fieldPermissions.accessLevel,
      conditions: fieldPermissions.conditions,
    })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .innerJoin(fieldPermissions, eq(roles.id, fieldPermissions.roleId))
    .where(
      and(
        eq(userRoles.userId, userId),
        eq(fieldPermissions.module, moduleTyped),
        eq(roles.isDeleted, false),
        eq(fieldPermissions.isActive, true)
      )
    );

  // Convert to object for easier lookup
  const permissions: Record<string, { accessLevel: string; conditions: any }> = {};
  for (const perm of result) {
    permissions[perm.fieldName] = {
      accessLevel: perm.accessLevel,
      conditions: perm.conditions,
    };
  }

  return permissions;
};

/**
 * Get data filters for a user in a specific module
 */
export const getUserDataFilters = async (userId: string, module: string) => {
  const moduleTyped = module as ModuleType;
  const result = await db
    .select({
      filterType: dataFilters.filterType,
      filterRule: dataFilters.filterRule,
      description: dataFilters.description,
    })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .innerJoin(dataFilters, eq(roles.id, dataFilters.roleId))
    .where(
      and(
        eq(userRoles.userId, userId),
        eq(dataFilters.module, moduleTyped),
        eq(roles.isDeleted, false),
        eq(dataFilters.isActive, true)
      )
    );

  return result;
};

/**
 * Get complete user permissions for a module (features + UI + fields + filters)
 */
export const getUserModulePermissions = async (
  userId: string,
  module: string
) => {
  const [features, uiElements, fieldPermissions, dataFilters, userRole] = await Promise.all([
    getUserModuleFeatures(userId, module),
    getUserUIElements(userId, module),
    getUserFieldPermissions(userId, module),
    getUserDataFilters(userId, module),
    getUserRoleWithContext(userId),
  ]);

  return {
    userRole,
    features,
    uiElements,
    fieldPermissions,
    dataFilters,
    module,
  };
};

/**
 * Check if user has access to any features in a module (module-level access)
 */
export const hasModuleAccess = async (
  userId: string,
  module: string
): Promise<boolean> => {
  const features = await getUserModuleFeatures(userId, module);
  return features.length > 0;
};

/**
 * Get all modules accessible to a user
 */
export const getUserAccessibleModules = async (userId: string) => {
  const result = await db
    .select({
      module: features.module,
    })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .innerJoin(roleFeatures, eq(roles.id, roleFeatures.roleId))
    .innerJoin(features, eq(roleFeatures.featureId, features.id))
    .where(
      and(
        eq(userRoles.userId, userId),
        eq(roles.isDeleted, false),
        eq(features.isActive, true),
        eq(roleFeatures.isActive, true)
      )
    )
    .groupBy(features.module);

  return result.map(r => r.module);
};

/**
 * Apply data filtering based on user's role and permissions
 * This is a helper function that returns filtering conditions
 */
export const getDataFilterConditions = async (
  userId: string,
  module: string
): Promise<{
  assignedOnly: boolean;
  departmentOnly: boolean;
  ownOnly: boolean;
  hideFinancial: boolean;
  departmentId: number | null;
  conditions: any[];
}> => {
  const userRole = await getUserRoleWithContext(userId);
  const filters = await getUserDataFilters(userId, module);

  const result: {
    assignedOnly: boolean;
    departmentOnly: boolean;
    ownOnly: boolean;
    hideFinancial: boolean;
    departmentId: number | null;
    conditions: any[];
  } = {
    assignedOnly: false,
    departmentOnly: false,
    ownOnly: false,
    hideFinancial: false,
    departmentId: null,
    conditions: [],
  };

  for (const filter of filters) {
    switch (filter.filterType) {
      case "assigned_only":
        result.assignedOnly = true;
        result.conditions.push({ assignedTo: userId });
        break;
      case "department_only":
        result.departmentOnly = true;
        result.departmentId = userRole?.departmentId ?? null;
        if (userRole?.departmentId) {
          result.conditions.push({ departmentId: userRole.departmentId });
        }
        break;
      case "own_only":
        result.ownOnly = true;
        result.conditions.push({ createdBy: userId });
        break;
      case "hide_financial":
        result.hideFinancial = true;
        break;
    }
  }

  return result;
};

/**
 * Utility function to check multiple permissions at once
 */
export const checkMultiplePermissions = async (
  userId: string,
  permissions: Array<{ module: string; feature: string }>
): Promise<Record<string, string | null>> => {
  const entries = await Promise.all(
    permissions.map(async (perm) => {
      const key = `${perm.module}:${perm.feature}`;
      const value = await hasFeatureAccess(userId, perm.module, perm.feature);
      return [key, value] as const;
    }),
  );
  return Object.fromEntries(entries);
};
