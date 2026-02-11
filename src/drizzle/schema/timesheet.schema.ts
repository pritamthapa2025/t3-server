import {
  pgSchema,
  uuid,
  serial,
  text,
  varchar,
  timestamp,
  integer,
  numeric,
  date,
  unique,
  index,
} from "drizzle-orm/pg-core";

// Import related tables
import { users } from "./auth.schema.js";
import { employees } from "./org.schema.js";

// Import enums from centralized location
import { timesheetStatusEnum } from "../enums/org.enums.js";

const org = pgSchema("org");

/**
 * Timesheets Table
 * Employee time tracking with clock in/out functionality
 */
export const timesheets = org.table(
  "timesheets",
  {
    id: serial("id").primaryKey(),

    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id),

    sheetDate: date("sheet_date").notNull(),

    clockIn: varchar("clock_in", { length: 5 }).notNull(), // HH:MM format (24-hour)
    clockOut: varchar("clock_out", { length: 5 }), // HH:MM format (24-hour) // Nullable - populated when employee clocks out

    breakMinutes: integer("break_minutes").default(0),

    totalHours: numeric("total_hours", { precision: 5, scale: 2 }).default("0"),
    overtimeHours: numeric("overtime_hours", {
      precision: 5,
      scale: 2,
    }).default("0"),

    notes: text("notes"),

    status: timesheetStatusEnum("status").notNull().default("pending"),

    rejectedBy: uuid("rejected_by").references(() => users.id),
    approvedBy: uuid("approved_by").references(() => users.id),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    unique("unique_employee_day").on(table.employeeId, table.sheetDate),
    index("idx_timesheets_employee").on(table.employeeId),
    index("idx_timesheets_date").on(table.sheetDate),
    index("idx_timesheets_status").on(table.status),
    index("idx_timesheets_approved_by").on(table.approvedBy),
    index("idx_timesheets_rejected_by").on(table.rejectedBy),
  ]
);

/** Alias for reports.service compatibility (uses timesheets table: sheetDate, totalHours, overtimeHours) */
export const timesheetEntries = timesheets;

/**
 * Timesheet Approvals Table
 * Tracks approval actions on timesheets
 */
export const timesheetApprovals = org.table(
  "timesheet_approvals",
  {
    id: serial("id").primaryKey(),

    timesheetId: integer("timesheet_id")
      .notNull()
      .references(() => timesheets.id),

    action: varchar("action", { length: 50 }).notNull(),

    performedBy: uuid("performed_by")
      .notNull()
      .references(() => users.id),

    remarks: text("remarks"),

    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_timesheet_approvals_timesheet").on(table.timesheetId),
    index("idx_timesheet_approvals_performed_by").on(table.performedBy),
    index("idx_timesheet_approvals_created_at").on(table.createdAt),
  ]
);
