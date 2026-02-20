import { pgEnum } from "drizzle-orm/pg-core";

/**
 * Account Type Enum
 * Different types of bank accounts
 */
export const accountTypeEnum = pgEnum("account_type_enum", [
  "savings",
  "current",
  "salary",
  "checking",
  "business",
]);

/**
 * Employee Status Enum
 * Current status of employees
 */
export const employeeStatusEnum = pgEnum("employee_status_enum", [
  "available",
  "on_leave",
  "in_field",
  "terminated",
  "suspended",
]);

/**
 * Timesheet Status Enum
 * Status of employee timesheets
 */
export const timesheetStatusEnum = pgEnum("timesheet_status_enum", [
  "pending",
  "submitted",
  "approved",
  "rejected",
]);

/**
 * Client Status Enum
 * Current status of client relationships
 */
export const clientStatusEnum = pgEnum("client_status_enum", [
  "active",
  "inactive",
  "prospect",
  "suspended",
  "archived",
]);

/**
 * Client Priority Enum
 * Priority levels for client relationships
 */
export const clientPriorityEnum = pgEnum("client_priority_enum", [
  "low",
  "medium",
  "high",
]);

/**
 * Contact Type Enum
 * Types of contact relationships
 */
export const contactTypeEnum = pgEnum("contact_type_enum", [
  "primary",
  "billing",
  "technical",
  "emergency",
  "project_manager",
]);

/**
 * Property Type Enum
 * Different types of properties
 */
export const propertyTypeEnum = pgEnum("property_type_enum", [
  "residential",
  "commercial",
  "industrial",
  "retail",
  "office",
  "warehouse",
  "healthcare",
  "education",
  "hospitality",
  "mixed_use",
  "government",
  "religious",
  "other",
]);

/**
 * Property Status Enum
 * Current status of properties
 */
export const propertyStatusEnum = pgEnum("property_status_enum", [
  "active",
  "inactive",
  "under_construction",
  "archived",
]);

/**
 * User Organization Type Enum
 * Relationship types between users and organizations
 */
export const userOrganizationTypeEnum = pgEnum("user_organization_type_enum", [
  "t3_employee", // Works for T3 Mechanical
  "client_user", // Works for a client organization
  "contractor", // External contractor
]);

/**
 * Job Status Enum
 * Current status of jobs/work orders
 */
export const jobStatusEnum = pgEnum("job_status_enum", [
  "planned",
  "scheduled",
  "in_progress",
  "on_hold",
  "completed",
  "cancelled",
  "invoiced",
  "closed",
]);

/**
 * Job Priority Enum
 * Priority levels for jobs
 */
export const jobPriorityEnum = pgEnum("job_priority_enum", [
  "low",
  "medium",
  "high",
  "emergency",
]);

/**
 * Bid Status Enum
 * Status of project bids
 */
export const bidStatusEnum = pgEnum("bid_status_enum", [
  "draft",
  "in_progress",
  "pending",
  "submitted",
  "accepted",
  "won",
  "rejected",
  "lost",
  "expired",
  "cancelled",
]);

/**
 * Bid Priority Enum
 * Priority levels for bids
 */
export const bidPriorityEnum = pgEnum("bid_priority_enum", [
  "low",
  "medium",
  "high",
  "urgent",
]);

/**
 * Bid Job Type Enum
 * Types of work for bids
 */
export const bidJobTypeEnum = pgEnum("bid_job_type_enum", [
  "general",
  "plan_spec",
  "design_build",
  "service",
  "preventative_maintenance",
  "survey",
]);

/**
 * Timeline Status Enum
 * Status of project timeline items
 */
export const timelineStatusEnum = pgEnum("timeline_status_enum", [
  "completed",
  "pending",
  "in_progress",
  "cancelled",
]);

/**
 * Job Task Status Enum
 * Status of tasks within a job (UI: Backlog, In Progress, In Review, Done)
 */
export const jobTaskStatusEnum = pgEnum("job_task_status_enum", [
  "backlog",
  "in_progress",
  "in_review",
  "done",
]);
