import { count, eq, and, or, ilike, sql } from "drizzle-orm";
import { db } from "../config/db.js";
import { timesheets, employees } from "../drizzle/schema/org.schema.js";
import { users } from "../drizzle/schema/auth.schema.js";

export const getTimesheets = async (
  offset: number,
  limit: number,
  search?: string
) => {
  let whereConditions: any[] = [];

  // Add search filter if provided
  if (search) {
    whereConditions.push(
      or(
        ilike(timesheets.notes, `%${search}%`),
        ilike(timesheets.status, `%${search}%`),
        ilike(employees.employeeId, `%${search}%`),
        ilike(users.fullName, `%${search}%`)
      )!
    );
  }

  const whereClause =
    whereConditions.length > 0 ? and(...whereConditions) : undefined;

  const result = await db
    .select({
      timesheet: timesheets,
    })
    .from(timesheets)
    .leftJoin(employees, eq(timesheets.employeeId, employees.id))
    .leftJoin(users, eq(employees.userId, users.id))
    .where(whereClause)
    .limit(limit)
    .offset(offset);

  // Extract timesheet data from result
  const timesheetData = result.map((row) => row.timesheet);

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
  const [timesheet] = await db
    .select()
    .from(timesheets)
    .where(eq(timesheets.id, id));
  return timesheet || null;
};

export const createTimesheet = async (data: {
  employeeId: number;
  sheetDate: Date;
  clockIn: Date;
  clockOut: Date;
  breakMinutes?: number;
  totalHours?: string;
  overtimeHours?: string;
  notes?: string;
  status?: "pending" | "submitted" | "approved" | "rejected";
  submittedBy?: string;
  approvedBy?: string;
}) => {
  // Convert sheetDate to YYYY-MM-DD string format for date column
  const sheetDateStr =
    data.sheetDate instanceof Date
      ? data.sheetDate.toISOString().split("T")[0]
      : data.sheetDate;

  const [timesheet] = await db
    .insert(timesheets)
    .values({
      employeeId: data.employeeId,
      sheetDate: sheetDateStr as string,
      clockIn: data.clockIn,
      clockOut: data.clockOut,
      breakMinutes: data.breakMinutes || 0,
      totalHours: data.totalHours || "0",
      overtimeHours: data.overtimeHours || "0",
      notes: data.notes || null,
      status: data.status || "pending",
      submittedBy: data.submittedBy || null,
      approvedBy: data.approvedBy || null,
    })
    .returning();
  return timesheet;
};

export const updateTimesheet = async (
  id: number,
  data: {
    employeeId?: number;
    sheetDate?: Date;
    clockIn?: Date;
    clockOut?: Date;
    breakMinutes?: number;
    totalHours?: string;
    overtimeHours?: string;
    notes?: string;
    status?: "pending" | "submitted" | "approved" | "rejected";
    submittedBy?: string;
    approvedBy?: string;
  }
) => {
  const updateData: {
    employeeId?: number;
    sheetDate?: string;
    clockIn?: Date;
    clockOut?: Date;
    breakMinutes?: number | null;
    totalHours?: string | null;
    overtimeHours?: string | null;
    notes?: string | null;
    status?: "pending" | "submitted" | "approved" | "rejected";
    submittedBy?: string | null;
    approvedBy?: string | null;
    updatedAt: Date;
  } = {
    updatedAt: new Date(),
  };

  if (data.employeeId !== undefined) {
    updateData.employeeId = data.employeeId;
  }
  if (data.sheetDate !== undefined) {
    // Convert sheetDate to YYYY-MM-DD string format for date column
    const sheetDateStr: string =
      data.sheetDate instanceof Date
        ? data.sheetDate.toISOString().split("T")[0]!
        : String(data.sheetDate);
    updateData.sheetDate = sheetDateStr;
  }
  if (data.clockIn !== undefined) {
    updateData.clockIn = data.clockIn;
  }
  if (data.clockOut !== undefined) {
    updateData.clockOut = data.clockOut;
  }
  if (data.breakMinutes !== undefined) {
    updateData.breakMinutes = data.breakMinutes || null;
  }
  if (data.totalHours !== undefined) {
    updateData.totalHours = data.totalHours || null;
  }
  if (data.overtimeHours !== undefined) {
    updateData.overtimeHours = data.overtimeHours || null;
  }
  if (data.notes !== undefined) {
    updateData.notes = data.notes || null;
  }
  if (data.status !== undefined) {
    updateData.status = data.status;
  }
  if (data.submittedBy !== undefined) {
    updateData.submittedBy = data.submittedBy || null;
  }
  if (data.approvedBy !== undefined) {
    updateData.approvedBy = data.approvedBy || null;
  }

  const [timesheet] = await db
    .update(timesheets)
    .set(updateData)
    .where(eq(timesheets.id, id))
    .returning();
  return timesheet || null;
};

export const deleteTimesheet = async (id: number) => {
  const [timesheet] = await db
    .delete(timesheets)
    .where(eq(timesheets.id, id))
    .returning();
  return timesheet || null;
};
