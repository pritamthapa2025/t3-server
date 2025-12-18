import {
  pgSchema,
  uuid,
  text,
  varchar,
  boolean,
  timestamp,
  integer,
  jsonb,
  numeric,
  date,
  time,
  unique,
  index,
  serial,
  check,
} from "drizzle-orm/pg-core";
import { users } from "./auth.schema.js";
import { employees, departments } from "./org.schema.js";
import { jobs } from "./jobs.schema.js";
import {
  shiftTypeEnum,
  availabilityStatusEnum,
  resourceAllocationStatusEnum,
  capacityPeriodTypeEnum,
} from "../enums/capacity.enums.js";

const org = pgSchema("org");

// 1. Employee Shift Schedules
export const employeeShifts = org.table(
  "employee_shifts",
  {
    id: serial("id").primaryKey(),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),

    // Shift Details
    shiftDate: date("shift_date").notNull(),
    shiftStart: time("shift_start").notNull(),
    shiftEnd: time("shift_end").notNull(),
    shiftType: shiftTypeEnum("shift_type").notNull().default("regular"),

    // Capacity
    plannedHours: numeric("planned_hours", { precision: 5, scale: 2 }).notNull().default("8.00"),
    availableHours: numeric("available_hours", { precision: 5, scale: 2 }).notNull().default("8.00"), // Adjusts for breaks, meetings
    breakMinutes: integer("break_minutes").default(0),

    // Status
    isActive: boolean("is_active").default(true),
    notes: text("notes"),

    // Metadata
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    unique("unique_employee_shift_date").on(table.employeeId, table.shiftDate),
    index("idx_employee_shifts_employee").on(table.employeeId),
    index("idx_employee_shifts_date").on(table.shiftDate),
    index("idx_employee_shifts_active").on(table.isActive, table.shiftDate),
  ]
);

// 2. Real-time Employee Availability
export const employeeAvailability = org.table(
  "employee_availability",
  {
    id: serial("id").primaryKey(),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),

    // Current Status
    currentStatus: availabilityStatusEnum("current_status").notNull().default("available"),
    location: varchar("location", { length: 255 }), // Current work location

    // Time Tracking
    statusStartTime: timestamp("status_start_time").notNull().defaultNow(),
    expectedAvailableTime: timestamp("expected_available_time"), // When they'll be available again

    // Current Assignment
    currentJobId: uuid("current_job_id").references(() => jobs.id, { onDelete: "set null" }),
    currentTaskDescription: text("current_task_description"),

    // Metadata
    lastUpdated: timestamp("last_updated").defaultNow(),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
  },
  (table) => [
    unique("unique_employee_availability").on(table.employeeId), // Ensure one record per employee
    index("idx_employee_availability_status").on(table.currentStatus),
    index("idx_employee_availability_job").on(table.currentJobId),
    index("idx_employee_availability_updated").on(table.lastUpdated),
  ]
);

// 3. Resource Allocation Planning
export const resourceAllocations = org.table(
  "resource_allocations",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // Assignment Details
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    jobId: uuid("job_id").references(() => jobs.id, { onDelete: "cascade" }),
    taskId: uuid("task_id"), // Link to specific job task if applicable

    // Time Allocation
    plannedStartTime: timestamp("planned_start_time").notNull(),
    plannedEndTime: timestamp("planned_end_time").notNull(),
    plannedHours: numeric("planned_hours", { precision: 5, scale: 2 }).notNull(),

    // Actual Time (filled during execution)
    actualStartTime: timestamp("actual_start_time"),
    actualEndTime: timestamp("actual_end_time"),
    actualHours: numeric("actual_hours", { precision: 5, scale: 2 }),

    // Status & Priority
    status: resourceAllocationStatusEnum("status").notNull().default("planned"),
    priority: integer("priority").default(3), // 1=High, 2=Medium, 3=Low, 4=Emergency

    // Metadata
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    assignedBy: uuid("assigned_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_resource_allocations_employee").on(table.employeeId),
    index("idx_resource_allocations_job").on(table.jobId),
    index("idx_resource_allocations_time").on(table.plannedStartTime, table.plannedEndTime),
    index("idx_resource_allocations_status").on(table.status),
    index("idx_resource_allocations_priority").on(table.priority, table.plannedStartTime),
  ]
);

// 4. Department Capacity Metrics
export const departmentCapacityMetrics = org.table(
  "department_capacity_metrics",
  {
    id: serial("id").primaryKey(),
    departmentId: integer("department_id")
      .notNull()
      .references(() => departments.id, { onDelete: "cascade" }),

    // Time Period
    metricDate: date("metric_date").notNull(),
    periodType: capacityPeriodTypeEnum("period_type").notNull().default("daily"),

    // Capacity Metrics
    totalEmployees: integer("total_employees").notNull().default(0),
    availableEmployees: integer("available_employees").notNull().default(0),
    totalPlannedHours: numeric("total_planned_hours", { precision: 8, scale: 2 }).notNull().default("0"),
    totalScheduledHours: numeric("total_scheduled_hours", { precision: 8, scale: 2 }).notNull().default("0"),
    totalActualHours: numeric("total_actual_hours", { precision: 8, scale: 2 }).default("0"),

    // Utilization Calculations
    utilizationPercentage: numeric("utilization_percentage", { precision: 5, scale: 2 }).notNull().default("0"), // scheduled/available
    efficiencyPercentage: numeric("efficiency_percentage", { precision: 5, scale: 2 }).default("0"), // actual/scheduled

    // Job Distribution
    activeJobsCount: integer("active_jobs_count").default(0),
    completedJobsCount: integer("completed_jobs_count").default(0),

    // Coverage Areas
    coverageAreas: jsonb("coverage_areas"), // ["Downtown", "Suburbs", "Industrial"]

    // Metadata
    calculatedAt: timestamp("calculated_at").defaultNow(),
    calculatedBy: uuid("calculated_by").references(() => users.id, { onDelete: "set null" }),
  },
  (table) => [
    unique("unique_dept_capacity_metric").on(table.departmentId, table.metricDate, table.periodType),
    index("idx_dept_capacity_metrics_dept").on(table.departmentId),
    index("idx_dept_capacity_metrics_date").on(table.metricDate),
    index("idx_dept_capacity_metrics_period").on(table.departmentId, table.periodType, table.metricDate),
  ]
);

// 5. Team Utilization History (for charts and trends)
export const teamUtilizationHistory = org.table(
  "team_utilization_history",
  {
    id: serial("id").primaryKey(),

    // Scope
    departmentId: integer("department_id").references(() => departments.id, { onDelete: "cascade" }),
    employeeId: integer("employee_id").references(() => employees.id, { onDelete: "cascade" }),

    // Time Period
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    periodType: capacityPeriodTypeEnum("period_type").notNull(),

    // Utilization Metrics
    plannedHours: numeric("planned_hours", { precision: 8, scale: 2 }).notNull().default("0"),
    scheduledHours: numeric("scheduled_hours", { precision: 8, scale: 2 }).notNull().default("0"),
    actualHours: numeric("actual_hours", { precision: 8, scale: 2 }).default("0"),
    utilizationRate: numeric("utilization_rate", { precision: 5, scale: 4 }).notNull().default("0"), // 0.0000 to 2.0000 (0-200%)

    // Performance Indicators
    onTimeCompletionRate: numeric("on_time_completion_rate", { precision: 5, scale: 4 }).default("0"),
    jobCount: integer("job_count").default(0),
    overtimeHours: numeric("overtime_hours", { precision: 8, scale: 2 }).default("0"),

    // Metadata
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_team_utilization_dept").on(table.departmentId),
    index("idx_team_utilization_employee").on(table.employeeId),
    index("idx_team_utilization_period").on(table.periodStart, table.periodEnd),
    index("idx_team_utilization_type").on(table.periodType, table.periodStart),
  ]
);

// 6. Capacity Planning Templates (for recurring schedules)
export const capacityPlanningTemplates = org.table(
  "capacity_planning_templates",
  {
    id: serial("id").primaryKey(),

    // Template Info
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    departmentId: integer("department_id").references(() => departments.id, { onDelete: "cascade" }),

    // Schedule Pattern
    dayOfWeek: integer("day_of_week"), // 0=Sunday, 1=Monday, etc. (NULL for daily)
    shiftStart: time("shift_start").notNull(),
    shiftEnd: time("shift_end").notNull(),
    plannedHours: numeric("planned_hours", { precision: 5, scale: 2 }).notNull(),

    // Capacity Rules
    minEmployees: integer("min_employees").default(1),
    maxEmployees: integer("max_employees"),
    requiredSkills: jsonb("required_skills"), // ["HVAC", "Electrical"]

    // Status
    isActive: boolean("is_active").default(true),
    effectiveFrom: date("effective_from").notNull(),
    effectiveTo: date("effective_to"),

    // Metadata
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_capacity_templates_dept").on(table.departmentId),
    index("idx_capacity_templates_active").on(table.isActive, table.effectiveFrom, table.effectiveTo),
    index("idx_capacity_templates_day").on(table.dayOfWeek),
  ]
);



