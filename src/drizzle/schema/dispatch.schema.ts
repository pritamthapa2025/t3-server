import {
  pgSchema,
  uuid,
  text,
  varchar,
  boolean,
  timestamp,
  integer,
  numeric,
  index,
  jsonb,
  time,
} from "drizzle-orm/pg-core";

// Import related tables
import { users } from "./auth.schema.js";
import { organizations, employees } from "./org.schema.js";
import { jobs } from "./jobs.schema.js";
import { vehicles } from "./fleet.schema.js";

// Import enums
import {
  dispatchTaskTypeEnum,
  dispatchTaskPriorityEnum,
  dispatchTaskStatusEnum,
  technicianStatusEnum,
  dispatchAssignmentStatusEnum,
} from "../enums/dispatch.enums.js";

const org = pgSchema("org");

/**
 * ============================================================================
 * DISPATCH TASKS TABLE
 * ============================================================================
 * Main dispatch tasks table - Tasks assigned to technicians for jobs
 */
export const dispatchTasks = org.table(
  "dispatch_tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    
    // Job Relationship
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id),
    
    // Task Details
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    taskType: dispatchTaskTypeEnum("task_type").notNull(), // service, pm, install, emergency, survey
    priority: dispatchTaskPriorityEnum("priority").notNull().default("medium"), // low, medium, high, emergency
    status: dispatchTaskStatusEnum("status").notNull().default("pending"), // pending, assigned, in_progress, completed, cancelled
    
    // Scheduling
    startTime: timestamp("start_time").notNull(), // ISO datetime
    endTime: timestamp("end_time").notNull(), // ISO datetime
    estimatedDuration: integer("estimated_duration"), // Duration in minutes
    
    // Linked Job Tasks (optional - links to specific job tasks)
    linkedJobTaskIds: jsonb("linked_job_task_ids"), // Array of job task IDs
    
    // Notes & Attachments
    notes: text("notes"),
    attachments: jsonb("attachments"), // Array of file references/URLs
    
    // Vehicle Assignment (optional - links to fleet vehicle)
    assignedVehicleId: uuid("assigned_vehicle_id").references(() => vehicles.id),
    
    // Metadata
    createdBy: uuid("created_by").references(() => users.id),
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_dispatch_tasks_job").on(table.jobId),
    index("idx_dispatch_tasks_status").on(table.status),
    index("idx_dispatch_tasks_type").on(table.taskType),
    index("idx_dispatch_tasks_priority").on(table.priority),
    index("idx_dispatch_tasks_start_time").on(table.startTime),
    index("idx_dispatch_tasks_end_time").on(table.endTime),
    index("idx_dispatch_tasks_vehicle").on(table.assignedVehicleId),
    index("idx_dispatch_tasks_is_deleted").on(table.isDeleted),
    // Composite index for date range queries
    index("idx_dispatch_tasks_date_range").on(table.startTime, table.endTime),
  ]
);

/**
 * ============================================================================
 * DISPATCH ASSIGNMENTS TABLE
 * ============================================================================
 * Many-to-many relationship between dispatch tasks and technicians
 * Tracks individual technician assignments with clock in/out times
 */
export const dispatchAssignments = org.table(
  "dispatch_assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    
    // Relationships
    taskId: uuid("task_id")
      .notNull()
      .references(() => dispatchTasks.id),
    technicianId: integer("technician_id")
      .notNull()
      .references(() => employees.id),
    
    // Assignment Status
    status: dispatchAssignmentStatusEnum("status").notNull().default("pending"), // pending, started, completed
    
    // Time Tracking
    clockIn: timestamp("clock_in"), // When technician started work
    clockOut: timestamp("clock_out"), // When technician finished work
    actualDuration: integer("actual_duration"), // Actual duration in minutes (calculated from clock in/out)
    
    // Role in Task
    role: varchar("role", { length: 50 }), // "Primary Tech", "Helper", etc.
    
    // Metadata
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_dispatch_assignments_task").on(table.taskId),
    index("idx_dispatch_assignments_technician").on(table.technicianId),
    index("idx_dispatch_assignments_status").on(table.status),
    index("idx_dispatch_assignments_clock_in").on(table.clockIn),
    index("idx_dispatch_assignments_is_deleted").on(table.isDeleted),
    // Composite index for technician task queries
    index("idx_dispatch_assignments_tech_task").on(table.technicianId, table.taskId),
  ]
);

/**
 * ============================================================================
 * TECHNICIAN AVAILABILITY TABLE
 * ============================================================================
 * Tracks technician availability, status, and shift information
 */
export const technicianAvailability = org.table(
  "technician_availability",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    
    // Employee Relationship
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id),
    
    // Date for this availability record
    date: timestamp("date").notNull(), // Date for which this availability applies
    
    // Status
    status: technicianStatusEnum("status").notNull().default("available"), // available, on_job, off_shift, break, pto
    
    // Shift Information
    shiftStart: time("shift_start"), // Shift start time (e.g., "08:00:00")
    shiftEnd: time("shift_end"), // Shift end time (e.g., "17:00:00")
    
    // Scheduling
    hoursScheduled: numeric("hours_scheduled", { precision: 5, scale: 2 }).default("0"), // Total hours scheduled for the day
    
    // Role
    role: varchar("role", { length: 50 }), // "Primary Tech", "Helper", etc.
    
    // Notes
    notes: text("notes"), // Any additional notes about availability
    
    // Metadata
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_technician_availability_employee").on(table.employeeId),
    index("idx_technician_availability_date").on(table.date),
    index("idx_technician_availability_status").on(table.status),
    index("idx_technician_availability_is_deleted").on(table.isDeleted),
    // Composite index for employee date queries
    index("idx_technician_availability_employee_date").on(table.employeeId, table.date),
  ]
);

