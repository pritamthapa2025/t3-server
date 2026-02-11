import { pgEnum } from "drizzle-orm/pg-core";

/**
 * Permission Module Enum
 * Defines the different modules/sections of the application
 */
export const permissionModuleEnum = pgEnum("permission_module_enum", [
  "dashboard",
  "bids",
  "jobs",
  "clients",
  "properties",
  "fleet",
  "team",
  "financial",
  "settings",
  "reports",
  "inventory",
  "compliance",
  "dispatch",
  "payroll",
  "expenses",
  "invoicing",
  "timesheet",
  "mileage",
  "capacity",
  "compensation",
  "performance",
  "maintenance",
  "survey",
  "tasks",
  "documents",
  "files",
]);

/**
 * Access Level Enum - defines the type of access a role has to a feature
 */
export const accessLevelEnum = pgEnum("access_level_enum", [
  "none",        // No access
  "view",        // Read-only access
  "view_own",    // View only own records
  "view_assigned", // View only assigned records
  "view_team",   // View team/department records
  "create",      // Can create new records
  "edit_own",    // Can edit own records
  "edit_assigned", // Can edit assigned records
  "edit_team",   // Can edit team records
  "edit_all",    // Can edit all records
  "delete_own",  // Can delete own records
  "delete_all",  // Can delete any records
  "approve",     // Can approve/reject
  "admin",       // Full administrative access
]);

/**
 * UI Element Type Enum
 */
export const uiElementTypeEnum = pgEnum("ui_element_type_enum", [
  "button",
  "field",
  "column",
  "section",
  "tab",
  "menu",
  "card",
]);