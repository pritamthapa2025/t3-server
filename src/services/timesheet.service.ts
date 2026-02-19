import {
  count,
  eq,
  and,
  or,
  ilike,
  sql,
  sum,
  desc,
  inArray,
  getTableColumns,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../config/db.js";
import { employees, departments } from "../drizzle/schema/org.schema.js";
import {
  timesheets,
  timesheetApprovals,
} from "../drizzle/schema/timesheet.schema.js";
import { users } from "../drizzle/schema/auth.schema.js";
import { getUserRoles } from "./role.service.js";

export const getTimesheets = async (
  offset: number,
  limit: number,
  search?: string,
  options?: { ownEmployeeId?: number; departmentId?: number },
) => {
  let whereConditions: any[] = [];

  // own_only: scope to a specific employee (Technician sees only their timesheets)
  if (options?.ownEmployeeId !== undefined) {
    whereConditions.push(eq(timesheets.employeeId, options.ownEmployeeId));
  }

  // department_only: scope to employees in the manager's department
  if (options?.departmentId !== undefined) {
    whereConditions.push(eq(employees.departmentId, options.departmentId));
  }

  // Add search filter if provided
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

  // Extract timesheet data from result and format
  const timesheetData = result.map((row) => {
    const { approvedByName, rejectedByName, ...timesheet } = row.timesheet;
    const formatted = formatTimesheetResponse(timesheet);
    return {
      ...formatted,
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

// Aliases for joining users table multiple times
const approverUser = alias(users, "approver_user");
const rejectorUser = alias(users, "rejector_user");

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
  const formatted = formatTimesheetResponse(timesheet);

  // Get latest rejection reason from approval history (if rejected)
  if (timesheet.status === "rejected") {
    const [rejectionRecord] = await db
      .select({
        remarks: timesheetApprovals.remarks,
      })
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
      // Extract rejection reason (before "Manager Notes:" if present)
      const remarks = rejectionRecord.remarks;
      const managerNotesIndex = remarks.indexOf("\n\nManager Notes:");
      const rejectionReason =
        managerNotesIndex > 0
          ? remarks.substring(0, managerNotesIndex)
          : remarks;

      return {
        ...formatted,
        approvedByName: approvedByName ?? null,
        rejectedByName: rejectedByName ?? null,
        rejectionReason: rejectionReason, // Latest rejection reason from manager
        // notes field contains employee's notes (preserved)
      };
    }
  }

  return {
    ...formatted,
    approvedByName: approvedByName ?? null,
    rejectedByName: rejectedByName ?? null,
  };
};

// Helper function to format timesheet response (clockIn/clockOut are already strings, just return as-is)
export const formatTimesheetResponse = (timesheet: any) => {
  if (!timesheet) return timesheet;
  // clockIn and clockOut are already stored as HH:MM strings, no conversion needed
  return timesheet;
};

export const createTimesheet = async (data: {
  employeeId: number;
  sheetDate: Date;
  clockIn: string; // Now accepts time string (HH:MM)
  clockOut?: string; // Now accepts time string (HH:MM)
  breakMinutes?: number;
  totalHours?: string;
  overtimeHours?: string;
  notes?: string;
}) => {
  // Convert sheetDate to YYYY-MM-DD string format for date column
  const sheetDateStr =
    data.sheetDate instanceof Date
      ? data.sheetDate.toISOString().split("T")[0]!
      : typeof data.sheetDate === "string"
        ? data.sheetDate
        : new Date(data.sheetDate).toISOString().split("T")[0]!;

  // Store clockIn and clockOut as time strings directly (HH:MM format)
  const clockInTime = data.clockIn; // Already in HH:MM format
  const clockOutTime = data.clockOut || null; // Already in HH:MM format or null

  // Calculate totalHours and overtimeHours if clockOut is provided
  let calculatedTotalHours = data.totalHours || "0";
  let calculatedOvertimeHours = data.overtimeHours || "0";

  if (data.clockOut) {
    // Parse times to calculate hours
    const clockInParts = data.clockIn.split(":");
    const clockOutParts = data.clockOut.split(":");
    const clockInMinutes =
      parseInt(clockInParts[0] || "0", 10) * 60 +
      parseInt(clockInParts[1] || "0", 10);
    const clockOutMinutes =
      parseInt(clockOutParts[0] || "0", 10) * 60 +
      parseInt(clockOutParts[1] || "0", 10);
    const breakMinutes = data.breakMinutes || 0;
    const totalMinutes = clockOutMinutes - clockInMinutes - breakMinutes;
    calculatedTotalHours = (totalMinutes / 60).toFixed(2);

    // Calculate overtime (assuming 8 hours is regular time)
    const regularHours = 8;
    calculatedOvertimeHours = Math.max(
      0,
      parseFloat(calculatedTotalHours) - regularHours,
    ).toFixed(2);
  }

  const [timesheet] = await db
    .insert(timesheets)
    .values({
      employeeId: data.employeeId,
      sheetDate: sheetDateStr as string,
      clockIn: clockInTime,
      clockOut: clockOutTime,
      breakMinutes: data.breakMinutes || 0,
      totalHours: calculatedTotalHours,
      overtimeHours: calculatedOvertimeHours,
      notes: data.notes || null,
      status: "pending", // Always set to pending
      rejectedBy: null,
      approvedBy: null,
    })
    .returning();

  return formatTimesheetResponse(timesheet);
};

export const updateTimesheet = async (
  id: number,
  data: {
    employeeId?: number;
    sheetDate?: Date;
    clockIn?: string; // Now accepts time string (HH:MM)
    clockOut?: string; // Now accepts time string (HH:MM)
    breakMinutes?: number;
    totalHours?: string;
    overtimeHours?: string;
    notes?: string;
    status?: "pending" | "submitted" | "approved" | "rejected";
    rejectedBy?: string;
    approvedBy?: string;
  },
) => {
  // Get existing timesheet to use sheetDate if clockIn/clockOut are provided
  const [existingTimesheet] = await db
    .select()
    .from(timesheets)
    .where(and(eq(timesheets.id, id), eq(timesheets.isDeleted, false)));

  if (!existingTimesheet) {
    return null;
  }

  const updateData: {
    employeeId?: number;
    sheetDate?: string;
    clockIn?: string;
    clockOut?: string;
    breakMinutes?: number | null;
    totalHours?: string | null;
    overtimeHours?: string | null;
    notes?: string | null;
    status?: "pending" | "submitted" | "approved" | "rejected";
    rejectedBy?: string | null;
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
    // Store clockIn as time string directly (HH:MM format)
    updateData.clockIn = data.clockIn;
  }

  if (data.clockOut !== undefined) {
    // Store clockOut as time string directly (HH:MM format)
    updateData.clockOut = data.clockOut;

    // Recalculate hours if clockOut is updated
    const clockInTime = updateData.clockIn || existingTimesheet.clockIn;
    if (clockInTime) {
      // Parse times to calculate hours
      const clockInParts = clockInTime.split(":");
      const clockOutParts = data.clockOut.split(":");
      const clockInMinutes =
        parseInt(clockInParts[0] || "0", 10) * 60 +
        parseInt(clockInParts[1] || "0", 10);
      const clockOutMinutes =
        parseInt(clockOutParts[0] || "0", 10) * 60 +
        parseInt(clockOutParts[1] || "0", 10);
      const breakMins =
        data.breakMinutes !== undefined
          ? data.breakMinutes
          : existingTimesheet.breakMinutes || 0;
      const totalMinutes = clockOutMinutes - clockInMinutes - breakMins;
      const calculatedTotalHours = (totalMinutes / 60).toFixed(2);
      const regularHours = 8;
      const calculatedOvertimeHours = Math.max(
        0,
        parseFloat(calculatedTotalHours) - regularHours,
      ).toFixed(2);

      updateData.totalHours = calculatedTotalHours;
      updateData.overtimeHours = calculatedOvertimeHours;
    }
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
  if (data.rejectedBy !== undefined) {
    updateData.rejectedBy = data.rejectedBy || null;
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

export const deleteTimesheet = async (id: number, deletedBy: string) => {
  const now = new Date();
  const [timesheet] = await db
    .update(timesheets)
    .set({
      isDeleted: true,
      deletedAt: now,
      deletedBy,
      updatedAt: now,
    })
    .where(and(eq(timesheets.id, id), eq(timesheets.isDeleted, false)))
    .returning();
  return timesheet || null;
};

export const clockIn = async (data: {
  employeeId: number;
  clockInDate: Date;
  clockInTime: string;
  jobIds?: string[];
  notes?: string;
}) => {
  // Get today's date for the sheet
  const sheetDate = new Date(data.clockInDate);
  sheetDate.setHours(0, 0, 0, 0); // Set to start of day
  const sheetDateStr = sheetDate.toISOString().split("T")[0];

  // Store clockIn time as string directly (HH:MM format)
  const clockInTime = data.clockInTime;

  // Check if there's already a timesheet for this employee today
  const existingTimesheet = await db
    .select()
    .from(timesheets)
    .where(
      and(
        eq(timesheets.employeeId, data.employeeId),
        eq(timesheets.sheetDate, sheetDateStr as string),
        eq(timesheets.isDeleted, false),
      ),
    );

  if (existingTimesheet.length > 0) {
    throw new Error("Employee has already clocked in today");
  }

  // Create new timesheet with clock-in time (clockOut will be null until employee clocks out)
  const [timesheet] = await db
    .insert(timesheets)
    .values({
      employeeId: data.employeeId,
      sheetDate: sheetDateStr as string,
      clockIn: clockInTime,
      clockOut: null, // Will be populated when employee clocks out
      breakMinutes: 0,
      totalHours: "0",
      overtimeHours: "0",
      notes: data.notes || null,
      status: "pending",
      rejectedBy: null,
      approvedBy: null,
    })
    .returning();

  return formatTimesheetResponse(timesheet);
};

export const clockOut = async (data: {
  employeeId: number;
  clockOutDate: Date;
  clockOutTime: string;
  jobIds?: string[];
  notes?: string;
  breakMinutes?: number;
}) => {
  // Get today's date for the sheet
  const sheetDate = new Date(data.clockOutDate);
  sheetDate.setHours(0, 0, 0, 0); // Set to start of day
  const sheetDateStr = sheetDate.toISOString().split("T")[0];

  // Store clockOut time as string directly (HH:MM format)
  const clockOutTimeStr = data.clockOutTime;

  // Find existing timesheet for today
  const [existingTimesheet] = await db
    .select()
    .from(timesheets)
    .where(
      and(
        eq(timesheets.employeeId, data.employeeId),
        eq(timesheets.sheetDate, sheetDateStr as string),
        eq(timesheets.isDeleted, false),
      ),
    );

  if (!existingTimesheet) {
    throw new Error(
      "No clock-in record found for today. Please clock in first.",
    );
  }

  // Calculate total hours worked using time strings
  const clockInTimeStr = existingTimesheet.clockIn;
  const breakMinutes = data.breakMinutes || existingTimesheet.breakMinutes || 0;

  // Parse times to calculate hours
  const clockInParts = clockInTimeStr.split(":");
  const clockOutParts = clockOutTimeStr.split(":");
  const clockInMinutes =
    parseInt(clockInParts[0] || "0", 10) * 60 +
    parseInt(clockInParts[1] || "0", 10);
  const clockOutMinutes =
    parseInt(clockOutParts[0] || "0", 10) * 60 +
    parseInt(clockOutParts[1] || "0", 10);
  const totalMinutes = clockOutMinutes - clockInMinutes - breakMinutes;
  const totalHours = (totalMinutes / 60).toFixed(2);

  // Calculate overtime (assuming 8 hours is regular time)
  const regularHours = 8;
  const overtimeHours = Math.max(
    0,
    parseFloat(totalHours) - regularHours,
  ).toFixed(2);

  // Update the timesheet with clock-out information
  const [updatedTimesheet] = await db
    .update(timesheets)
    .set({
      clockOut: clockOutTimeStr,
      breakMinutes: breakMinutes,
      totalHours: totalHours,
      overtimeHours: overtimeHours,
      notes: data.notes || existingTimesheet.notes,
      updatedAt: new Date(),
    })
    .where(eq(timesheets.id, existingTimesheet.id))
    .returning();

  return formatTimesheetResponse(updatedTimesheet);
};

export const createTimesheetWithClockData = async (data: {
  employeeId: number;
  clockInDate: Date;
  clockInTime: string;
  clockOutDate?: Date;
  clockOutTime?: string;
  breakMinutes?: number;
  notes?: string;
}) => {
  // Get the sheet date (start of day)
  const sheetDate = new Date(data.clockInDate);
  sheetDate.setHours(0, 0, 0, 0);
  const sheetDateStr = sheetDate.toISOString().split("T")[0];

  // Store clockIn time as string directly (HH:MM format)
  const clockInTime = data.clockInTime;

  // Check if timesheet already exists for this employee and date
  const [existingTimesheet] = await db
    .select()
    .from(timesheets)
    .where(
      and(
        eq(timesheets.employeeId, data.employeeId),
        eq(timesheets.sheetDate, sheetDateStr as string),
      ),
    );

  if (existingTimesheet) {
    throw new Error("Timesheet for this employee and date already exists");
  }

  // If clock-out data is provided
  if (data.clockOutDate && data.clockOutTime) {
    // Store clockOut time as string directly (HH:MM format)
    const clockOutTime = data.clockOutTime;

    const breakMinutes = data.breakMinutes || 0;

    // Calculate total hours worked using time strings
    const clockInParts = clockInTime.split(":");
    const clockOutParts = clockOutTime.split(":");
    const clockInMinutes =
      parseInt(clockInParts[0] || "0", 10) * 60 +
      parseInt(clockInParts[1] || "0", 10);
    const clockOutMinutes =
      parseInt(clockOutParts[0] || "0", 10) * 60 +
      parseInt(clockOutParts[1] || "0", 10);
    const totalMinutes = clockOutMinutes - clockInMinutes - breakMinutes;
    const totalHours = (totalMinutes / 60).toFixed(2);

    // Calculate overtime (assuming 8 hours is regular time)
    const regularHours = 8;
    const overtimeHours = Math.max(
      0,
      parseFloat(totalHours) - regularHours,
    ).toFixed(2);

    // Create new timesheet with both clock-in and clock-out
    const [newTimesheet] = await db
      .insert(timesheets)
      .values({
        employeeId: data.employeeId,
        sheetDate: sheetDateStr as string,
        clockIn: clockInTime,
        clockOut: clockOutTime,
        breakMinutes: breakMinutes,
        totalHours: totalHours,
        overtimeHours: overtimeHours,
        notes: data.notes || null,
        status: "pending",
        rejectedBy: null,
        approvedBy: null,
      })
      .returning();

    return formatTimesheetResponse(newTimesheet);
  } else {
    // Create new timesheet with only clock-in
    const [newTimesheet] = await db
      .insert(timesheets)
      .values({
        employeeId: data.employeeId,
        sheetDate: sheetDateStr as string,
        clockIn: clockInTime,
        clockOut: null,
        breakMinutes: data.breakMinutes || 0,
        totalHours: "0",
        overtimeHours: "0",
        notes: data.notes || null,
        status: "pending",
        rejectedBy: null,
        approvedBy: null,
      })
      .returning();

    return newTimesheet;
  }
};

export const getWeeklyTimesheetsByEmployee = async (
  weekStartDate: string, // YYYY-MM-DD format
  employeeIds?: number[],
  departmentId?: number,
  status?: string,
  page: number = 1,
  limit: number = 10,
) => {
  // Calculate week end date (6 days after start)
  const startDate = new Date(weekStartDate);
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);

  const startDateStr = startDate.toISOString().split("T")[0];
  const endDateStr = endDate.toISOString().split("T")[0];

  const offset = (page - 1) * limit;

  let whereConditions: any[] = [];
  let employeeWhereConditions: any[] = [eq(employees.isDeleted, false)];

  // Add date range filter for the week
  whereConditions.push(
    sql`${timesheets.sheetDate} >= ${startDateStr} AND ${timesheets.sheetDate} <= ${endDateStr}`,
  );

  // Add employee ID filter if provided (array of employee IDs)
  if (employeeIds && employeeIds.length > 0) {
    whereConditions.push(inArray(employees.id, employeeIds));
    employeeWhereConditions.push(inArray(employees.id, employeeIds));
  }

  // Add department filter if provided
  if (departmentId) {
    whereConditions.push(eq(employees.departmentId, departmentId));
    employeeWhereConditions.push(eq(employees.departmentId, departmentId));
  }

  // Add status filter if provided
  if (status) {
    whereConditions.push(eq(timesheets.status, status as any));
  }

  const whereClause = and(...whereConditions);
  const employeeWhereClause = and(...employeeWhereConditions);

  // Create aliases for approver and rejector users
  const approverUser = alias(users, "approver_user");
  const rejectorUser = alias(users, "rejector_user");

  // Get all timesheets for the week with employee and user details
  // Select timesheet fields explicitly to ensure clockIn/clockOut are retrieved correctly
  const result = await db
    .select({
      timesheet: {
        id: timesheets.id,
        employeeId: timesheets.employeeId,
        sheetDate: timesheets.sheetDate,
        clockIn: timesheets.clockIn,
        clockOut: timesheets.clockOut,
        breakMinutes: timesheets.breakMinutes,
        totalHours: timesheets.totalHours,
        overtimeHours: timesheets.overtimeHours,
        notes: timesheets.notes,
        status: timesheets.status,
        rejectedBy: timesheets.rejectedBy,
        approvedBy: timesheets.approvedBy,
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
        id: approverUser.id,
        fullName: approverUser.fullName,
      },
      rejector: {
        id: rejectorUser.id,
        fullName: rejectorUser.fullName,
      },
    })
    .from(timesheets)
    .innerJoin(employees, eq(timesheets.employeeId, employees.id))
    .innerJoin(users, eq(employees.userId, users.id))
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .leftJoin(approverUser, eq(timesheets.approvedBy, approverUser.id))
    .leftJoin(rejectorUser, eq(timesheets.rejectedBy, rejectorUser.id))
    .where(whereClause)
    .orderBy(users.fullName, timesheets.sheetDate);

  // Get approval history for all timesheets to track rejections and resubmissions
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
      .orderBy(
        timesheetApprovals.timesheetId,
        desc(timesheetApprovals.createdAt),
      );

    // Group by timesheet ID
    approvalHistory.forEach((record) => {
      if (!approvalHistoryMap.has(record.timesheetId)) {
        approvalHistoryMap.set(record.timesheetId, []);
      }
      approvalHistoryMap.get(record.timesheetId)!.push(record);
    });
  }

  // Get all employees (even those without timesheets this week) if no status filter
  // If status filter is applied, we only want employees with timesheets matching that status
  // If search or departmentId is provided, we still want to show all matching employees
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
        user: {
          id: users.id,
          fullName: users.fullName,
          email: users.email,
        },
        department: {
          id: departments.id,
          name: departments.name,
        },
      })
      .from(employees)
      .innerJoin(users, eq(employees.userId, users.id))
      .leftJoin(departments, eq(employees.departmentId, departments.id))
      .where(employeeWhereClause)
      .orderBy(users.fullName);
  }

  // Create days of the week array
  const weekDays: Array<{ date: string; dayName: string }> = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    weekDays.push({
      date: date.toISOString().split("T")[0]!,
      dayName: date
        .toLocaleDateString("en-US", { weekday: "short" })
        .toLowerCase(),
    });
  }

  // Group timesheets by employee and create weekly view
  const employeeMap = new Map();

  // First, add all employees from timesheets
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
        weekDays: weekDays.map((day: { date: string; dayName: string }) => ({
          date: day.date,
          dayName: day.dayName,
          timesheet: null,
          hours: "0.0",
          status: "no_clock",
        })),
        totals: {
          regular: 0,
          overtime: 0,
          doubleTime: 0,
        },
      });
    }
  });

  // Add employees without timesheets (matching search/department filters if provided)
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
          weekDays: weekDays.map((day: { date: string; dayName: string }) => ({
            date: day.date,
            dayName: day.dayName,
            timesheet: null,
            hours: "0.0",
            status: "no_clock",
          })),
          totals: {
            regular: 0,
            overtime: 0,
            doubleTime: 0,
          },
        });
      }
    });
  }

  // Fill in the actual timesheet data
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

        // Build the day object with flattened timesheet data
        const dayData: any = {
          date: row.timesheet.sheetDate,
          dayName: employeeData.weekDays[dayIndex].dayName,
          hours: totalHours.toFixed(1),
          status: row.timesheet.clockOut ? row.timesheet.status : "clocked_in",
        };

        // Only include timesheet fields if timesheet exists
        if (row.timesheet.id) {
          dayData.timesheetId = row.timesheet.id;

          // clockIn and clockOut are already stored as HH:MM strings, use directly
          dayData.clockIn = row.timesheet.clockIn || null;
          dayData.clockOut = row.timesheet.clockOut || null;

          dayData.breakMinutes = row.timesheet.breakMinutes || 0;
          dayData.totalHours = row.timesheet.totalHours || "0";
          dayData.overtimeHours = row.timesheet.overtimeHours || "0";
          dayData.regularHours = regularHours.toFixed(2);

          // Only include optional fields if they're not null
          if (
            row.timesheet.notes !== null &&
            row.timesheet.notes !== undefined
          ) {
            dayData.notes = row.timesheet.notes;
          }

          // Include approver information
          if (
            row.timesheet.approvedBy !== null &&
            row.timesheet.approvedBy !== undefined
          ) {
            dayData.approvedBy = row.timesheet.approvedBy;
            if (row.approver?.fullName) {
              dayData.approvedByName = row.approver.fullName;
            }
          }

          // Include rejector information and rejection reason
          // Note: This will be enhanced below with approval history data
          if (
            row.timesheet.rejectedBy !== null &&
            row.timesheet.rejectedBy !== undefined
          ) {
            dayData.rejectedBy = row.timesheet.rejectedBy;
            if (row.rejector?.fullName) {
              dayData.rejectedByName = row.rejector.fullName;
            }
          }

          // Get rejection and resubmission history from approval records
          const approvalHistory =
            approvalHistoryMap.get(row.timesheet.id) || [];

          // Find rejection records (sorted by most recent first)
          const rejectionRecords = approvalHistory
            .filter((record) => record.action === "rejected")
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

          const mostRecentRejection = rejectionRecords[0];

          // Include rejection reason from approval history remarks (not from notes)
          // Extract rejection reason (before "Manager Notes:" if present)
          if (
            row.timesheet.status === "rejected" &&
            mostRecentRejection?.remarks
          ) {
            const remarks = mostRecentRejection.remarks;
            const managerNotesIndex = remarks.indexOf("\n\nManager Notes:");
            dayData.rejectionReason =
              managerNotesIndex > 0
                ? remarks.substring(0, managerNotesIndex)
                : remarks;
          }

          // Check if timesheet was resubmitted (status is not "rejected" but rejectedBy is not null)
          const isResubmitted =
            row.timesheet.rejectedBy !== null &&
            row.timesheet.rejectedBy !== undefined &&
            row.timesheet.status !== "rejected";

          if (row.timesheet.status === "rejected") {
            // For rejected status, include rejectedAt
            if (mostRecentRejection) {
              dayData.rejectedAt = mostRecentRejection.createdAt.toISOString();
            } else if (row.timesheet.updatedAt) {
              // Fallback to updatedAt if no approval record exists
              dayData.rejectedAt = row.timesheet.updatedAt.toISOString();
            }
          } else if (isResubmitted) {
            // Timesheet was previously rejected but has been resubmitted
            // Include previous rejection info
            if (row.rejector?.fullName) {
              dayData.rejectedByName = row.rejector.fullName;
            }
            // Use rejection reason from approval history remarks (not from notes)
            // Extract rejection reason (before "Manager Notes:" if present)
            if (mostRecentRejection?.remarks) {
              const remarks = mostRecentRejection.remarks;
              const managerNotesIndex = remarks.indexOf("\n\nManager Notes:");
              dayData.rejectionReason =
                managerNotesIndex > 0
                  ? remarks.substring(0, managerNotesIndex)
                  : remarks;
            }

            // Find resubmission timestamp
            // Look for records after the most recent rejection that indicate resubmission
            if (mostRecentRejection) {
              // Find the first record after rejection that's not a rejection
              const resubmissionRecord = approvalHistory
                .filter(
                  (record) =>
                    record.createdAt > mostRecentRejection.createdAt &&
                    record.action !== "rejected",
                )
                .sort(
                  (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
                )[0];

              if (resubmissionRecord) {
                dayData.resubmittedAt =
                  resubmissionRecord.createdAt.toISOString();
              } else if (
                row.timesheet.updatedAt &&
                row.timesheet.updatedAt > mostRecentRejection.createdAt
              ) {
                // Use updatedAt if it's after rejection and no explicit resubmission record
                dayData.resubmittedAt = row.timesheet.updatedAt.toISOString();
              }

              // Calculate resubmission count
              // Count how many times status changed from rejected to non-rejected
              // We count status transitions: each time it goes from rejected to something else
              const statusTransitions = approvalHistory.filter(
                (record) =>
                  record.createdAt > mostRecentRejection.createdAt &&
                  record.action !== "rejected",
              ).length;

              // At minimum, if it's resubmitted, count is at least 1
              const resubmissionCount = Math.max(1, statusTransitions);
              dayData.resubmissionCount = resubmissionCount;
            } else {
              // No explicit rejection record, but rejectedBy exists
              // Use updatedAt as resubmission time
              if (row.timesheet.updatedAt) {
                dayData.resubmittedAt = row.timesheet.updatedAt.toISOString();
              }
              // Assume at least 1 resubmission
              dayData.resubmissionCount = 1;
            }
          }
        }

        employeeData.weekDays[dayIndex] = dayData;

        // Update totals
        employeeData.totals.regular += regularHours;
        employeeData.totals.overtime += overtimeHours;
        // For double time, you might need additional logic based on your business rules
      }
    }
  });

  // Convert map to array and format totals with enhanced status detection
  const today = new Date().toISOString().split("T")[0]!;

  const formattedData = Array.from(employeeMap.values()).map((emp) => ({
    ...emp,
    weekDays: emp.weekDays.map((day: any) => {
      // If there's already timesheet data (has timesheetId), keep it as is
      if (day.timesheetId) {
        return day;
      }

      // For days without timesheet data, determine status based on date
      const dayDate = day.date;
      let status = "no_clock";

      if (dayDate > today) {
        status = "future"; // Future date - can't have data yet
      } else if (dayDate === today) {
        status = "not_clocked_in"; // Today but no clock in yet
      } else {
        status = "no_clock"; // Past date with no data
      }

      return {
        ...day,
        status: status,
      };
    }),
    totals: {
      regular: emp.totals.regular.toFixed(1),
      overtime: emp.totals.overtime.toFixed(1),
      doubleTime: emp.totals.doubleTime.toFixed(1),
    },
  }));

  // Apply pagination
  const total = formattedData.length;
  const paginatedData = formattedData.slice(offset, offset + limit);

  return {
    weekInfo: {
      startDate: startDateStr,
      endDate: endDateStr,
      weekDays: weekDays,
    },
    employees: paginatedData,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// Get weekly timesheets for a specific employee (for technician's own view)
export const getMyWeeklyTimesheets = async (
  employeeId: number,
  weekStartDate: string,
  _search?: string,
) => {
  // Get weekly data for this specific employee
  const weeklyData = await getWeeklyTimesheetsByEmployee(weekStartDate, [
    employeeId,
  ]);

  // Filter to only include the current employee's data
  const myEmployeeData = weeklyData.employees.find(
    (emp) => emp.employeeInfo.id === employeeId,
  );

  if (!myEmployeeData) {
    // If no data found for this employee, create empty structure
    const startDate = new Date(weekStartDate);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);

    const weekDays: Array<{ date: string; dayName: string }> = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      weekDays.push({
        date: date.toISOString().split("T")[0]!,
        dayName: date
          .toLocaleDateString("en-US", { weekday: "short" })
          .toLowerCase(),
      });
    }

    const today = new Date().toISOString().split("T")[0]!;

    return {
      weekInfo: weeklyData.weekInfo,
      employee: {
        employeeInfo: null, // Will be populated when employee record exists
        weekDays: weekDays.map((day) => {
          let status = "no_clock";
          if (day.date > today) {
            status = "future";
          } else if (day.date === today) {
            status = "not_clocked_in";
          }
          return {
            date: day.date,
            dayName: day.dayName,
            timesheet: null,
            hours: "0.0",
            status: status,
          };
        }),
        totals: {
          regular: "0.0",
          overtime: "0.0",
          doubleTime: "0.0",
        },
      },
    };
  }

  return {
    weekInfo: weeklyData.weekInfo,
    employee: myEmployeeData,
  };
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

  // Add search filter if provided
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

  // Filter by specific employee if provided
  if (employeeId) {
    whereConditions.push(eq(employees.employeeId, employeeId));
  }

  // Date range filter
  if (dateFrom) {
    whereConditions.push(sql`${timesheets.sheetDate} >= ${dateFrom}`);
  }
  if (dateTo) {
    whereConditions.push(sql`${timesheets.sheetDate} <= ${dateTo}`);
  }

  const whereClause =
    whereConditions.length > 0 ? and(...whereConditions) : undefined;

  const result = await db
    .select({
      timesheet: {
        id: timesheets.id,
        sheetDate: timesheets.sheetDate,
        clockIn: timesheets.clockIn,
        clockOut: timesheets.clockOut,
        breakMinutes: timesheets.breakMinutes,
        totalHours: timesheets.totalHours,
        overtimeHours: timesheets.overtimeHours,
        notes: timesheets.notes,
        status: timesheets.status,
        rejectedBy: timesheets.rejectedBy,
        approvedBy: timesheets.approvedBy,
        createdAt: timesheets.createdAt,
        updatedAt: timesheets.updatedAt,
      },
      employee: {
        id: employees.id,
        employeeId: employees.employeeId,
        departmentId: employees.departmentId,
        positionId: employees.positionId,
      },
      user: {
        id: users.id,
        fullName: users.fullName,
        email: users.email,
      },
    })
    .from(timesheets)
    .innerJoin(employees, eq(timesheets.employeeId, employees.id))
    .innerJoin(users, eq(employees.userId, users.id))
    .where(whereClause)
    .limit(limit)
    .offset(offset)
    .orderBy(employees.employeeId, timesheets.sheetDate);

  // Group timesheets by employee
  const groupedData = result.reduce((acc: any[], row) => {
    const employeeKey = row.employee.employeeId;

    // Find existing employee group or create new one
    let employeeGroup = acc.find((group) => group.employeeId === employeeKey);

    if (!employeeGroup) {
      employeeGroup = {
        employeeId: row.employee.employeeId,
        employee: {
          id: row.employee.id,
          employeeId: row.employee.employeeId,
          departmentId: row.employee.departmentId,
          positionId: row.employee.positionId,
        },
        user: {
          id: row.user.id,
          fullName: row.user.fullName,
          email: row.user.email,
        },
        timesheets: [],
      };
      acc.push(employeeGroup);
    }

    // Add timesheet to employee group (format clockIn/clockOut)
    employeeGroup.timesheets.push(formatTimesheetResponse(row.timesheet));

    return acc;
  }, []);

  // Get total count for pagination
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
      limit: limit,
      totalPages: Math.ceil(totalCount / limit),
    },
  };
};

/**
 * Check if the approver is allowed to approve this timesheet based on role rules:
 * - Technician's timesheet → Manager or Executive can approve
 * - Manager's timesheet → only Executive can approve
 * - Executive (or other) timesheet → only Executive can approve
 */
export const canApproveTimesheet = async (
  approverUserId: string,
  timesheetId: number,
): Promise<{ allowed: boolean; message?: string }> => {
  const [timesheet] = await db
    .select({ employeeId: timesheets.employeeId })
    .from(timesheets)
    .where(and(eq(timesheets.id, timesheetId), eq(timesheets.isDeleted, false)))
    .limit(1);

  if (!timesheet) {
    return { allowed: false, message: "Timesheet not found" };
  }

  if (!timesheet.employeeId) {
    return { allowed: false, message: "Timesheet has no associated employee" };
  }

  const [employee] = await db
    .select({ userId: employees.userId })
    .from(employees)
    .where(eq(employees.id, timesheet.employeeId))
    .limit(1);

  if (!employee?.userId) {
    return {
      allowed: false,
      message: "Employee or user not found for timesheet",
    };
  }

  const submitterRole = await getUserRoles(employee.userId);
  const approverRole = await getUserRoles(approverUserId);

  const submitterRoleNameRaw = submitterRole?.roleName?.trim() ?? "";
  const submitterRoleName = submitterRoleNameRaw.toLowerCase();
  const approverRoleName = approverRole?.roleName?.trim().toLowerCase() ?? "";

  if (!approverRoleName) {
    return { allowed: false, message: "Approver has no role assigned" };
  }

  // Technician's timesheet: Manager or Executive can approve (case-sensitive role name)
  if (submitterRoleNameRaw === "Technician") {
    const allowed =
      approverRoleName === "manager" || approverRoleName === "executive";
    return allowed
      ? { allowed: true }
      : {
          allowed: false,
          message:
            "Only a Manager or Executive can approve a Technician's timesheet",
        };
  }

  // Manager's timesheet: only Executive can approve
  if (submitterRoleName === "manager") {
    const allowed = approverRoleName === "executive";
    return allowed
      ? { allowed: true }
      : {
          allowed: false,
          message: "Only an Executive can approve a Manager's timesheet",
        };
  }

  // Executive or any other role: only Executive can approve
  const allowed = approverRoleName === "executive";
  return allowed
    ? { allowed: true }
    : {
        allowed: false,
        message: "Only an Executive can approve this timesheet",
      };
};

export const approveTimesheet = async (
  timesheetId: number,
  approvedBy: string,
  notes?: string,
) => {
  // Get existing timesheet to preserve employee notes
  const [existingTimesheet] = await db
    .select()
    .from(timesheets)
    .where(eq(timesheets.id, timesheetId));

  if (!existingTimesheet) {
    return null;
  }

  // Update timesheet: only update status and approvedBy (latest)
  // Keep employee notes separate - don't overwrite them
  const [timesheet] = await db
    .update(timesheets)
    .set({
      status: "approved",
      approvedBy: approvedBy, // Store latest approvedBy
      rejectedBy: null, // Clear any previous rejection
      // Keep existing employee notes - don't overwrite
      updatedAt: new Date(),
    })
    .where(eq(timesheets.id, timesheetId))
    .returning();

  // Create approval record for approval (stores full history)
  if (timesheet && notes) {
    await db.insert(timesheetApprovals).values({
      timesheetId: timesheetId,
      action: "approved",
      performedBy: approvedBy,
      remarks: notes, // Store manager notes in approval history if provided
    });
  } else if (timesheet) {
    // Still create approval record even without notes for audit trail
    await db.insert(timesheetApprovals).values({
      timesheetId: timesheetId,
      action: "approved",
      performedBy: approvedBy,
      remarks: null,
    });
  }

  return timesheet ? formatTimesheetResponse(timesheet) : null;
};

export const rejectTimesheet = async (
  timesheetId: number,
  rejectedBy: string,
  rejectionReason: string,
  notes?: string,
) => {
  // Get existing timesheet to preserve employee notes
  const [existingTimesheet] = await db
    .select()
    .from(timesheets)
    .where(and(eq(timesheets.id, timesheetId), eq(timesheets.isDeleted, false)));

  if (!existingTimesheet) {
    return null;
  }

  // Update timesheet: only update status and rejectedBy (latest)
  // Keep employee notes separate - don't overwrite them
  const [timesheet] = await db
    .update(timesheets)
    .set({
      status: "rejected",
      rejectedBy: rejectedBy, // Store latest rejectedBy
      approvedBy: null, // Clear any previous approval
      // Keep existing employee notes - don't overwrite
      updatedAt: new Date(),
    })
    .where(eq(timesheets.id, timesheetId))
    .returning();

  // Create approval record for rejection (stores full history)
  if (timesheet) {
    // Store rejection reason in approval history remarks
    // If manager provided additional notes, combine with rejection reason
    const remarks = notes
      ? `${rejectionReason}\n\nManager Notes: ${notes}`
      : rejectionReason;

    await db.insert(timesheetApprovals).values({
      timesheetId: timesheetId,
      action: "rejected",
      performedBy: rejectedBy,
      remarks: remarks, // Store rejection reason (and manager notes if provided) in approval history
    });
  }

  // Format response to include rejectionReason from approval history
  if (timesheet) {
    const formatted = formatTimesheetResponse(timesheet);
    // Add rejectionReason to the response (from the approval record we just created)
    return {
      ...formatted,
      rejectionReason: rejectionReason, // Latest rejection reason
      // notes field contains employee's notes (preserved)
    };
  }

  return null;
};

export const getTimesheetKPIs = async (weekStartDate: string) => {
  // Calculate week end date (6 days after start)
  const startDate = new Date(weekStartDate);
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);

  const startDateStr = startDate.toISOString().split("T")[0];
  const endDateStr = endDate.toISOString().split("T")[0];

  // 1. Technicians: Total active employees vs employees with timesheets
  const [totalEmployeesResult] = await db
    .select({ count: count() })
    .from(employees)
    .innerJoin(users, eq(employees.userId, users.id))
    .where(
      and(
        eq(employees.isDeleted, false),
        eq(employees.status, "available"), // Only count available employees
      ),
    );

  const totalEmployees = totalEmployeesResult?.count || 0;

  // Count distinct employees with timesheets in the week
  const employeesWithTimesheetsData = await db
    .select({ employeeId: timesheets.employeeId })
    .from(timesheets)
    .innerJoin(employees, eq(timesheets.employeeId, employees.id))
    .where(
      and(
        sql`${timesheets.sheetDate} >= ${startDateStr} AND ${timesheets.sheetDate} <= ${endDateStr}`,
        eq(employees.isDeleted, false),
        eq(timesheets.isDeleted, false),
      ),
    );

  // Get unique employee IDs
  const uniqueEmployeeIds = new Set(
    employeesWithTimesheetsData.map((row) => row.employeeId),
  );
  const employeesWithTimesheets = uniqueEmployeeIds.size;

  // 2. Tracked Hours: Sum of totalHours + overtimeHours for the week
  const hoursResult = await db
    .select({
      totalHours: sum(timesheets.totalHours),
      overtimeHours: sum(timesheets.overtimeHours),
    })
    .from(timesheets)
    .innerJoin(employees, eq(timesheets.employeeId, employees.id))
    .where(
      and(
        sql`${timesheets.sheetDate} >= ${startDateStr} AND ${timesheets.sheetDate} <= ${endDateStr}`,
        eq(employees.isDeleted, false),
        eq(timesheets.isDeleted, false),
      ),
    );

  const totalHours = parseFloat(hoursResult[0]?.totalHours || "0");
  const overtimeHours = parseFloat(hoursResult[0]?.overtimeHours || "0");
  const trackedHours = totalHours + overtimeHours;

  // 3. Pending Approvals: Count of timesheets with status "pending" or "submitted"
  const [pendingApprovalsResult] = await db
    .select({ count: count() })
    .from(timesheets)
    .innerJoin(employees, eq(timesheets.employeeId, employees.id))
    .where(
      and(
        sql`${timesheets.sheetDate} >= ${startDateStr} AND ${timesheets.sheetDate} <= ${endDateStr}`,
        eq(employees.isDeleted, false),
        eq(timesheets.isDeleted, false),
        or(
          eq(timesheets.status, "pending"),
          eq(timesheets.status, "submitted"),
        )!,
      ),
    );

  const pendingApprovals = pendingApprovalsResult?.count || 0;

  // 4. Rejected Entries: Count of timesheets with status "rejected"
  const [rejectedEntriesResult] = await db
    .select({ count: count() })
    .from(timesheets)
    .innerJoin(employees, eq(timesheets.employeeId, employees.id))
    .where(
      and(
        sql`${timesheets.sheetDate} >= ${startDateStr} AND ${timesheets.sheetDate} <= ${endDateStr}`,
        eq(employees.isDeleted, false),
        eq(timesheets.isDeleted, false),
        eq(timesheets.status, "rejected"),
      ),
    );

  const rejectedEntries = rejectedEntriesResult?.count || 0;

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
      doubleTime: 0, // If double time is tracked separately, add it here
      label: `${trackedHours.toFixed(1)}h Regular + OT + Double`,
    },
    pendingApprovals: {
      count: pendingApprovals,
      label: `${pendingApprovals} Need manager review`,
    },
    rejectedEntries: {
      count: rejectedEntries,
      label: `${rejectedEntries} Awaiting technician edits`,
    },
  };
};

// ===========================================================================
// Bulk Delete
// ===========================================================================

export const bulkDeleteTimesheets = async (
  ids: number[],
  deletedBy: string,
) => {
  const now = new Date();
  const result = await db
    .update(timesheets)
    .set({ isDeleted: true, deletedAt: now, deletedBy, updatedAt: now })
    .where(and(inArray(timesheets.id, ids), eq(timesheets.isDeleted, false)))
    .returning({ id: timesheets.id });
  return { deleted: result.length, skipped: ids.length - result.length };
};
