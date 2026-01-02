import { count, eq, and, or, ilike, sql } from "drizzle-orm";
import { db } from "../config/db.js";
import { employees } from "../drizzle/schema/org.schema.js";
import { timesheets } from "../drizzle/schema/timesheet.schema.js";
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
  clockOut?: Date; // Now optional - can be null if employee hasn't clocked out yet
  breakMinutes?: number;
  totalHours?: string;
  overtimeHours?: string;
  notes?: string;
  status?: "pending" | "submitted" | "approved" | "rejected";
  rejectedBy?: string;
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
      clockOut: data.clockOut || null, // Can be null if not provided
      breakMinutes: data.breakMinutes || 0,
      totalHours: data.totalHours || "0",
      overtimeHours: data.overtimeHours || "0",
      notes: data.notes || null,
      status: data.status || "pending",
      rejectedBy: data.rejectedBy || null,
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
    rejectedBy?: string;
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

export const deleteTimesheet = async (id: number) => {
  const [timesheet] = await db
    .delete(timesheets)
    .where(eq(timesheets.id, id))
    .returning();
  return timesheet || null;
};

export const clockIn = async (data: {
  employeeId: number;
  clockInDate: Date;
  clockInTime: string;
  notes?: string;
}) => {
  // Combine date and time into a single datetime
  const timeParts = data.clockInTime.split(":");
  const hours = parseInt(timeParts[0] || "0", 10);
  const minutes = parseInt(timeParts[1] || "0", 10);
  const clockInDateTime = new Date(data.clockInDate);
  clockInDateTime.setHours(hours, minutes, 0, 0);

  // Get today's date for the sheet
  const sheetDate = new Date(data.clockInDate);
  sheetDate.setHours(0, 0, 0, 0); // Set to start of day

  const sheetDateStr = sheetDate.toISOString().split("T")[0];

  // Check if there's already a timesheet for this employee today
  const existingTimesheet = await db
    .select()
    .from(timesheets)
    .where(
      and(
        eq(timesheets.employeeId, data.employeeId),
        eq(timesheets.sheetDate, sheetDateStr as string)
      )
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
      clockIn: clockInDateTime,
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

  return timesheet;
};

export const clockOut = async (data: {
  employeeId: number;
  clockOutDate: Date;
  clockOutTime: string;
  notes?: string;
  breakMinutes?: number;
}) => {
  // Combine date and time into a single datetime
  const timeParts = data.clockOutTime.split(":");
  const hours = parseInt(timeParts[0] || "0", 10);
  const minutes = parseInt(timeParts[1] || "0", 10);
  const clockOutDateTime = new Date(data.clockOutDate);
  clockOutDateTime.setHours(hours, minutes, 0, 0);

  // Get today's date for the sheet
  const sheetDate = new Date(data.clockOutDate);
  sheetDate.setHours(0, 0, 0, 0); // Set to start of day

  const sheetDateStr = sheetDate.toISOString().split("T")[0];

  // Find existing timesheet for today
  const [existingTimesheet] = await db
    .select()
    .from(timesheets)
    .where(
      and(
        eq(timesheets.employeeId, data.employeeId),
        eq(timesheets.sheetDate, sheetDateStr as string)
      )
    );

  if (!existingTimesheet) {
    throw new Error(
      "No clock-in record found for today. Please clock in first."
    );
  }

  // Calculate total hours worked
  const clockInTime = new Date(existingTimesheet.clockIn);
  const clockOutTime = clockOutDateTime;
  const breakMinutes = data.breakMinutes || existingTimesheet.breakMinutes || 0;

  const totalMilliseconds = clockOutTime.getTime() - clockInTime.getTime();
  const totalMinutes =
    Math.floor(totalMilliseconds / (1000 * 60)) - breakMinutes;
  const totalHours = (totalMinutes / 60).toFixed(2);

  // Calculate overtime (assuming 8 hours is regular time)
  const regularHours = 8;
  const overtimeHours = Math.max(
    0,
    parseFloat(totalHours) - regularHours
  ).toFixed(2);

  // Update the timesheet with clock-out information
  const [updatedTimesheet] = await db
    .update(timesheets)
    .set({
      clockOut: clockOutDateTime,
      breakMinutes: breakMinutes,
      totalHours: totalHours,
      overtimeHours: overtimeHours,
      notes: data.notes || existingTimesheet.notes,
      updatedAt: new Date(),
    })
    .where(eq(timesheets.id, existingTimesheet.id))
    .returning();

  return updatedTimesheet;
};

export const getWeeklyTimesheetsByEmployee = async (
  weekStartDate: string, // YYYY-MM-DD format
  search?: string
) => {
  // Calculate week end date (6 days after start)
  const startDate = new Date(weekStartDate);
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);

  const startDateStr = startDate.toISOString().split("T")[0];
  const endDateStr = endDate.toISOString().split("T")[0];

  let whereConditions: any[] = [];

  // Add date range filter for the week
  whereConditions.push(
    sql`${timesheets.sheetDate} >= ${startDateStr} AND ${timesheets.sheetDate} <= ${endDateStr}`
  );

  // Add search filter if provided
  if (search) {
    whereConditions.push(
      or(
        ilike(employees.employeeId, `%${search}%`),
        ilike(users.fullName, `%${search}%`)
      )!
    );
  }

  const whereClause = and(...whereConditions);

  // Get all timesheets for the week with employee and user details
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
    })
    .from(timesheets)
    .innerJoin(employees, eq(timesheets.employeeId, employees.id))
    .innerJoin(users, eq(employees.userId, users.id))
    .where(whereClause)
    .orderBy(users.fullName, timesheets.sheetDate);

  // Get all employees (even those without timesheets this week) if no search
  let allEmployees;
  if (!search) {
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
      })
      .from(employees)
      .innerJoin(users, eq(employees.userId, users.id))
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

  // Add employees without timesheets if no search filter
  if (!search && allEmployees) {
    allEmployees.forEach((emp) => {
      const empId = emp.employee.id;
      if (!employeeMap.has(empId)) {
        employeeMap.set(empId, {
          employeeInfo: {
            id: emp.employee.id,
            employeeId: emp.employee.employeeId,
            departmentId: emp.employee.departmentId,
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

    if (employeeData) {
      const dayIndex = employeeData.weekDays.findIndex(
        (day: any) => day.date === row.timesheet.sheetDate
      );

      if (dayIndex >= 0) {
        const totalHours = parseFloat(row.timesheet.totalHours || "0");
        const overtimeHours = parseFloat(row.timesheet.overtimeHours || "0");
        const regularHours = Math.max(0, totalHours - overtimeHours);

        employeeData.weekDays[dayIndex] = {
          date: row.timesheet.sheetDate,
          dayName: employeeData.weekDays[dayIndex].dayName,
          timesheet: row.timesheet,
          hours: totalHours.toFixed(1),
          status: row.timesheet.clockOut ? row.timesheet.status : "clocked_in",
        };

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
      // If there's already timesheet data, keep the existing status
      if (day.timesheet) {
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

  return {
    weekInfo: {
      startDate: startDateStr,
      endDate: endDateStr,
      weekDays: weekDays,
    },
    employees: formattedData,
  };
};

// Get weekly timesheets for a specific employee (for technician's own view)
export const getMyWeeklyTimesheets = async (
  employeeId: number,
  weekStartDate: string,
  search?: string
) => {
  // Get all weekly data
  const weeklyData = await getWeeklyTimesheetsByEmployee(weekStartDate, search);
  
  // Filter to only include the current employee's data
  const myEmployeeData = weeklyData.employees.find(
    (emp) => emp.employeeInfo.id === employeeId
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
  dateTo?: string
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

    // Add timesheet to employee group
    employeeGroup.timesheets.push(row.timesheet);

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

export const approveTimesheet = async (
  timesheetId: number,
  approvedBy: string,
  notes?: string
) => {
  const [timesheet] = await db
    .update(timesheets)
    .set({
      status: "approved",
      approvedBy: approvedBy,
      rejectedBy: null, // Clear any previous rejection
      notes: notes || undefined,
      updatedAt: new Date(),
    })
    .where(eq(timesheets.id, timesheetId))
    .returning();
  return timesheet || null;
};

export const rejectTimesheet = async (
  timesheetId: number,
  rejectedBy: string,
  rejectionReason: string,
  notes?: string
) => {
  const [timesheet] = await db
    .update(timesheets)
    .set({
      status: "rejected",
      rejectedBy: rejectedBy,
      approvedBy: null, // Clear any previous approval
      notes: notes || rejectionReason, // Use rejection reason as notes if no additional notes provided
      updatedAt: new Date(),
    })
    .where(eq(timesheets.id, timesheetId))
    .returning();
  return timesheet || null;
};
