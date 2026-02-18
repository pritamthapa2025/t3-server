import {
  pgSchema,
  uuid,
  text,
  varchar,
  boolean,
  timestamp,
  integer,
  index,
  jsonb,
} from "drizzle-orm/pg-core";

// Import related tables
import { users } from "./auth.schema.js";
import { employees } from "./org.schema.js";
import { jobs } from "./jobs.schema.js";

// Import enums
import {
  dispatchTaskTypeEnum,
  dispatchTaskPriorityEnum,
  dispatchTaskStatusEnum,
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
      .references(() => jobs.id, { onDelete: "cascade" }),

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

    // Metadata
    createdBy: uuid("created_by").references(() => users.id),
    isDeleted: boolean("is_deleted").default(false),
    deletedAt: timestamp("deleted_at"),
    deletedBy: uuid("deleted_by").references(() => users.id),
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
    index("idx_dispatch_tasks_is_deleted").on(table.isDeleted),
    // Composite index for date range queries
    index("idx_dispatch_tasks_date_range").on(table.startTime, table.endTime),
  ],
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
      .references(() => dispatchTasks.id, { onDelete: "cascade" }),
    technicianId: integer("technician_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),

    // Assignment Status
    status: dispatchAssignmentStatusEnum("status").notNull().default("pending"), // pending, started, completed

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
    index("idx_dispatch_assignments_is_deleted").on(table.isDeleted),
    // Composite index for technician task queries
    index("idx_dispatch_assignments_tech_task").on(
      table.technicianId,
      table.taskId,
    ),
  ],
);
