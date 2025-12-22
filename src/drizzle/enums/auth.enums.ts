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
]);





