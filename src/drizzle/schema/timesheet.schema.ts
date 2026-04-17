import {
  pgSchema,
  uuid,
  serial,
  text,
  varchar,
  boolean,
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
 * Employee time tracking — dispatch-driven model.
 * One row per employee per calendar day.
 * totalHours is accumulated from dispatch assignment logs (not derived from clockIn/clockOut).
 */
export const timesheets = org.table(
  "timesheets",
  {
    id: serial("id").primaryKey(),

    employeeId: integer("employee_id")
      .references(() => employees.id, { onDelete: "set null" }),

    sheetDate: date("sheet_date").notNull(),

    // clockIn / clockOut removed — times live in dispatch_assignments.timeIn/timeOut

    // Daily accumulated break minutes (sum of all shift breaks for this day)
    breakMinutes: integer("break_minutes").default(0),

    // Accumulated from dispatch assignment logs via upsertTimesheetFromDispatch
    totalHours: numeric("total_hours", { precision: 5, scale: 2 }).default("0"),
    overtimeHours: numeric("overtime_hours", {
      precision: 5,
      scale: 2,
    }).default("0"),

    notes: text("notes"),

    status: timesheetStatusEnum("status").notNull().default("pending"),

    rejectedBy: uuid("rejected_by").references(() => users.id),
    approvedBy: uuid("approved_by").references(() => users.id),

    // Weekly confirmation (tech confirms on Monday morning after receiving email snapshot)
    weeklyConfirmedAt: timestamp("weekly_confirmed_at"),
    weeklyConfirmationNotes: text("weekly_confirmation_notes"),

    isDeleted: boolean("is_deleted").default(false),
    deletedAt: timestamp("deleted_at"),
    deletedBy: uuid("deleted_by").references(() => users.id),
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
    index("idx_timesheets_is_deleted").on(table.isDeleted),
    index("idx_timesheets_deleted_date_status").on(
      table.isDeleted,
      table.sheetDate,
      table.status,
    ),
    index("idx_timesheets_deleted_at").on(table.deletedAt),
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
      .references(() => timesheets.id, { onDelete: "cascade" }),

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
