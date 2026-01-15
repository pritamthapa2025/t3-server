import {
  pgSchema,
  serial,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  jsonb,
  index,
  primaryKey,
  unique,
} from "drizzle-orm/pg-core";

// Import enums
import {
  permissionModuleEnum,
  accessLevelEnum,
  uiElementTypeEnum,
} from "../enums/auth.enums.js";

// Import roles from auth schema (re-export for seed file)
import { roles } from "./auth.schema.js";
export { roles };

export const auth = pgSchema("auth");

/**
 * Features Table
 * Defines specific features within each module
 */
export const features = auth.table(
  "features",
  {
    id: serial("id").primaryKey(),
    module: permissionModuleEnum("module").notNull(),
    featureCode: varchar("feature_code", { length: 100 }).notNull(),
    featureName: varchar("feature_name", { length: 150 }).notNull(),
    description: text("description"),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    unique("unique_module_feature").on(table.module, table.featureCode),
    index("idx_features_module").on(table.module),
    index("idx_features_active").on(table.isActive),
  ]
);

/**
 * Role Features Table
 * Maps roles to features with specific access levels
 */
export const roleFeatures = auth.table(
  "role_features",
  {
    id: serial("id").primaryKey(),
    roleId: integer("role_id")
      .notNull()
      .references(() => roles.id),
    featureId: integer("feature_id")
      .notNull()
      .references(() => features.id),
    accessLevel: accessLevelEnum("access_level").notNull(),
    conditions: jsonb("conditions"), // Additional conditions like "assigned_only", "department_only"
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    unique("unique_role_feature").on(table.roleId, table.featureId),
    index("idx_role_features_role").on(table.roleId),
    index("idx_role_features_feature").on(table.featureId),
    index("idx_role_features_access").on(table.accessLevel),
  ]
);

/**
 * UI Elements Table
 * Defines UI elements that can be shown/hidden based on permissions
 */
export const uiElements = auth.table(
  "ui_elements",
  {
    id: serial("id").primaryKey(),
    module: permissionModuleEnum("module").notNull(),
    elementCode: varchar("element_code", { length: 100 }).notNull(),
    elementName: varchar("element_name", { length: 150 }).notNull(),
    elementType: uiElementTypeEnum("element_type").notNull(),
    description: text("description"),
    requiredFeature: integer("required_feature_id").references(() => features.id), // Optional: link to required feature
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    unique("unique_module_element").on(table.module, table.elementCode),
    index("idx_ui_elements_module").on(table.module),
    index("idx_ui_elements_type").on(table.elementType),
  ]
);

/**
 * Role UI Elements Table
 * Controls which UI elements are visible/enabled for each role
 */
export const roleUIElements = auth.table(
  "role_ui_elements",
  {
    id: serial("id").primaryKey(),
    roleId: integer("role_id")
      .notNull()
      .references(() => roles.id),
    uiElementId: integer("ui_element_id")
      .notNull()
      .references(() => uiElements.id),
    isVisible: boolean("is_visible").default(true),
    isEnabled: boolean("is_enabled").default(true),
    conditions: jsonb("conditions"), // Additional display conditions
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    unique("unique_role_ui_element").on(table.roleId, table.uiElementId),
    index("idx_role_ui_elements_role").on(table.roleId),
    index("idx_role_ui_elements_element").on(table.uiElementId),
  ]
);

/**
 * Data Filters Table
 * Defines data filtering rules for roles
 */
export const dataFilters = auth.table(
  "data_filters",
  {
    id: serial("id").primaryKey(),
    roleId: integer("role_id")
      .notNull()
      .references(() => roles.id),
    module: permissionModuleEnum("module").notNull(),
    filterType: varchar("filter_type", { length: 50 }).notNull(), // "assigned_only", "department_only", "hide_financial", etc.
    filterRule: text("filter_rule").notNull(), // SQL condition or JSON rule
    description: text("description"),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_data_filters_role").on(table.roleId),
    index("idx_data_filters_module").on(table.module),
    index("idx_data_filters_type").on(table.filterType),
  ]
);

/**
 * Field Permissions Table
 * Controls field-level access (show/hide specific fields)
 */
export const fieldPermissions = auth.table(
  "field_permissions",
  {
    id: serial("id").primaryKey(),
    roleId: integer("role_id")
      .notNull()
      .references(() => roles.id),
    module: permissionModuleEnum("module").notNull(),
    fieldName: varchar("field_name", { length: 100 }).notNull(),
    accessLevel: varchar("access_level", { length: 20 }).notNull(), // "hidden", "readonly", "editable"
    conditions: jsonb("conditions"), // When this rule applies
    description: text("description"),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    unique("unique_role_module_field").on(table.roleId, table.module, table.fieldName),
    index("idx_field_permissions_role").on(table.roleId),
    index("idx_field_permissions_module").on(table.module),
  ]
);
