import {
  count,
  eq,
  ne,
  and,
  or,
  ilike,
  sql,
  sum,
  desc,
  gte,
  lte,
  inArray,
  getTableColumns,
  isNull,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../config/db.js";
import { isStale, STALE_DATA } from "../utils/optimistic-lock.js";
import { employees, departments } from "../drizzle/schema/org.schema.js";
import {
  timesheets,
  timesheetApprovals,
  timesheetJobEntries,
} from "../drizzle/schema/timesheet.schema.js";
import { jobs } from "../drizzle/schema/jobs.schema.js";
import { bidsTable } from "../drizzle/schema/bids.schema.js";
import { dispatchAssignments, dispatchTasks } from "../drizzle/schema/dispatch.schema.js";
import { users } from "../drizzle/schema/auth.schema.js";
import { getUserRoles } from "./role.service.js";
import {
  businessTodayLocalDateString,
  formatLocalDateStringFromDate,
} from "../utils/naive-datetime.js";

// Aliases for joining users table multiple times
const approverUser = alias(users, "approver_user");
const rejectorUser = alias(users, "rejector_user");

async function assertEmployeeNotTimesheetBlockedForSafetyInspection(
  employeeId: number,
): Promise<void> {
  const [row] = await db
    .select({
      blocked: employees.timesheetBlockedSafetyInspection,
    })
    .from(employees)
    .where(
      and(
        eq(employees.id, employeeId),
        or(eq(employees.isDeleted, false), isNull(employees.isDeleted)),
      ),
    )
    .limit(1);

  if (row?.blocked) {
    throw new Error(
      "Timesheet access is blocked until you complete the required vehicle safety inspection. Contact your manager if you need help.",
    );
  }
}

export const getTimesheets = async (
  offset: number,
  limit: number,
  search?: string,
  options?: { ownEmployeeId?: number; departmentId?: number },
) => {
  let whereConditions: any[] = [];

  if (options?.ownEmployeeId !== undefined) {
    whereConditions.push(eq(timesheets.employeeId, options.ownEmployeeId));
  }

  if (options?.departmentId !== undefined) {
    whereConditions.push(eq(employees.departmentId, options.departmentId));
  }

  if (search) {
    whereConditions.push(
      or(
        ilike(timesheets.notes, `%${search}%`),
        ilike(timesheets.status, `%${search}%`),
        ilike(employees.employeeId, `%${search}%`),
        ilike(users.fullName, `%${search}%`),
      )!,
    );
  }

  const whereClause =
    whereConditions.length > 0 ? and(...whereConditions) : undefined;

  const result = await db
    .select({
      timesheet: {
        ...getTableColumns(timesheets),
        approvedByName: approverUser.fullName,
        rejectedByName: rejectorUser.fullName,
      },
    })
    .from(timesheets)
    .leftJoin(employees, eq(timesheets.employeeId, employees.id))
    .leftJoin(users, eq(employees.userId, users.id))
    .leftJoin(approverUser, eq(timesheets.approvedBy, approverUser.id))
    .leftJoin(rejectorUser, eq(timesheets.rejectedBy, rejectorUser.id))
    .where(whereClause)
    .limit(limit)
    .offset(offset);

  const timesheetData = result.map((row) => {
    const { approvedByName, rejectedByName, ...timesheet } = row.timesheet;
    return {
      ...timesheet,
      approvedByName: approvedByName ?? null,
      rejectedByName: rejectedByName ?? null,
    };
  });

  const total = await db
    .select({ count: count() })
    .from(timesheets)
    .leftJoin(employees, eq(timesheets.employeeId, employees.id))
    .leftJoin(users, eq(employees.userId, users.id))
    .where(whereClause);

  const totalCount = total[0]?.count ?? 0;

  return {
    data: timesheetData || [],
    total: totalCount,
    pagination: {
      page: Math.floor(offset / limit) + 1,
      limit: limit,
      totalPages: Math.ceil(totalCount / limit),
    },
  };
};

export const getTimesheetById = async (id: number) => {
  const [row] = await db
    .select({
      ...getTableColumns(timesheets),
      approvedByName: approverUser.fullName,
      rejectedByName: rejectorUser.fullName,
    })
    .from(timesheets)
    .leftJoin(approverUser, eq(timesheets.approvedBy, approverUser.id))
    .leftJoin(rejectorUser, eq(timesheets.rejectedBy, rejectorUser.id))
    .where(and(eq(timesheets.id, id), eq(timesheets.isDeleted, false)));

  if (!row) return null;

  const { approvedByName, rejectedByName, ...timesheet } = row;

  if (timesheet.status === "rejected") {
    const [rejectionRecord] = await db
      .select({ remarks: timesheetApprovals.remarks })
      .from(timesheetApprovals)
      .where(
        and(
          eq(timesheetApprovals.timesheetId, id),
          eq(timesheetApprovals.action, "rejected"),
        ),
      )
      .orderBy(desc(timesheetApprovals.createdAt))
      .limit(1);

    if (rejectionRecord?.remarks) {
      const remarks = rejectionRecord.remarks;
      const managerNotesIndex = remarks.indexOf("\n\nManager Notes:");
      const rejectionReason =
        managerNotesIndex > 0
          ? remarks.substring(0, managerNotesIndex)
          : remarks;

      return {
        ...timesheet,
        approvedByName: approvedByName ?? null,
        rejectedByName: rejectedByName ?? null,
        rejectionReason,
      };
    }
  }

  return {
    ...timesheet,
    approvedByName: approvedByName ?? null,
    rejectedByName: rejectedByName ?? null,
  };
};

export const createTimesheet = async (data: {
  employeeId: number;
  sheetDate: Date | string;
  breakMinutes?: number;
  totalHours?: string;
  overtimeHours?: string;
  notes?: string;
}) => {
  await assertEmployeeNotTimesheetBlockedForSafetyInspection(data.employeeId);

  const sheetDateStr = String(data.sheetDate).split("T")[0]!;

  const totalHours = data.totalHours || "0";
  const regularHours = 8;
  const overtimeHours =
    data.overtimeHours ??
    Math.max(0, parseFloat(totalHours) - regularHours).toFixed(2);

  const [timesheet] = await db
    .insert(timesheets)
    .values({
      employeeId: data.employeeId,
      sheetDate: sheetDateStr as string,
      breakMinutes: data.breakMinutes || 0,
      totalHours,
      overtimeHours,
      notes: data.notes || null,
      status: "pending",
      rejectedBy: null,
      approvedBy: null,
    })
    .returning();

  return timesheet;
};

export const updateTimesheet = async (
  id: number,
  data: {
    employeeId?: number;
    sheetDate?: Date | string;
    breakMinutes?: number;
    totalHours?: string;
    overtimeHours?: string;
    notes?: string;
    status?: "pending" | "submitted" | "approved" | "rejected";
    rejectedBy?: string;
    approvedBy?: string;
  },
  clientUpdatedAt?: string,
) => {
  const [existingTimesheet] = await db
    .select()
    .from(timesheets)
    .where(and(eq(timesheets.id, id), eq(timesheets.isDeleted, false)));

  if (!existingTimesheet) return null;

  if (isStale(existingTimesheet.updatedAt, clientUpdatedAt)) return STALE_DATA;

  const updateData: Record<string, any> = { updatedAt: new Date() };

  if (data.employeeId !== undefined) updateData.employeeId = data.employeeId;

  if (data.sheetDate !== undefined) {
    updateData.sheetDate =
      data.sheetDate instanceof Date
        ? formatLocalDateStringFromDate(data.sheetDate)
        : String(data.sheetDate);
  }

  if (data.breakMinutes !== undefined)
    updateData.breakMinutes = data.breakMinutes ?? null;
  if (data.totalHours !== undefined)
    updateData.totalHours = data.totalHours ?? null;
  if (data.overtimeHours !== undefined)
    updateData.overtimeHours = data.overtimeHours ?? null;
  if (data.notes !== undefined) updateData.notes = data.notes ?? null;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.rejectedBy !== undefined)
    updateData.rejectedBy = data.rejectedBy ?? null;
  if (data.approvedBy !== undefined)
    updateData.approvedBy = data.approvedBy ?? null;

  const [timesheet] = await db
    .update(timesheets)
    .set(updateData)
    .where(eq(timesheets.id, id))
    .returning();

  // Notify on first submission
  if (
    timesheet &&
    data.status === "submitted" &&
    existingTimesheet.status === "pending"
  ) {
    void notifyTimesheetStatus("timesheet_submitted", timesheetId(timesheet), existingTimesheet.employeeId);
  }

  // Notify on resubmission
  if (
    timesheet &&
    data.status === "submitted" &&
    existingTimesheet.status === "rejected"
  ) {
    void notifyTimesheetStatus("timesheet_resubmitted", timesheetId(timesheet), existingTimesheet.employeeId);
  }

  return timesheet || null;
};

function timesheetId(t: { id: number }) {
  return t.id;
}

async function notifyTimesheetStatus(
  type: string,
  id: number,
  employeeId: number | null | undefined,
) {
  try {
    const empId = employeeId;
    const [empRow] =
      empId != null
        ? await db
            .select({ departmentId: employees.departmentId })
            .from(employees)
            .where(eq(employees.id, empId))
            .limit(1)
        : [];
    const departmentId = empRow?.departmentId ?? undefined;
    const { NotificationService } = await import("./notification.service.js");
    await new NotificationService().triggerNotification({
      type,
      category: "timesheet",
      priority: "medium",
      data: {
        entityType: "Timesheet",
        entityId: String(id),
        entityName: `Timesheet #${id}`,
        employeeId: String(employeeId),
        ...(departmentId != null ? { departmentId: String(departmentId) } : {}),
      },
    });
  } catch (err) {
    console.error(`[Notification] ${type} failed:`, err);
  }
}

export const deleteTimesheet = async (id: number, deletedBy: string) => {
  const now = new Date();
  const [timesheet] = await db
    .update(timesheets)
    .set({ isDeleted: true, deletedAt: now, deletedBy, updatedAt: now })
    .where(and(eq(timesheets.id, id), eq(timesheets.isDeleted, false)))
    .returning();
  return timesheet || null;
};

/**
 * Atomically add hours to a daily timesheet row (upsert).
 * Called by dispatch.service after every shift log / edit / delete.
 * addedNetHours can be negative (for edits reducing hours, or deletes).
 */
export const upsertTimesheetFromDispatch = async (
  employeeId: number,
  workDate: string,        // YYYY-MM-DD
  addedNetHours: number,   // net shift hours (after break deduction); negative for removals
  addedBreakMinutes: number,
) => {
  await assertEmployeeNotTimesheetBlockedForSafetyInspection(employeeId);

  const REGULAR_HOURS = 8;

  const [existing] = await db
    .select()
    .from(timesheets)
    .where(
      and(
        eq(timesheets.employeeId, employeeId),
        eq(timesheets.sheetDate, workDate as string),
        eq(timesheets.isDeleted, false),
      ),
    )
    .limit(1);

  if (existing) {
    const newTotal = Math.max(
      0,
      parseFloat(existing.totalHours || "0") + addedNetHours,
    );
    const newBreak = Math.max(
      0,
      (existing.breakMinutes || 0) + addedBreakMinutes,
    );
    const newOt = Math.max(0, newTotal - REGULAR_HOURS);

    await db
      .update(timesheets)
      .set({
        totalHours: newTotal.toFixed(2),
        overtimeHours: newOt.toFixed(2),
        breakMinutes: newBreak,
        updatedAt: new Date(),
      })
      .where(eq(timesheets.id, existing.id));
  } else if (addedNetHours > 0) {
    // Only INSERT if there are positive hours to record
    const newOt = Math.max(0, addedNetHours - REGULAR_HOURS);
    await db.insert(timesheets).values({
      employeeId,
      sheetDate: workDate as string,
      breakMinutes: Math.max(0, addedBreakMinutes),
      totalHours: addedNetHours.toFixed(2),
      overtimeHours: newOt.toFixed(2),
      status: "pending",
      rejectedBy: null,
      approvedBy: null,
    });
  }
};

/**
 * Bulk approve all timesheet days in a week for one employee.
 */
export const approveWeek = async (
  employeeId: number,
  weekStart: string,  // YYYY-MM-DD (Monday)
  weekEnd: string,    // YYYY-MM-DD (Sunday)
  approvedBy: string, // UUID
  notes?: string,
) => {
  // Only fetch rows that are not already approved — avoids duplicate audit entries
  // and is idempotent when mixing day-level and week-level approvals.
  const rows = await db
    .select({ id: timesheets.id })
    .from(timesheets)
    .where(
      and(
        eq(timesheets.employeeId, employeeId),
        gte(timesheets.sheetDate, weekStart as string),
        lte(timesheets.sheetDate, weekEnd as string),
        eq(timesheets.isDeleted, false),
        ne(timesheets.status, "approved"),
      ),
    );

  if (rows.length === 0) return { approved: 0 };

  await db
    .update(timesheets)
    .set({
      status: "approved",
      approvedBy,
      rejectedBy: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(timesheets.employeeId, employeeId),
        gte(timesheets.sheetDate, weekStart as string),
        lte(timesheets.sheetDate, weekEnd as string),
        eq(timesheets.isDeleted, false),
        ne(timesheets.status, "approved"),
      ),
    );

  // Audit trail — one approval record per newly-approved row only
  for (const row of rows) {
    await db.insert(timesheetApprovals).values({
      timesheetId: row.id,
      action: "approved",
      performedBy: approvedBy,
      remarks: notes ?? null,
    });
  }

  // Fire approved notification for the employee
  void notifyTimesheetStatus(
    "timesheet_approved",
    rows[0]!.id,
    employeeId,
  );

  return { approved: rows.length };
};

/**
 * Bulk reject all timesheet days in a week for one employee.
 */
export const rejectWeek = async (
  employeeId: number,
  weekStart: string,
  weekEnd: string,
  rejectedBy: string,
  rejectionReason: string,
  notes?: string,
) => {
  // Skip individually-approved rows — week reject must not overwrite a day
  // that has already been explicitly approved by a manager.
  const rows = await db
    .select({ id: timesheets.id })
    .from(timesheets)
    .where(
      and(
        eq(timesheets.employeeId, employeeId),
        gte(timesheets.sheetDate, weekStart as string),
        lte(timesheets.sheetDate, weekEnd as string),
        eq(timesheets.isDeleted, false),
        ne(timesheets.status, "approved"),
      ),
    );

  if (rows.length === 0) return { rejected: 0 };

  await db
    .update(timesheets)
    .set({
      status: "rejected",
      rejectedBy,
      approvedBy: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(timesheets.employeeId, employeeId),
        gte(timesheets.sheetDate, weekStart as string),
        lte(timesheets.sheetDate, weekEnd as string),
        eq(timesheets.isDeleted, false),
        ne(timesheets.status, "approved"),
      ),
    );

  const remarks = notes
    ? `${rejectionReason}\n\nManager Notes: ${notes}`
    : rejectionReason;

  for (const row of rows) {
    await db.insert(timesheetApprovals).values({
      timesheetId: row.id,
      action: "rejected",
      performedBy: rejectedBy,
      remarks,
    });
  }

  void notifyTimesheetStatus("timesheet_rejected", rows[0]!.id, employeeId);

  return { rejected: rows.length };
};

/**
 * Tech confirms their weekly timesheet on Monday (after receiving the email snapshot).
 * Flips all pending/rejected rows to "submitted" and stores confirmation metadata.
 */
export const confirmWeek = async (
  employeeId: number,
  weekStart: string,
  weekEnd: string,
  notes?: string,
) => {
  const now = new Date();

  await db
    .update(timesheets)
    .set({
      status: "submitted",
      weeklyConfirmedAt: now,
      weeklyConfirmationNotes: notes ?? null,
      updatedAt: now,
    })
    .where(
      and(
        eq(timesheets.employeeId, employeeId),
        gte(timesheets.sheetDate, weekStart as string),
        lte(timesheets.sheetDate, weekEnd as string),
        eq(timesheets.isDeleted, false),
        or(
          eq(timesheets.status, "pending"),
          eq(timesheets.status, "rejected"),
        ),
      ),
    );

  // Fire submitted notification
  const [firstRow] = await db
    .select({ id: timesheets.id })
    .from(timesheets)
    .where(
      and(
        eq(timesheets.employeeId, employeeId),
        gte(timesheets.sheetDate, weekStart as string),
        lte(timesheets.sheetDate, weekEnd as string),
      ),
    )
    .limit(1);

  if (firstRow) {
    void notifyTimesheetStatus("timesheet_submitted", firstRow.id, employeeId);
  }

  return { confirmed: true };
};

export const getWeeklyTimesheetsByEmployee = async (
  weekStartDate: string,
  employeeIds?: number[],
  departmentId?: number,
  status?: string,
  page: number = 1,
  limit: number = 10,
) => {
  const startDateStr = weekStartDate;
  const weekStartUTC = new Date(weekStartDate + "T00:00:00Z");
  const weekEndUTC = new Date(weekStartUTC);
  weekEndUTC.setUTCDate(weekStartUTC.getUTCDate() + 6);
  const endDateStr = formatLocalDateStringFromDate(weekEndUTC);

  const offset = (page - 1) * limit;

  let whereConditions: any[] = [];
  let employeeWhereConditions: any[] = [eq(employees.isDeleted, false)];

  whereConditions.push(
    sql`${timesheets.sheetDate} >= ${startDateStr} AND ${timesheets.sheetDate} <= ${endDateStr}`,
  );

  if (employeeIds && employeeIds.length > 0) {
    whereConditions.push(inArray(employees.id, employeeIds));
    employeeWhereConditions.push(inArray(employees.id, employeeIds));
  }

  if (departmentId) {
    whereConditions.push(eq(employees.departmentId, departmentId));
    employeeWhereConditions.push(eq(employees.departmentId, departmentId));
  }

  if (status) {
    whereConditions.push(eq(timesheets.status, status as any));
  }

  const whereClause = and(...whereConditions);
  const employeeWhereClause = and(...employeeWhereConditions);

  const localApproverUser = alias(users, "approver_user");
  const localRejectorUser = alias(users, "rejector_user");

  const result = await db
    .select({
      timesheet: {
        id: timesheets.id,
        employeeId: timesheets.employeeId,
        sheetDate: timesheets.sheetDate,
        breakMinutes: timesheets.breakMinutes,
        totalHours: timesheets.totalHours,
        overtimeHours: timesheets.overtimeHours,
        notes: timesheets.notes,
        status: timesheets.status,
        rejectedBy: timesheets.rejectedBy,
        approvedBy: timesheets.approvedBy,
        weeklyConfirmedAt: timesheets.weeklyConfirmedAt,
        weeklyConfirmationNotes: timesheets.weeklyConfirmationNotes,
        createdAt: timesheets.createdAt,
        updatedAt: timesheets.updatedAt,
      },
      employee: {
        id: employees.id,
        employeeId: employees.employeeId,
        departmentId: employees.departmentId,
        positionId: employees.positionId,
        hourlyRate: employees.hourlyRate,
      },
      user: {
        id: users.id,
        fullName: users.fullName,
        email: users.email,
      },
      department: {
        id: departments.id,
        name: departments.name,
      },
      approver: {
        id: localApproverUser.id,
        fullName: localApproverUser.fullName,
      },
      rejector: {
        id: localRejectorUser.id,
        fullName: localRejectorUser.fullName,
      },
    })
    .from(timesheets)
    .innerJoin(employees, eq(timesheets.employeeId, employees.id))
    .innerJoin(users, eq(employees.userId, users.id))
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .leftJoin(localApproverUser, eq(timesheets.approvedBy, localApproverUser.id))
    .leftJoin(localRejectorUser, eq(timesheets.rejectedBy, localRejectorUser.id))
    .where(whereClause)
    .orderBy(users.fullName, timesheets.sheetDate);

  const timesheetIds = result.map((row) => row.timesheet.id).filter((id) => id);
  let approvalHistoryMap = new Map<number, any[]>();

  if (timesheetIds.length > 0) {
    const approvalHistory = await db
      .select({
        timesheetId: timesheetApprovals.timesheetId,
        action: timesheetApprovals.action,
        createdAt: timesheetApprovals.createdAt,
        remarks: timesheetApprovals.remarks,
      })
      .from(timesheetApprovals)
      .where(inArray(timesheetApprovals.timesheetId, timesheetIds))
      .orderBy(timesheetApprovals.timesheetId, desc(timesheetApprovals.createdAt));

    approvalHistory.forEach((record) => {
      if (!approvalHistoryMap.has(record.timesheetId)) {
        approvalHistoryMap.set(record.timesheetId, []);
      }
      approvalHistoryMap.get(record.timesheetId)!.push(record);
    });
  }

  let allEmployees;
  if (!status) {
    allEmployees = await db
      .select({
        employee: {
          id: employees.id,
          employeeId: employees.employeeId,
          departmentId: employees.departmentId,
          positionId: employees.positionId,
          hourlyRate: employees.hourlyRate,
        },
        user: { id: users.id, fullName: users.fullName, email: users.email },
        department: { id: departments.id, name: departments.name },
      })
      .from(employees)
      .innerJoin(users, eq(employees.userId, users.id))
      .leftJoin(departments, eq(employees.departmentId, departments.id))
      .where(employeeWhereClause)
      .orderBy(users.fullName);
  }

  const DAY_NAMES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const weekDays: Array<{ date: string; dayName: string }> = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStartUTC);
    date.setUTCDate(weekStartUTC.getUTCDate() + i);
    weekDays.push({
      date: formatLocalDateStringFromDate(date),
      dayName: DAY_NAMES[date.getUTCDay()]!,
    });
  }

  const employeeMap = new Map();

  result.forEach((row) => {
    const empId = row.employee.id;
    if (!employeeMap.has(empId)) {
      employeeMap.set(empId, {
        employeeInfo: {
          id: row.employee.id,
          employeeId: row.employee.employeeId,
          departmentId: row.employee.departmentId,
          departmentName: row.department?.name || null,
          positionId: row.employee.positionId,
          hourlyRate: row.employee.hourlyRate,
          fullName: row.user.fullName,
          email: row.user.email,
        },
        weekDays: weekDays.map((day) => ({
          date: day.date,
          dayName: day.dayName,
          timesheet: null,
          hours: "0.0",
          status: "no_hours",
        })),
        totals: { regular: 0, overtime: 0, doubleTime: 0 },
      });
    }
  });

  if (allEmployees) {
    allEmployees.forEach((emp) => {
      const empId = emp.employee.id;
      if (!employeeMap.has(empId)) {
        employeeMap.set(empId, {
          employeeInfo: {
            id: emp.employee.id,
            employeeId: emp.employee.employeeId,
            departmentId: emp.employee.departmentId,
            departmentName: emp.department?.name || null,
            positionId: emp.employee.positionId,
            hourlyRate: emp.employee.hourlyRate,
            fullName: emp.user.fullName,
            email: emp.user.email,
          },
          weekDays: weekDays.map((day) => ({
            date: day.date,
            dayName: day.dayName,
            timesheet: null,
            hours: "0.0",
            status: "no_hours",
          })),
          totals: { regular: 0, overtime: 0, doubleTime: 0 },
        });
      }
    });
  }

  result.forEach((row) => {
    const empId = row.employee.id;
    const employeeData = employeeMap.get(empId);

    if (employeeData && row.timesheet.sheetDate) {
      const dayIndex = employeeData.weekDays.findIndex(
        (day: any) => day.date === row.timesheet.sheetDate,
      );

      if (dayIndex >= 0) {
        const totalHours = parseFloat(row.timesheet.totalHours || "0");
        const overtimeHours = parseFloat(row.timesheet.overtimeHours || "0");
        const regularHours = Math.max(0, totalHours - overtimeHours);

        const dayData: any = {
          date: row.timesheet.sheetDate,
          dayName: employeeData.weekDays[dayIndex].dayName,
          hours: totalHours.toFixed(1),
          status: row.timesheet.status,
        };

        if (row.timesheet.id) {
          dayData.timesheetId = row.timesheet.id;
          dayData.breakMinutes = row.timesheet.breakMinutes || 0;
          dayData.totalHours = row.timesheet.totalHours || "0";
          dayData.overtimeHours = row.timesheet.overtimeHours || "0";
          dayData.regularHours = regularHours.toFixed(2);
          dayData.weeklyConfirmedAt = row.timesheet.weeklyConfirmedAt ?? null;
          dayData.weeklyConfirmationNotes =
            row.timesheet.weeklyConfirmationNotes ?? null;

          if (row.timesheet.notes != null) dayData.notes = row.timesheet.notes;

          if (row.timesheet.approvedBy != null) {
            dayData.approvedBy = row.timesheet.approvedBy;
            if (row.approver?.fullName) dayData.approvedByName = row.approver.fullName;
          }

          if (row.timesheet.rejectedBy != null) {
            dayData.rejectedBy = row.timesheet.rejectedBy;
            if (row.rejector?.fullName) dayData.rejectedByName = row.rejector.fullName;
          }

          const approvalHistory = approvalHistoryMap.get(row.timesheet.id) || [];
          const rejectionRecords = approvalHistory
            .filter((r) => r.action === "rejected")
            .sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime());
          const mostRecentRejection = rejectionRecords[0];

          if (row.timesheet.status === "rejected" && mostRecentRejection?.remarks) {
            const remarks = mostRecentRejection.remarks;
            const idx = remarks.indexOf("\n\nManager Notes:");
            dayData.rejectionReason = idx > 0 ? remarks.substring(0, idx) : remarks;
          }

          const isResubmitted =
            row.timesheet.rejectedBy != null && row.timesheet.status !== "rejected";

          if (row.timesheet.status === "rejected" && mostRecentRejection) {
            dayData.rejectedAt = mostRecentRejection.createdAt.toISOString();
          } else if (isResubmitted && mostRecentRejection) {
            if (mostRecentRejection.remarks) {
              const remarks = mostRecentRejection.remarks;
              const idx = remarks.indexOf("\n\nManager Notes:");
              dayData.rejectionReason = idx > 0 ? remarks.substring(0, idx) : remarks;
            }
            dayData.resubmittedAt = row.timesheet.updatedAt?.toISOString();
            dayData.resubmissionCount = 1;
          }
        }

        employeeData.weekDays[dayIndex] = dayData;
        employeeData.totals.regular += regularHours;
        employeeData.totals.overtime += overtimeHours;
      }
    }
  });

  const today = businessTodayLocalDateString();

  const formattedData = Array.from(employeeMap.values()).map((emp) => ({
    ...emp,
    weekDays: emp.weekDays.map((day: any) => {
      if (day.timesheetId) return day;

      const dayDate = day.date;
      let dayStatus = "no_hours";
      if (dayDate > today) dayStatus = "future";
      else if (dayDate === today) dayStatus = "no_hours";

      return { ...day, status: dayStatus };
    }),
    totals: {
      regular: emp.totals.regular.toFixed(1),
      overtime: emp.totals.overtime.toFixed(1),
      doubleTime: emp.totals.doubleTime.toFixed(1),
    },
  }));

  const total = formattedData.length;
  const paginatedData = formattedData.slice(offset, offset + limit);

  return {
    weekInfo: { startDate: startDateStr, endDate: endDateStr, weekDays },
    employees: paginatedData,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

export const getMyWeeklyTimesheets = async (
  employeeId: number,
  weekStartDate: string,
  _search?: string,
) => {
  const weeklyData = await getWeeklyTimesheetsByEmployee(weekStartDate, [employeeId]);

  const myEmployeeData = weeklyData.employees.find(
    (emp) => emp.employeeInfo.id === employeeId,
  );

  if (!myEmployeeData) {
    const startDate = new Date(weekStartDate);
    const weekDays: Array<{ date: string; dayName: string }> = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      weekDays.push({
        date: formatLocalDateStringFromDate(date),
        dayName: date
          .toLocaleDateString("en-US", { weekday: "short" })
          .toLowerCase(),
      });
    }

    const today = businessTodayLocalDateString();

    return {
      weekInfo: weeklyData.weekInfo,
      employee: {
        employeeInfo: null,
        weekDays: weekDays.map((day) => ({
          date: day.date,
          dayName: day.dayName,
          timesheet: null,
          hours: "0.0",
          status: day.date > today ? "future" : "no_hours",
          jobEntries: [],
        })),
        totals: { regular: "0.0", overtime: "0.0", doubleTime: "0.0" },
      },
    };
  }

  // Enrich each day with job entries from timesheet_job_entries
  const timesheetIds = myEmployeeData.weekDays
    .map((d: any) => d.timesheetId)
    .filter(Boolean) as number[];

  let jobEntriesByTimesheetId = new Map<number, any[]>();

  if (timesheetIds.length > 0) {
    const entries = await db
      .select({
        id: timesheetJobEntries.id,
        timesheetId: timesheetJobEntries.timesheetId,
        jobId: timesheetJobEntries.jobId,
        jobNumber: jobs.jobNumber,
        jobTitle: jobs.description,
        timeIn: timesheetJobEntries.timeIn,
        timeOut: timesheetJobEntries.timeOut,
        breakMinutes: timesheetJobEntries.breakMinutes,
        hours: timesheetJobEntries.hours,
        entryType: timesheetJobEntries.entryType,
        notes: timesheetJobEntries.notes,
        breakTaken: timesheetJobEntries.breakTaken,
        caLaborViolation: timesheetJobEntries.caLaborViolation,
        caViolationDetails: timesheetJobEntries.caViolationDetails,
        createdAt: timesheetJobEntries.createdAt,
      })
      .from(timesheetJobEntries)
      .leftJoin(jobs, eq(timesheetJobEntries.jobId, jobs.id))
      .where(inArray(timesheetJobEntries.timesheetId, timesheetIds))
      .orderBy(timesheetJobEntries.timeIn);

    entries.forEach((entry) => {
      if (!jobEntriesByTimesheetId.has(entry.timesheetId)) {
        jobEntriesByTimesheetId.set(entry.timesheetId, []);
      }
      jobEntriesByTimesheetId.get(entry.timesheetId)!.push(entry);
    });
  }

  const enrichedEmployee = {
    ...myEmployeeData,
    weekDays: myEmployeeData.weekDays.map((day: any) => ({
      ...day,
      jobEntries: day.timesheetId
        ? (jobEntriesByTimesheetId.get(day.timesheetId) ?? [])
        : [],
    })),
  };

  return { weekInfo: weeklyData.weekInfo, employee: enrichedEmployee };
};

export const getTimesheetsByEmployee = async (
  offset: number,
  limit: number,
  search?: string,
  employeeId?: string,
  dateFrom?: string,
  dateTo?: string,
) => {
  let whereConditions: any[] = [];

  if (search) {
    whereConditions.push(
      or(
        ilike(timesheets.notes, `%${search}%`),
        ilike(timesheets.status, `%${search}%`),
        ilike(employees.employeeId, `%${search}%`),
        ilike(users.fullName, `%${search}%`),
      )!,
    );
  }

  if (employeeId) whereConditions.push(eq(employees.employeeId, employeeId));
  if (dateFrom) whereConditions.push(sql`${timesheets.sheetDate} >= ${dateFrom}`);
  if (dateTo) whereConditions.push(sql`${timesheets.sheetDate} <= ${dateTo}`);

  const whereClause =
    whereConditions.length > 0 ? and(...whereConditions) : undefined;

  const result = await db
    .select({
      timesheet: {
        id: timesheets.id,
        sheetDate: timesheets.sheetDate,
        breakMinutes: timesheets.breakMinutes,
        totalHours: timesheets.totalHours,
        overtimeHours: timesheets.overtimeHours,
        notes: timesheets.notes,
        status: timesheets.status,
        rejectedBy: timesheets.rejectedBy,
        approvedBy: timesheets.approvedBy,
        weeklyConfirmedAt: timesheets.weeklyConfirmedAt,
        weeklyConfirmationNotes: timesheets.weeklyConfirmationNotes,
        createdAt: timesheets.createdAt,
        updatedAt: timesheets.updatedAt,
      },
      employee: {
        id: employees.id,
        employeeId: employees.employeeId,
        departmentId: employees.departmentId,
        positionId: employees.positionId,
      },
      user: { id: users.id, fullName: users.fullName, email: users.email },
    })
    .from(timesheets)
    .innerJoin(employees, eq(timesheets.employeeId, employees.id))
    .innerJoin(users, eq(employees.userId, users.id))
    .where(whereClause)
    .limit(limit)
    .offset(offset)
    .orderBy(employees.employeeId, timesheets.sheetDate);

  const groupedData = result.reduce((acc: any[], row) => {
    const key = row.employee.employeeId;
    let group = acc.find((g) => g.employeeId === key);
    if (!group) {
      group = {
        employeeId: key,
        employee: row.employee,
        user: row.user,
        timesheets: [],
      };
      acc.push(group);
    }
    group.timesheets.push(row.timesheet);
    return acc;
  }, []);

  const totalResult = await db
    .select({ count: count() })
    .from(timesheets)
    .innerJoin(employees, eq(timesheets.employeeId, employees.id))
    .innerJoin(users, eq(employees.userId, users.id))
    .where(whereClause);

  const totalCount = totalResult[0]?.count ?? 0;

  return {
    data: groupedData,
    total: totalCount,
    pagination: {
      page: Math.floor(offset / limit) + 1,
      limit,
      totalPages: Math.ceil(totalCount / limit),
    },
  };
};

export const canApproveTimesheet = async (
  approverUserId: string,
  timesheetId: number,
): Promise<{ allowed: boolean; message?: string }> => {
  const [timesheet] = await db
    .select({ employeeId: timesheets.employeeId })
    .from(timesheets)
    .where(and(eq(timesheets.id, timesheetId), eq(timesheets.isDeleted, false)))
    .limit(1);

  if (!timesheet) return { allowed: false, message: "Timesheet not found" };
  if (!timesheet.employeeId)
    return { allowed: false, message: "Timesheet has no associated employee" };

  const [employee] = await db
    .select({ userId: employees.userId })
    .from(employees)
    .where(eq(employees.id, timesheet.employeeId))
    .limit(1);

  if (!employee?.userId)
    return { allowed: false, message: "Employee or user not found for timesheet" };

  const submitterRole = await getUserRoles(employee.userId);
  const approverRole = await getUserRoles(approverUserId);

  const submitterRoleNameRaw = submitterRole?.roleName?.trim() ?? "";
  const submitterRoleName = submitterRoleNameRaw.toLowerCase();
  const approverRoleName = approverRole?.roleName?.trim().toLowerCase() ?? "";

  if (!approverRoleName)
    return { allowed: false, message: "Approver has no role assigned" };

  if (submitterRoleNameRaw === "Technician") {
    const allowed =
      approverRoleName === "manager" || approverRoleName === "executive";
    return allowed
      ? { allowed: true }
      : { allowed: false, message: "Only a Manager or Executive can approve a Technician's timesheet" };
  }

  if (submitterRoleName === "manager") {
    const allowed = approverRoleName === "executive";
    return allowed
      ? { allowed: true }
      : { allowed: false, message: "Only an Executive can approve a Manager's timesheet" };
  }

  const allowed = approverRoleName === "executive";
  return allowed
    ? { allowed: true }
    : { allowed: false, message: "Only an Executive can approve this timesheet" };
};

export const approveTimesheet = async (
  timesheetId: number,
  approvedBy: string,
  notes?: string,
) => {
  const [existingTimesheet] = await db
    .select()
    .from(timesheets)
    .where(eq(timesheets.id, timesheetId));

  if (!existingTimesheet) return null;

  const [timesheet] = await db
    .update(timesheets)
    .set({
      status: "approved",
      approvedBy,
      rejectedBy: null,
      updatedAt: new Date(),
    })
    .where(eq(timesheets.id, timesheetId))
    .returning();

  if (timesheet) {
    await db.insert(timesheetApprovals).values({
      timesheetId,
      action: "approved",
      performedBy: approvedBy,
      remarks: notes ?? null,
    });

    void (async () => {
      try {
        if (existingTimesheet.employeeId === null) return;
        const [empData] = await db
          .select({ userId: employees.userId })
          .from(employees)
          .where(eq(employees.id, existingTimesheet.employeeId))
          .limit(1);
        if (!empData?.userId) return;
        const { NotificationService } = await import("./notification.service.js");
        await new NotificationService().triggerNotification({
          type: "timesheet_approved",
          category: "timesheet",
          priority: "medium",
          triggeredBy: approvedBy,
          data: {
            entityType: "Timesheet",
            entityId: String(timesheetId),
            entityName: `Timesheet #${timesheetId}`,
            employeeId: String(existingTimesheet.employeeId),
          },
        });
      } catch (err) {
        console.error("[Notification] timesheet_approved failed:", err);
      }
    })();
  }

  return timesheet ?? null;
};

export const rejectTimesheet = async (
  timesheetId: number,
  rejectedBy: string,
  rejectionReason: string,
  notes?: string,
) => {
  const [existingTimesheet] = await db
    .select()
    .from(timesheets)
    .where(and(eq(timesheets.id, timesheetId), eq(timesheets.isDeleted, false)));

  if (!existingTimesheet) return null;

  const [timesheet] = await db
    .update(timesheets)
    .set({
      status: "rejected",
      rejectedBy,
      approvedBy: null,
      updatedAt: new Date(),
    })
    .where(eq(timesheets.id, timesheetId))
    .returning();

  if (timesheet) {
    const remarks = notes
      ? `${rejectionReason}\n\nManager Notes: ${notes}`
      : rejectionReason;

    await db.insert(timesheetApprovals).values({
      timesheetId,
      action: "rejected",
      performedBy: rejectedBy,
      remarks,
    });

    void (async () => {
      try {
        if (existingTimesheet.employeeId === null) return;
        const [empData] = await db
          .select({ userId: employees.userId })
          .from(employees)
          .where(eq(employees.id, existingTimesheet.employeeId))
          .limit(1);
        if (!empData?.userId) return;
        const { NotificationService } = await import("./notification.service.js");
        await new NotificationService().triggerNotification({
          type: "timesheet_rejected",
          category: "timesheet",
          priority: "high",
          triggeredBy: rejectedBy,
          data: {
            entityType: "Timesheet",
            entityId: String(timesheetId),
            entityName: `Timesheet #${timesheetId}`,
            employeeId: String(existingTimesheet.employeeId),
            notes: rejectionReason,
          },
        });
      } catch (err) {
        console.error("[Notification] timesheet_rejected failed:", err);
      }
    })();

    return { ...timesheet, rejectionReason };
  }

  return null;
};

export const getTimesheetKPIs = async (weekStartDate: string) => {
  const startDateStr = weekStartDate;
  const kpiStartUTC = new Date(weekStartDate + "T00:00:00Z");
  const kpiEndUTC = new Date(kpiStartUTC);
  kpiEndUTC.setUTCDate(kpiStartUTC.getUTCDate() + 6);
  const endDateStr = formatLocalDateStringFromDate(kpiEndUTC);

  const weekRange = and(
    sql`${timesheets.sheetDate} >= ${startDateStr} AND ${timesheets.sheetDate} <= ${endDateStr}`,
    eq(employees.isDeleted, false),
    eq(timesheets.isDeleted, false),
  );

  const [
    [totalEmployeesResult],
    employeesWithTimesheetsData,
    hoursResult,
    [pendingApprovalsResult],
    [rejectedEntriesResult],
  ] = await Promise.all([
    db
      .select({ count: count() })
      .from(employees)
      .innerJoin(users, eq(employees.userId, users.id))
      .where(and(eq(employees.isDeleted, false), eq(employees.status, "available"))),
    db
      .select({ employeeId: timesheets.employeeId })
      .from(timesheets)
      .innerJoin(employees, eq(timesheets.employeeId, employees.id))
      .where(weekRange),
    db
      .select({
        totalHours: sum(timesheets.totalHours),
        overtimeHours: sum(timesheets.overtimeHours),
      })
      .from(timesheets)
      .innerJoin(employees, eq(timesheets.employeeId, employees.id))
      .where(weekRange),
    db
      .select({ count: count() })
      .from(timesheets)
      .innerJoin(employees, eq(timesheets.employeeId, employees.id))
      .where(
        and(
          weekRange,
          or(eq(timesheets.status, "pending"), eq(timesheets.status, "submitted"))!,
        ),
      ),
    db
      .select({ count: count() })
      .from(timesheets)
      .innerJoin(employees, eq(timesheets.employeeId, employees.id))
      .where(and(weekRange, eq(timesheets.status, "rejected"))),
  ]);

  const totalEmployees = totalEmployeesResult?.count || 0;
  const uniqueEmployeeIds = new Set(
    employeesWithTimesheetsData.map((row) => row.employeeId),
  );
  const employeesWithTimesheets = uniqueEmployeeIds.size;

  const totalHours = parseFloat(hoursResult[0]?.totalHours || "0");
  const overtimeHours = parseFloat(hoursResult[0]?.overtimeHours || "0");
  const trackedHours = totalHours + overtimeHours;

  return {
    technicians: {
      total: totalEmployees,
      withTimesheets: employeesWithTimesheets,
      label: `${employeesWithTimesheets} of ${totalEmployees} scheduled`,
    },
    trackedHours: {
      total: trackedHours,
      regular: totalHours,
      overtime: overtimeHours,
      doubleTime: 0,
      label: `${trackedHours.toFixed(1)}h Regular + OT + Double`,
    },
    pendingApprovals: {
      count: pendingApprovalsResult?.count || 0,
      label: `${pendingApprovalsResult?.count || 0} Need manager review`,
    },
    rejectedEntries: {
      count: rejectedEntriesResult?.count || 0,
      label: `${rejectedEntriesResult?.count || 0} Awaiting technician edits`,
    },
  };
};

export const bulkDeleteTimesheets = async (ids: number[], deletedBy: string) => {
  const now = new Date();
  const result = await db
    .update(timesheets)
    .set({ isDeleted: true, deletedAt: now, deletedBy, updatedAt: now })
    .where(and(inArray(timesheets.id, ids), eq(timesheets.isDeleted, false)))
    .returning({ id: timesheets.id });
  return { deleted: result.length, skipped: ids.length - result.length };
};

// ===========================================================================
// Manual / Coverage Time Logging
// ===========================================================================

/**
 * Converts "HH:MM" strings to total minutes since midnight.
 */
function hhmmToMinutes(hhmm: string): number {
  const [h = "0", m = "0"] = hhmm.split(":");
  return parseInt(h, 10) * 60 + parseInt(m, 10);
}

/**
 * CA Labor Law compliance check for a full day's total hours.
 * Returns an array of violation strings (empty = no violations).
 */
function checkCaCompliance(
  totalHoursForDay: number,
  totalBreakMinutesForDay: number,
): string[] {
  const violations: string[] = [];
  const MEAL_BREAK_THRESHOLD_1 = 5;
  const MEAL_BREAK_THRESHOLD_2 = 10;
  const MIN_MEAL_BREAK_MINUTES = 30;

  if (
    totalHoursForDay > MEAL_BREAK_THRESHOLD_1 &&
    totalBreakMinutesForDay < MIN_MEAL_BREAK_MINUTES
  ) {
    violations.push(
      `Meal break violation: ${totalHoursForDay.toFixed(1)}h worked with only ${totalBreakMinutesForDay} min break (30 min required after 5 hours).`,
    );
  }

  if (
    totalHoursForDay > MEAL_BREAK_THRESHOLD_2 &&
    totalBreakMinutesForDay < MIN_MEAL_BREAK_MINUTES * 2
  ) {
    violations.push(
      `Second meal break violation: ${totalHoursForDay.toFixed(1)}h worked — second 30-min meal break required after 10 hours.`,
    );
  }

  return violations;
}

/**
 * Logs manual or coverage time for an employee against a specific job.
 * - Upserts the daily org.timesheets row (adds hours to totalHours).
 * - Inserts a row into org.timesheet_job_entries with exact clock times and job ref.
 * - Returns CA compliance warnings (does not block save).
 */
export const logManualTime = async (data: {
  employeeId: number;
  jobId?: string;
  sheetDate: string;      // YYYY-MM-DD
  timeIn: string;         // HH:MM 24h
  timeOut: string;        // HH:MM 24h
  breakMinutes: number;
  entryType: "manual" | "coverage";
  notes?: string;
  coveredForEmployeeId?: number;              // employee ID of the person being covered for
  coveredForDispatchAssignmentId?: string;    // UUID of the specific dispatch assignment being covered
  createdBy?: string;     // user UUID of the person submitting
}) => {
  await assertEmployeeNotTimesheetBlockedForSafetyInspection(data.employeeId);

  // Calculate net hours from clock times
  const rawMinutes = hhmmToMinutes(data.timeOut) - hhmmToMinutes(data.timeIn);
  const netMinutes = Math.max(0, rawMinutes - data.breakMinutes);
  const newHours = parseFloat((netMinutes / 60).toFixed(2));

  const REGULAR_HOURS = 8;

  // --- Upsert the daily timesheet row ---
  const [existing] = await db
    .select({
      id: timesheets.id,
      totalHours: timesheets.totalHours,
      breakMinutes: timesheets.breakMinutes,
    })
    .from(timesheets)
    .where(
      and(
        eq(timesheets.employeeId, data.employeeId),
        eq(timesheets.sheetDate, data.sheetDate),
        eq(timesheets.isDeleted, false),
      ),
    )
    .limit(1);

  let timesheetId: number;

  if (existing) {
    const newTotal = parseFloat(existing.totalHours || "0") + newHours;
    const newBreak = (existing.breakMinutes || 0) + data.breakMinutes;
    const newOt = Math.max(0, newTotal - REGULAR_HOURS);

    await db
      .update(timesheets)
      .set({
        totalHours: newTotal.toFixed(2),
        overtimeHours: newOt.toFixed(2),
        breakMinutes: newBreak,
        updatedAt: new Date(),
      })
      .where(eq(timesheets.id, existing.id));

    timesheetId = existing.id;
  } else {
    const newOt = Math.max(0, newHours - REGULAR_HOURS);
    const [inserted] = await db
      .insert(timesheets)
      .values({
        employeeId: data.employeeId,
        sheetDate: data.sheetDate,
        breakMinutes: data.breakMinutes,
        totalHours: newHours.toFixed(2),
        overtimeHours: newOt.toFixed(2),
        status: "pending",
        rejectedBy: null,
        approvedBy: null,
      })
      .returning({ id: timesheets.id });

    timesheetId = inserted!.id;
  }

  // --- Insert job entry record ---
  const caViolations = checkCaCompliance(
    parseFloat(
      existing
        ? (parseFloat(existing.totalHours || "0") + newHours).toFixed(2)
        : newHours.toFixed(2),
    ),
    (existing?.breakMinutes || 0) + data.breakMinutes,
  );

  const [jobEntry] = await db
    .insert(timesheetJobEntries)
    .values({
      timesheetId,
      jobId: data.jobId ?? null,
      timeIn: data.timeIn,
      timeOut: data.timeOut,
      breakMinutes: data.breakMinutes,
      hours: newHours.toFixed(2),
      entryType: data.entryType,
      notes: data.notes ?? null,
      coveredForEmployeeId: data.coveredForEmployeeId ?? null,
      coveredForDispatchAssignmentId: data.coveredForDispatchAssignmentId ?? null,
      breakTaken: data.breakMinutes > 0,
      caLaborViolation: caViolations.length > 0,
      caViolationDetails: caViolations.length > 0 ? caViolations.join(" | ") : null,
      createdBy: data.createdBy ?? null,
    })
    .returning();

  // Fetch updated timesheet row with job entries for the day
  const [updatedTimesheet] = await db
    .select()
    .from(timesheets)
    .where(eq(timesheets.id, timesheetId))
    .limit(1);

  const dayJobEntries = await db
    .select({
      id: timesheetJobEntries.id,
      timesheetId: timesheetJobEntries.timesheetId,
      jobId: timesheetJobEntries.jobId,
      timeIn: timesheetJobEntries.timeIn,
      timeOut: timesheetJobEntries.timeOut,
      breakMinutes: timesheetJobEntries.breakMinutes,
      hours: timesheetJobEntries.hours,
      entryType: timesheetJobEntries.entryType,
      notes: timesheetJobEntries.notes,
      breakTaken: timesheetJobEntries.breakTaken,
      caLaborViolation: timesheetJobEntries.caLaborViolation,
      caViolationDetails: timesheetJobEntries.caViolationDetails,
      createdAt: timesheetJobEntries.createdAt,
      jobTitle: bidsTable.projectName,
      jobNumber: jobs.jobNumber,
    })
    .from(timesheetJobEntries)
    .leftJoin(jobs, eq(timesheetJobEntries.jobId, jobs.id))
    .leftJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(eq(timesheetJobEntries.timesheetId, timesheetId))
    .orderBy(timesheetJobEntries.timeIn);

  return {
    timesheet: updatedTimesheet,
    jobEntry,
    jobEntries: dayJobEntries,
    caWarnings: caViolations,
  };
};

/**
 * Returns a flat, paginated history of all time blocks for a tech:
 *  - Manual / coverage entries from org.timesheet_job_entries
 *  - Dispatch entries from org.dispatch_assignments (where timeIn IS NOT NULL)
 *
 * Both are merged, sorted by date desc (or hours desc), then paginated.
 */
export const getMyTimesheetHistory = async (
  employeeId: number,
  options: {
    page?: number;
    limit?: number;
    dateFrom?: string;
    dateTo?: string;
    jobId?: string;
    status?: string;
    sortBy?: "date" | "hours";
    sortOrder?: "asc" | "desc";
    search?: string;
  } = {},
) => {
  const {
    page = 1,
    limit = 20,
    dateFrom,
    dateTo,
    jobId,
    status,
    sortBy = "date",
    sortOrder = "desc",
    search,
  } = options;

  // ── 1. Manual entries from timesheet_job_entries ─────────────────────────
  const manualConditions: any[] = [eq(timesheets.employeeId, employeeId)];
  if (dateFrom) manualConditions.push(sql`${timesheets.sheetDate} >= ${dateFrom}`);
  if (dateTo) manualConditions.push(sql`${timesheets.sheetDate} <= ${dateTo}`);
  if (jobId) manualConditions.push(eq(timesheetJobEntries.jobId, jobId));
  if (status) manualConditions.push(eq(timesheets.status, status as any));
  if (search) {
    manualConditions.push(
      or(
        ilike(jobs.jobNumber, `%${search}%`),
        ilike(jobs.description, `%${search}%`),
        ilike(timesheetJobEntries.notes, `%${search}%`),
      )!,
    );
  }

  const manualRows = await db
    .select({
      rowId: sql<string>`'m:' || ${timesheetJobEntries.id}`,
      sheetDate: timesheets.sheetDate,
      timesheetId: timesheetJobEntries.timesheetId,
      timesheetStatus: timesheets.status,
      jobId: timesheetJobEntries.jobId,
      jobNumber: jobs.jobNumber,
      jobTitle: bidsTable.projectName,
      timeIn: timesheetJobEntries.timeIn,
      timeOut: timesheetJobEntries.timeOut,
      breakMinutes: timesheetJobEntries.breakMinutes,
      hours: timesheetJobEntries.hours,
      entryType: timesheetJobEntries.entryType,
      notes: timesheetJobEntries.notes,
      breakTaken: timesheetJobEntries.breakTaken,
      caLaborViolation: timesheetJobEntries.caLaborViolation,
      caViolationDetails: timesheetJobEntries.caViolationDetails,
      createdAt: timesheetJobEntries.createdAt,
    })
    .from(timesheetJobEntries)
    .innerJoin(timesheets, eq(timesheetJobEntries.timesheetId, timesheets.id))
    .leftJoin(jobs, eq(timesheetJobEntries.jobId, jobs.id))
    .leftJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(and(...manualConditions));

  // ── 2. Dispatch entries from dispatch_assignments ─────────────────────────
  const dispatchConditions: any[] = [
    eq(dispatchAssignments.technicianId, employeeId),
    sql`${dispatchAssignments.timeIn} IS NOT NULL`,
    or(eq(dispatchAssignments.isDeleted, false), sql`${dispatchAssignments.isDeleted} IS NULL`)!,
  ];

  if (jobId) dispatchConditions.push(eq(dispatchTasks.jobId, jobId));

  if (search) {
    dispatchConditions.push(
      or(
        ilike(jobs.jobNumber, `%${search}%`),
        ilike(jobs.description, `%${search}%`),
        ilike(dispatchAssignments.logNotes, `%${search}%`),
      )!,
    );
  }

  const dispatchRows = await db
    .select({
      rowId: sql<string>`'d:' || ${dispatchAssignments.id}`,
      sheetDate: sql<string>`TO_CHAR(${dispatchAssignments.timeIn}, 'YYYY-MM-DD')`,
      timesheetId: sql<number | null>`NULL`,
      timesheetStatus: sql<string | null>`NULL`,
      jobId: dispatchTasks.jobId,
      jobNumber: jobs.jobNumber,
      jobTitle: bidsTable.projectName,
      // Convert full timestamps to HH:MM strings for consistency
      timeIn: sql<string | null>`TO_CHAR(${dispatchAssignments.timeIn}, 'HH24:MI')`,
      timeOut: sql<string | null>`TO_CHAR(${dispatchAssignments.timeOut}, 'HH24:MI')`,
      breakMinutes: dispatchAssignments.breakMinutes,
      hours: dispatchAssignments.actualHours,
      entryType: sql<string>`'dispatch'`,
      notes: dispatchAssignments.logNotes,
      breakTaken: dispatchAssignments.breakTaken,
      caLaborViolation: dispatchAssignments.caLaborViolation,
      caViolationDetails: dispatchAssignments.caViolationDetails,
      createdAt: dispatchAssignments.createdAt,
    })
    .from(dispatchAssignments)
    .innerJoin(dispatchTasks, eq(dispatchAssignments.taskId, dispatchTasks.id))
    .leftJoin(jobs, eq(dispatchTasks.jobId, jobs.id))
    .leftJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(and(...dispatchConditions));

  // ── 3. Merge, enrich with timesheetStatus for dispatch rows ──────────────
  // For dispatch rows that have a timesheet, look up its status
  const allDispatchSheetDates = [...new Set(
    dispatchRows.map((r) => r.sheetDate).filter(Boolean) as string[],
  )];

  let dispatchTimesheetStatusMap = new Map<string, string>();
  if (allDispatchSheetDates.length > 0) {
    const sheetRows = await db
      .select({ sheetDate: timesheets.sheetDate, status: timesheets.status })
      .from(timesheets)
      .where(
        and(
          eq(timesheets.employeeId, employeeId),
          eq(timesheets.isDeleted, false),
          inArray(timesheets.sheetDate, allDispatchSheetDates as string[]),
        ),
      );
    sheetRows.forEach((r) => {
      if (r.sheetDate) dispatchTimesheetStatusMap.set(String(r.sheetDate), r.status);
    });
  }

  // Apply date filters to dispatch rows (they were fetched without date WHERE clause for simplicity)
  let filteredDispatch = dispatchRows;
  if (dateFrom) filteredDispatch = filteredDispatch.filter((r) => r.sheetDate >= dateFrom);
  if (dateTo) filteredDispatch = filteredDispatch.filter((r) => r.sheetDate <= dateTo);
  if (status) {
    filteredDispatch = filteredDispatch.filter(
      (r) => (dispatchTimesheetStatusMap.get(r.sheetDate ?? "") ?? "pending") === status,
    );
  }

  // ── 4. Combine and sort ──────────────────────────────────────────────────
  type CombinedEntry = {
    rowId: string;
    source: "manual" | "dispatch";
    sheetDate: string;
    timesheetId: number | null;
    timesheetStatus: string | null;
    jobId: string | null;
    jobNumber: string | null;
    jobTitle: string | null;
    timeIn: string | null;
    timeOut: string | null;
    breakMinutes: number | null;
    hours: string | null;
    entryType: string;
    notes: string | null;
    breakTaken: boolean;
    caLaborViolation: boolean;
    caViolationDetails: string | null;
    createdAt: Date | null;
  };

  const combined: CombinedEntry[] = [
    ...manualRows.map((r) => ({
      ...r,
      source: "manual" as const,
      sheetDate: String(r.sheetDate ?? ""),
      timesheetStatus: r.timesheetStatus ?? null,
      jobId: r.jobId ?? null,
      hours: r.hours ? String(r.hours) : null,
      entryType: r.entryType ?? "manual",
      breakTaken: r.breakTaken ?? false,
      caLaborViolation: r.caLaborViolation ?? false,
    })),
    ...filteredDispatch.map((r) => ({
      ...r,
      source: "dispatch" as const,
      sheetDate: r.sheetDate ?? "",
      timesheetStatus: dispatchTimesheetStatusMap.get(r.sheetDate ?? "") ?? null,
      jobId: r.jobId ?? null,
      hours: r.hours ? String(r.hours) : null,
      breakTaken: r.breakTaken ?? false,
      caLaborViolation: r.caLaborViolation ?? false,
    })),
  ];

  combined.sort((a, b) => {
    let cmp = 0;
    if (sortBy === "hours") {
      cmp = parseFloat(a.hours ?? "0") - parseFloat(b.hours ?? "0");
    } else {
      cmp = (a.sheetDate ?? "").localeCompare(b.sheetDate ?? "");
    }
    return sortOrder === "desc" ? -cmp : cmp;
  });

  // ── 5. Paginate ──────────────────────────────────────────────────────────
  const total = combined.length;
  const offset = (page - 1) * limit;
  const paginated = combined.slice(offset, offset + limit);

  return {
    data: paginated,
    total,
    pagination: {
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Update a timesheetJobEntry (time-in, time-out, break, notes).
 * Also recalculates hours and patches the parent timesheet's totalHours.
 * Only the entry owner can call this (enforced in controller).
 */
export const updateTimesheetJobEntry = async (
  entryId: number,
  data: {
    timeIn: string;     // HH:MM
    timeOut: string;    // HH:MM
    breakMinutes: number;
    notes?: string;
  },
) => {
  const [existing] = await db
    .select({
      id: timesheetJobEntries.id,
      timesheetId: timesheetJobEntries.timesheetId,
      hours: timesheetJobEntries.hours,
    })
    .from(timesheetJobEntries)
    .where(eq(timesheetJobEntries.id, entryId))
    .limit(1);

  if (!existing) return null;

  const rawMinutes = hhmmToMinutes(data.timeOut) - hhmmToMinutes(data.timeIn);
  const netMinutes = Math.max(0, rawMinutes - data.breakMinutes);
  const newHours = parseFloat((netMinutes / 60).toFixed(2));
  const oldHours = parseFloat(String(existing.hours) || "0");
  const hoursDelta = newHours - oldHours;

  const [updated] = await db
    .update(timesheetJobEntries)
    .set({
      timeIn: data.timeIn,
      timeOut: data.timeOut,
      breakMinutes: data.breakMinutes,
      hours: newHours.toFixed(2),
      notes: data.notes ?? null,
      updatedAt: new Date(),
    })
    .where(eq(timesheetJobEntries.id, entryId))
    .returning();

  // Patch the parent timesheet totals by the delta
  if (hoursDelta !== 0) {
    const [parentSheet] = await db
      .select({ totalHours: timesheets.totalHours })
      .from(timesheets)
      .where(eq(timesheets.id, existing.timesheetId))
      .limit(1);

    if (parentSheet) {
      const REGULAR_HOURS = 8;
      const newTotal = Math.max(0, parseFloat(String(parentSheet.totalHours) || "0") + hoursDelta);
      const newOt = Math.max(0, newTotal - REGULAR_HOURS);
      await db
        .update(timesheets)
        .set({
          totalHours: newTotal.toFixed(2),
          overtimeHours: newOt.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(timesheets.id, existing.timesheetId));
    }
  }

  return updated ?? null;
};

/**
 * Returns all coverage timesheet entries for a job, keyed by the dispatch assignment
 * they cover. Used by the labor tab to show "Covered by: X" badges.
 * Accessible by all roles — no financial data exposed.
 */
export const getCoverageEntriesForJob = async (jobId: string) => {
  const coveredByEmployee = alias(employees, "covered_by_employee");
  const coveredByUser = alias(users, "covered_by_user");

  const rows = await db
    .select({
      jobEntryId: timesheetJobEntries.id,
      sheetDate: timesheets.sheetDate,
      coveredForDispatchAssignmentId: timesheetJobEntries.coveredForDispatchAssignmentId,
      coveredForEmployeeId: timesheetJobEntries.coveredForEmployeeId,
      coveredByEmployeeId: timesheets.employeeId,
      hours: timesheetJobEntries.hours,
      timeIn: timesheetJobEntries.timeIn,
      timeOut: timesheetJobEntries.timeOut,
      breakMinutes: timesheetJobEntries.breakMinutes,
      notes: timesheetJobEntries.notes,
      coveredByName: coveredByUser.fullName,
    })
    .from(timesheetJobEntries)
    .innerJoin(
      timesheets,
      eq(timesheetJobEntries.timesheetId, timesheets.id),
    )
    .innerJoin(
      coveredByEmployee,
      eq(timesheets.employeeId, coveredByEmployee.id),
    )
    .leftJoin(coveredByUser, eq(coveredByEmployee.userId, coveredByUser.id))
    .where(
      and(
        eq(timesheetJobEntries.jobId, jobId),
        eq(timesheetJobEntries.entryType, "coverage"),
        sql`${timesheetJobEntries.coveredForDispatchAssignmentId} IS NOT NULL`,
      ),
    );

  return rows;
};
