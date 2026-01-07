import { pgEnum } from "drizzle-orm/pg-core";

/**
 * Vehicle Status Enum
 * Current operational status of vehicles
 */
export const vehicleStatusEnum = pgEnum("vehicle_status_enum", [
  "active",
  "in_maintenance",
  "out_of_service",
]);

/**
 * Vehicle Type Enum
 * Types of vehicles in the fleet
 */
export const vehicleTypeEnum = pgEnum("vehicle_type_enum", [
  "truck",
  "van",
  "car",
  "specialized",
]);

/**
 * Maintenance Status Enum
 * Status of maintenance records
 */
export const maintenanceStatusEnum = pgEnum("maintenance_status_enum", [
  "completed",
  "in_progress",
  "scheduled",
  "overdue",
  "cancelled",
  "pending_approval",
  "approved",
  "rejected",
]);

/**
 * Repair Status Enum
 * Status of repair records
 */
export const repairStatusEnum = pgEnum("repair_status_enum", [
  "completed",
  "in_progress",
  "scheduled",
  "overdue",
  "cancelled",
  "pending_approval",
  "approved",
  "rejected",
]);

/**
 * Priority Enum
 * Priority levels for maintenance and repairs
 */
export const priorityEnum = pgEnum("priority_enum", [
  "low",
  "medium",
  "high",
  "critical",
]);

/**
 * Inspection Status Enum
 * Overall status of safety inspections
 */
export const inspectionStatusEnum = pgEnum("inspection_status_enum", [
  "passed",
  "failed",
  "conditional_pass",
  "scheduled",
  "overdue",
]);

/**
 * Inspection Item Status Enum
 * Status of individual inspection items
 */
export const inspectionItemStatusEnum = pgEnum("inspection_item_status_enum", [
  "passed",
  "failed",
]);

/**
 * Fuel Type Enum
 * Types of fuel for vehicles
 */
export const fuelTypeEnum = pgEnum("fuel_type_enum", [
  "gasoline",
  "diesel",
  "electric",
]);

/**
 * Check-In/Out Type Enum
 * Type of check-in/out record
 */
export const checkInOutTypeEnum = pgEnum("check_in_out_type_enum", [
  "check_in",
  "check_out",
]);

