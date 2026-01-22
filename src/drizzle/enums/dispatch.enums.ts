import { pgEnum } from "drizzle-orm/pg-core";

/**
 * Dispatch Task Type Enum
 * Types of dispatch tasks
 */
export const dispatchTaskTypeEnum = pgEnum("dispatch_task_type_enum", [
  "service",
  "pm", // Preventive Maintenance
  "install",
  "emergency",
  "survey",
]);

/**
 * Dispatch Task Priority Enum
 * Priority levels for dispatch tasks
 */
export const dispatchTaskPriorityEnum = pgEnum("dispatch_task_priority_enum", [
  "low",
  "medium",
  "high",
  "emergency",
]);

/**
 * Dispatch Task Status Enum
 * Status of dispatch tasks
 */
export const dispatchTaskStatusEnum = pgEnum("dispatch_task_status_enum", [
  "pending",
  "assigned",
  "in_progress",
  "completed",
  "cancelled",
]);

/**
 * Technician Status Enum
 * Current status of technicians
 */
export const technicianStatusEnum = pgEnum("technician_status_enum", [
  "available",
  "on_job",
  "off_shift",
  "break",
  "pto", // Paid Time Off
]);

/**
 * Dispatch Assignment Status Enum
 * Status of individual technician assignments to tasks
 */
export const dispatchAssignmentStatusEnum = pgEnum("dispatch_assignment_status_enum", [
  "pending",
  "started",
  "completed",
]);





