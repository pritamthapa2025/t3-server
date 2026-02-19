import {
  count,
  eq,
  desc,
  and,
  or,
  sql,
  ilike,
  inArray,
  gte,
  lte,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../config/db.js";
import {
  employees,
  departments,
  positions,
  userBankAccounts,
  employeeReviews,
} from "../drizzle/schema/org.schema.js";
import {
  timesheets,
  timesheetApprovals,
} from "../drizzle/schema/timesheet.schema.js";
import { users, userRoles, roles } from "../drizzle/schema/auth.schema.js";
import {
  vehicles,
  maintenanceRecords,
  repairRecords,
  safetyInspections,
  fuelRecords,
  assignmentHistory,
} from "../drizzle/schema/fleet.schema.js";
import {
  dispatchAssignments,
  dispatchTasks,
} from "../drizzle/schema/dispatch.schema.js";
import { jobTeamMembers } from "../drizzle/schema/jobs.schema.js";
import { jobs } from "../drizzle/schema/jobs.schema.js";

const reportsToUser = alias(users, "reports_to_user");

export const getEmployees = async (
  offset: number,
  limit: number,
  filters?: {
    search?: string;
    status?: string;
    departmentId?: number;
  },
) => {
  const conditions: ReturnType<typeof eq>[] = [
    eq(employees.isDeleted, false),
    eq(users.isActive, true),
  ];

  if (filters?.status) {
    conditions.push(
      eq(
        employees.status,
        filters.status as
          | "available"
          | "on_leave"
          | "in_field"
          | "terminated"
          | "suspended",
      ),
    );
  }
  if (filters?.departmentId) {
    conditions.push(eq(employees.departmentId, filters.departmentId));
  }
  if (filters?.search) {
    conditions.push(
      or(
        ilike(users.fullName, `%${filters.search}%`),
        ilike(users.email, `%${filters.search}%`),
        ilike(employees.employeeId, `%${filters.search}%`),
      )!,
    );
  }

  const whereClause = and(...conditions);

  // Get employees with all related data for table view
  const result = await db
    .select({
      // Employee data
      id: employees.id,
      employeeId: employees.employeeId,
      status: employees.status,
      performance: employees.performance,
      violations: employees.violations,
      startDate: employees.startDate,

      // User data
      userId: users.id,
      fullName: users.fullName,
      email: users.email,
      phone: users.phone,
      profilePicture: users.profilePicture,
      isActive: users.isActive,
      lastLogin: users.lastLogin,

      // Department data
      departmentId: departments.id,
      departmentName: departments.name,

      // Position data (Job Title)
      positionId: positions.id,
      positionName: positions.name,
    })
    .from(employees)
    .leftJoin(users, eq(employees.userId, users.id))
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .leftJoin(positions, eq(employees.positionId, positions.id))
    .where(whereClause)
    .limit(limit)
    .offset(offset);

  // Get total count for pagination (includes same joins for search filter)
  const totalResult = await db
    .select({ count: count() })
    .from(employees)
    .leftJoin(users, eq(employees.userId, users.id))
    .where(whereClause);

  const total = totalResult[0]?.count ?? 0;

  // For each employee, get additional calculated data
  const employeesWithDetails = await Promise.all(
    result.map(async (emp) => {
      // Get latest performance review for rating
      const latestReview = await db
        .select({
          averageScore: employeeReviews.averageScore,
          reviewDate: employeeReviews.reviewDate,
        })
        .from(employeeReviews)
        .where(eq(employeeReviews.employeeId, emp.id))
        .orderBy(desc(employeeReviews.reviewDate))
        .limit(1);

      // Calculate overall rating from performance and reviews
      const reviewScore = latestReview[0]?.averageScore
        ? parseFloat(latestReview[0].averageScore)
        : null;
      const performanceScore = emp.performance || 0;

      let overallRating: string | null = null;
      if (reviewScore !== null) {
        overallRating = `${reviewScore.toFixed(1)} Rating`;
      } else if (performanceScore > 0) {
        overallRating = `${(performanceScore / 10).toFixed(1)} Rating`; // Convert percentage to 10-point scale
      } else {
        overallRating = "Pending";
      }

      // Determine portal role (this might need to be added to your schema)
      // For now, using position as a proxy for portal role
      let portalRole = "Office Staff"; // default
      if (emp.positionName) {
        if (
          emp.positionName.toLowerCase().includes("director") ||
          emp.positionName.toLowerCase().includes("admin")
        ) {
          portalRole = "Administrator";
        } else if (
          emp.positionName.toLowerCase().includes("manager") ||
          emp.positionName.toLowerCase().includes("supervisor")
        ) {
          portalRole = "Manager";
        } else if (
          (emp.positionName ?? "").includes("Technician") ||
          (emp.positionName ?? "").includes("Engineer")
        ) {
          portalRole = "Technician";
        }
      }

      return {
        id: emp.id,
        employeeId: emp.employeeId,

        // Personal Information
        user: {
          id: emp.userId,
          fullName: emp.fullName,
          email: emp.email,
          phone: emp.phone,
          profilePicture: emp.profilePicture,
          isActive: emp.isActive,
          lastLogin: emp.lastLogin,
        },

        // Role and Position
        portalRole: portalRole,
        jobTitle: emp.positionName || "N/A",
        department: emp.departmentName || "N/A",

        // TODO: Implement pay rate - this will need a separate payroll/compensation table
        payRate: {
          amount: null, // Will be implemented when payroll table is added
          type: null, // 'hourly' | 'salary'
          display: "Not Set",
        },

        // Performance Metrics
        performance: emp.performance ? `${emp.performance}%` : "N/A",
        violations: emp.violations || 0,
        status: emp.status || "available",
        rating: overallRating,

        // Metadata
        startDate: emp.startDate,
        // TODO: Add current client assignments here
      };
    }),
  );

  return {
    data: employeesWithDetails,
    total: total,
    pagination: {
      page: Math.floor(offset / limit) + 1,
      limit: limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getEmployeeById = async (id: number) => {
  // Get employee with all related data
  const employeeQuery = await db
    .select({
      // Employee data
      employee: employees,
      // User data
      user: users,
      // Department data
      department: departments,
      // Position data
      position: positions,
    })
    .from(employees)
    .leftJoin(users, eq(employees.userId, users.id))
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .leftJoin(positions, eq(employees.positionId, positions.id))
    .where(eq(employees.id, id))
    .limit(1);

  if (employeeQuery.length === 0) {
    return null;
  }

  const result = employeeQuery[0]!; // Safe because we've checked length above
  const employee = result.employee;
  const user = result.user;
  const department = result.department;
  const position = result.position;

  // Get manager information separately
  let managerData = null;
  if (employee.reportsTo) {
    const managerResult = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
      })
      .from(users)
      .where(eq(users.id, employee.reportsTo))
      .limit(1);

    managerData = managerResult[0] || null;
  }

  // Get user's role
  let roleId: number | undefined = undefined;
  let portalRole: string | undefined = undefined;
  if (user?.id) {
    const [roleResult] = await db
      .select({
        roleId: roles.id,
        roleName: roles.name,
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, user.id))
      .limit(1);

    if (roleResult) {
      roleId = roleResult.roleId;
      // Determine portal role based on role name
      const roleNameLower = roleResult.roleName.toLowerCase();
      if (
        roleNameLower.includes("director") ||
        roleNameLower.includes("admin")
      ) {
        portalRole = "Administrator";
      } else if (
        roleNameLower.includes("manager") ||
        roleNameLower.includes("supervisor")
      ) {
        portalRole = "Manager";
      } else if (
        roleResult.roleName === "Technician" ||
        roleResult.roleName === "Engineer"
      ) {
        portalRole = "Technician";
      } else {
        portalRole = "Office Staff";
      }
    }
  }

  // Get bank account information
  const bankAccount = user?.id
    ? await db
        .select()
        .from(userBankAccounts)
        .where(
          and(
            eq(userBankAccounts.userId, user.id),
            eq(userBankAccounts.isPrimary, true),
            eq(userBankAccounts.isDeleted, false),
          ),
        )
        .limit(1)
    : [];

  // Get latest performance review
  const latestReview = await db
    .select()
    .from(employeeReviews)
    .where(eq(employeeReviews.employeeId, id))
    .orderBy(desc(employeeReviews.reviewDate))
    .limit(1);

  // Get timesheet statistics for current month
  const currentMonth = new Date();
  const startOfMonth = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth(),
    1,
  );
  const endOfMonth = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth() + 1,
    0,
  );

  const timesheetStats = await db
    .select({
      totalHours: timesheets.totalHours,
      status: timesheets.status,
      sheetDate: timesheets.sheetDate,
    })
    .from(timesheets)
    .where(eq(timesheets.employeeId, id))
    .orderBy(desc(timesheets.sheetDate))
    .limit(30);

  // Calculate performance metrics
  const totalTimesheets = timesheetStats.length;
  const onTimeEntries = timesheetStats.filter(
    (t) => t.status === "approved",
  ).length;
  const onTimeRate =
    totalTimesheets > 0
      ? Math.round((onTimeEntries / totalTimesheets) * 100)
      : 0;

  const totalHoursThisMonth = timesheetStats
    .filter((t) => {
      const sheetDate = new Date(t.sheetDate);
      return sheetDate >= startOfMonth && sheetDate <= endOfMonth;
    })
    .reduce((sum, t) => sum + parseFloat(t.totalHours || "0"), 0);

  // Get actual recent activity from multiple sources
  const activityPromises = [
    // Get recent performance reviews
    db
      .select({
        type: sql<string>`'review'`,
        action: employeeReviews.title,
        performedBy: users.fullName,
        timestamp: employeeReviews.reviewDate,
        details: employeeReviews.averageScore,
      })
      .from(employeeReviews)
      .leftJoin(users, eq(employeeReviews.reviewerId, users.id))
      .where(eq(employeeReviews.employeeId, id))
      .orderBy(desc(employeeReviews.reviewDate))
      .limit(5),

    // Get recent timesheet approvals
    db
      .select({
        type: sql<string>`'timesheet'`,
        action: timesheetApprovals.action,
        performedBy: users.fullName,
        timestamp: timesheetApprovals.createdAt,
        details: timesheetApprovals.remarks,
      })
      .from(timesheetApprovals)
      .leftJoin(timesheets, eq(timesheetApprovals.timesheetId, timesheets.id))
      .leftJoin(users, eq(timesheetApprovals.performedBy, users.id))
      .where(eq(timesheets.employeeId, id))
      .orderBy(desc(timesheetApprovals.createdAt))
      .limit(10),

    // Get recent timesheet submissions
    db
      .select({
        type: sql<string>`'submission'`,
        action: sql<string>`'timesheet_submitted'`,
        performedBy: users.fullName,
        timestamp: timesheets.createdAt,
        details: timesheets.sheetDate,
      })
      .from(timesheets)
      .leftJoin(users, eq(timesheets.approvedBy, users.id))
      .where(eq(timesheets.employeeId, id))
      .orderBy(desc(timesheets.createdAt))
      .limit(10),
  ];

  const activityResults = await Promise.all(activityPromises);
  const [reviews, approvals, submissions] = activityResults;

  // Combine and format all activities
  const allActivities: Array<{
    action: string;
    performedBy: string;
    timestamp: string;
    details?: string | undefined;
  }> = [];

  // Add review activities
  if (reviews) {
    reviews.forEach((review) => {
      const activity = {
        action: `Performance review completed: ${review.action || "Review"}`,
        performedBy: review.performedBy || "System",
        timestamp: review.timestamp
          ? new Date(review.timestamp).toISOString()
          : new Date().toISOString(),
      } as any;

      if (review.details) {
        activity.details = `Score: ${review.details}`;
      }

      allActivities.push(activity);
    });
  }

  // Add timesheet approval activities
  if (approvals) {
    approvals.forEach((approval) => {
      const actionText =
        approval.action === "approved"
          ? "Timesheet approved"
          : approval.action === "rejected"
            ? "Timesheet rejected"
            : `Timesheet ${approval.action || "updated"}`;

      const activity = {
        action: actionText,
        performedBy: approval.performedBy || "System",
        timestamp: approval.timestamp
          ? new Date(approval.timestamp).toISOString()
          : new Date().toISOString(),
      } as any;

      if (approval.details) {
        activity.details = approval.details;
      }

      allActivities.push(activity);
    });
  }

  // Add timesheet submission activities
  if (submissions) {
    submissions.forEach((submission) => {
      const activity = {
        action: "Timesheet submitted",
        performedBy:
          submission.performedBy || employee.employeeId || "Employee",
        timestamp: submission.timestamp
          ? new Date(submission.timestamp).toISOString()
          : new Date().toISOString(),
      } as any;

      if (submission.details) {
        activity.details = `For ${new Date(
          submission.details,
        ).toLocaleDateString()}`;
      }

      allActivities.push(activity);
    });
  }

  // Add employee profile update activity (if recently updated)
  if (employee.updatedAt) {
    const daysSinceUpdate = Math.floor(
      (Date.now() - new Date(employee.updatedAt).getTime()) /
        (1000 * 60 * 60 * 24),
    );
    if (daysSinceUpdate <= 30) {
      // Only show if updated in last 30 days
      allActivities.push({
        action: "Employee profile updated",
        performedBy: "System Admin",
        timestamp: employee.updatedAt.toISOString(),
        details: `Department: ${department?.name || "N/A"}`,
      });
    }
  }

  // Sort by timestamp (most recent first) and limit to 10 most recent
  const recentActivity = allActivities
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    )
    .slice(0, 10);

  // Return comprehensive employee data
  return {
    // Basic employee information
    id: employee.id,
    employeeId: employee.employeeId,
    status: employee.status,
    startDate: employee.startDate,
    endDate: employee.endDate,
    performance: employee.performance,
    violations: employee.violations,
    note: employee.note,

    // User information
    user: user
      ? {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          phone: user.phone,
          profilePicture: user.profilePicture,
          isActive: user.isActive,
          lastLogin: user.lastLogin,
          location: "N/A", // Mock location - add location fields to user schema if needed
        }
      : null,

    // Role information
    roleId: roleId,
    portalRole: portalRole,

    // Department information
    department: department
      ? {
          id: department.id,
          name: department.name,
          description: department.description,
        }
      : null,

    // Position information
    position: position
      ? {
          id: position.id,
          name: position.name,
          description: position.description,
        }
      : null,

    // Manager information
    manager: managerData,

    // Performance overview
    performanceOverview: {
      onTimeRate: onTimeRate,
      violations: employee.violations || 0,
      hoursThisMonth: Math.round(totalHoursThisMonth),
      tasksCompleted: 24, // Mock data - implement actual task tracking
      lastLogin: user?.lastLogin
        ? `${Math.floor(
            (Date.now() - new Date(user.lastLogin).getTime()) /
              (1000 * 60 * 60),
          )} hours ago`
        : "Never",
    },

    // Bank account information
    bankAccount: bankAccount[0]
      ? {
          bankName: bankAccount[0].bankName,
          accountHolderName: bankAccount[0].accountHolderName,
          accountType: bankAccount[0].accountType,
          accountNumber: bankAccount[0].accountNumber,
          routingNumber: bankAccount[0].routingNumber,
          isVerified: bankAccount[0].isVerified,
        }
      : null,

    // Latest performance review
    latestReview: latestReview[0]
      ? {
          id: latestReview[0].id,
          title: latestReview[0].title,
          reviewDate: latestReview[0].reviewDate,
          averageScore: latestReview[0].averageScore,
          ratings: latestReview[0].ratings,
          notes: latestReview[0].notes,
        }
      : null,

    // Recent activity
    activityLog: recentActivity,

    // Metadata
    createdAt: employee.createdAt,
    updatedAt: employee.updatedAt,
  };
};

// Generate Employee ID using PostgreSQL sequence (thread-safe)
// Format: T3-2025-000001 (6 digits, auto-expands to 7, 8, 9+ as needed)
export const generateEmployeeId = async (): Promise<string> => {
  const year = new Date().getFullYear();

  try {
    // Use PostgreSQL sequence for atomic ID generation (thread-safe)
    const result = await db.execute<{ nextval: string }>(
      sql.raw(`SELECT nextval('org.employee_id_seq')::text as nextval`),
    );

    const nextNumber = parseInt(result.rows[0]?.nextval || "1");

    // Use 4 digits minimum, auto-expand when exceeds 9999
    const padding = Math.max(4, nextNumber.toString().length);
    return `T3-${year}-${String(nextNumber).padStart(padding, "0")}`;
  } catch (error) {
    // Fallback to old method if sequence doesn't exist yet
    console.warn(
      "Employee ID sequence not found, using fallback method:",
      error,
    );

    const totalResult = await db
      .select({ count: count() })
      .from(employees)
      .where(eq(employees.isDeleted, false));
    const total = totalResult[0]?.count ?? 0;
    const nextNumber = total + 1;

    // Use 4 digits minimum, auto-expand when exceeds 9999
    const padding = Math.max(4, nextNumber.toString().length);
    return `T3-${year}-${String(nextNumber).padStart(padding, "0")}`;
  }
};

/**
 * Get employee KPIs (total, active, in field, attendance, timesheet violations)
 */
export const getEmployeeKPIs = async (): Promise<{
  totalEmployees: number;
  activeEmployees: number;
  inField: number;
  attendance: number;
  timesheetViolations: number;
}> => {
  const notDeleted = eq(employees.isDeleted, false);

  const [totalRow] = await db
    .select({ count: count() })
    .from(employees)
    .where(notDeleted);
  const totalEmployees = Number(totalRow?.count ?? 0);

  const activeStatuses = ["available", "on_leave", "in_field"] as const;
  const [activeRow] = await db
    .select({ count: count() })
    .from(employees)
    .where(and(notDeleted, inArray(employees.status, activeStatuses)));
  const activeEmployees = Number(activeRow?.count ?? 0);

  const [inFieldRow] = await db
    .select({ count: count() })
    .from(employees)
    .where(and(notDeleted, eq(employees.status, "in_field")));
  const inField = Number(inFieldRow?.count ?? 0);

  // Attendance: count of employees who have at least one timesheet submitted today
  const todayStr = new Date().toISOString().split("T")[0]!;
  const [attendanceRow] = await db
    .select({ count: sql<number>`count(distinct ${timesheets.employeeId})` })
    .from(timesheets)
    .where(
      and(
        eq(timesheets.sheetDate, todayStr),
        inArray(timesheets.status, ["submitted", "approved"]),
      ),
    );
  const attendance = Number(attendanceRow?.count ?? 0);

  // Timesheet violations: sum of violations across all active employees
  const [violationsRow] = await db
    .select({ total: sql<number>`coalesce(sum(${employees.violations}), 0)` })
    .from(employees)
    .where(notDeleted);
  const timesheetViolations = Number(violationsRow?.total ?? 0);

  return {
    totalEmployees,
    activeEmployees,
    inField,
    attendance,
    timesheetViolations,
  };
};

/**
 * Get pay type and hourly rate from a position for copying into an employee.
 * Position = default for the role; employee can override later.
 */
async function getPayDefaultsFromPosition(positionId: number): Promise<{
  payType: string | null;
  hourlyRate: string | null;
}> {
  const [pos] = await db
    .select({ payType: positions.payType, payRate: positions.payRate })
    .from(positions)
    .where(eq(positions.id, positionId))
    .limit(1);
  if (!pos) return { payType: null, hourlyRate: null };
  const payType = pos.payType?.trim().toLowerCase() ?? null;
  const payRate = pos.payRate != null ? String(pos.payRate) : null;
  // Hourly position: use payRate as hourly rate. Salary: employee.hourlyRate stays null.
  const hourlyRate =
    payType === "hourly" && payRate != null && Number(payRate) > 0
      ? payRate
      : null;
  return { payType, hourlyRate };
}

export const createEmployee = async (data: {
  userId: string;
  departmentId?: number;
  positionId?: number;
  reportsTo?: string;
  startDate?: Date;
}) => {
  // Always auto-generate employeeId - never accept from external input
  const employeeId = await generateEmployeeId();

  let payType: string | null = null;
  let hourlyRate: string | null = null;
  if (data.positionId) {
    const defaults = await getPayDefaultsFromPosition(data.positionId);
    payType = defaults.payType;
    hourlyRate = defaults.hourlyRate;
  }

  const [employee] = await db
    .insert(employees)
    .values({
      userId: data.userId,
      employeeId: employeeId,
      departmentId: data.departmentId || null,
      positionId: data.positionId || null,
      reportsTo: data.reportsTo || null,
      startDate: data.startDate || null,
      payType: payType ?? undefined,
      hourlyRate: hourlyRate ?? undefined,
    })
    .returning();
  return employee;
};

export const updateEmployee = async (
  id: number,
  data: {
    userId?: string;
    departmentId?: number;
    positionId?: number;
    reportsTo?: string;
    status?: "available" | "on_leave" | "in_field" | "terminated" | "suspended";
    startDate?: Date | null;
    endDate?: Date | null;
    note?: unknown;
  },
) => {
  const updateData: {
    userId?: string;
    departmentId?: number | null;
    positionId?: number | null;
    reportsTo?: string | null;
    status?: "available" | "on_leave" | "in_field" | "terminated" | "suspended";
    startDate?: Date | null;
    endDate?: Date | null;
    payType?: string | null;
    hourlyRate?: string | null;
    note?: unknown;
    updatedAt: Date;
  } = {
    updatedAt: new Date(),
  };

  if (data.userId !== undefined) {
    updateData.userId = data.userId;
  }
  if (data.departmentId !== undefined) {
    updateData.departmentId = data.departmentId || null;
  }
  if (data.positionId !== undefined) {
    updateData.positionId = data.positionId || null;
    // When position is set or changed, copy pay defaults from the new position
    if (data.positionId != null) {
      const defaults = await getPayDefaultsFromPosition(data.positionId);
      updateData.payType = defaults.payType;
      updateData.hourlyRate = defaults.hourlyRate;
    }
  }
  if (data.reportsTo !== undefined) {
    updateData.reportsTo = data.reportsTo || null;
  }
  if (data.status !== undefined) {
    updateData.status = data.status;
  }
  if (data.startDate !== undefined) {
    updateData.startDate = data.startDate;
  }
  if (data.endDate !== undefined) {
    updateData.endDate = data.endDate;
  }
  if (data.note !== undefined) {
    updateData.note = data.note;
  }

  const [employee] = await db
    .update(employees)
    .set(updateData)
    .where(eq(employees.id, id))
    .returning();
  return employee || null;
};

export const deleteEmployee = async (id: number, deletedBy?: string) => {
  const now = new Date();

  // 1. Nullify FK pointers that reference this employee (preserve financial/historical records)
  // 2. Deactivate job team memberships and dispatch assignments
  await Promise.all([
    // Nullify vehicle assignment (vehicle stays, assignment is cleared)
    db
      .update(vehicles)
      .set({ assignedToEmployeeId: null, updatedAt: now })
      .where(eq(vehicles.assignedToEmployeeId, id)),
    // Nullify fleet maintenance/repair records (preserve the history)
    db
      .update(maintenanceRecords)
      .set({ assignedToEmployeeId: null, updatedAt: now })
      .where(eq(maintenanceRecords.assignedToEmployeeId, id)),
    db
      .update(repairRecords)
      .set({ assignedToEmployeeId: null, updatedAt: now })
      .where(eq(repairRecords.assignedToEmployeeId, id)),
    db
      .update(safetyInspections)
      .set({ employeeId: null, updatedAt: now })
      .where(eq(safetyInspections.employeeId, id)),
    db
      .update(fuelRecords)
      .set({ employeeId: null, updatedAt: now })
      .where(eq(fuelRecords.employeeId, id)),
    db
      .update(assignmentHistory)
      .set({ employeeId: null, updatedAt: now })
      .where(eq(assignmentHistory.employeeId, id)),
    // Deactivate job team memberships
    db
      .update(jobTeamMembers)
      .set({ isActive: false })
      .where(
        and(
          eq(jobTeamMembers.employeeId, id),
          eq(jobTeamMembers.isActive, true),
        ),
      ),
    // Soft-delete future dispatch assignments for this technician
    db
      .update(dispatchAssignments)
      .set({ isDeleted: true, updatedAt: now })
      .where(
        and(
          eq(dispatchAssignments.technicianId, id),
          eq(dispatchAssignments.isDeleted, false),
        ),
      ),
  ]);

  // 3. Soft-delete the employee
  const [employee] = await db
    .update(employees)
    .set({
      isDeleted: true,
      deletedAt: now,
      ...(deletedBy ? { deletedBy } : {}),
      updatedAt: now,
    })
    .where(and(eq(employees.id, id), eq(employees.isDeleted, false)))
    .returning();
  return employee || null;
};

export const getEmployeesSimple = async (
  search?: string,
  positionId?: number,
  roleId?: number,
) => {
  let whereConditions = [
    eq(employees.isDeleted, false),
    eq(users.isActive, true),
  ];

  // Search filter
  if (search) {
    whereConditions.push(
      or(
        ilike(users.fullName, `%${search}%`),
        ilike(users.email, `%${search}%`),
        ilike(employees.employeeId, `%${search}%`),
      )!,
    );
  }

  // Position filter
  if (positionId !== undefined) {
    whereConditions.push(eq(employees.positionId, positionId));
  }

  const result = await db
    .select({
      id: employees.id,
      employeeId: employees.employeeId,
      status: employees.status,
      userId: users.id,
      fullName: users.fullName,
      positionId: employees.positionId,
      positionName: positions.name,
    })
    .from(employees)
    .leftJoin(users, eq(employees.userId, users.id))
    .leftJoin(positions, eq(employees.positionId, positions.id))
    .where(and(...whereConditions))
    .orderBy(users.fullName);

  // Get roles for all users
  const userIds = result.map((emp) => emp.userId).filter(Boolean) as string[];
  const rolesData =
    userIds.length > 0
      ? await db
          .select({
            userId: userRoles.userId,
            roleId: roles.id,
            roleName: roles.name,
          })
          .from(userRoles)
          .innerJoin(roles, eq(userRoles.roleId, roles.id))
          .where(
            and(inArray(userRoles.userId, userIds), eq(roles.isDeleted, false)),
          )
      : [];

  const rolesMap = new Map<string, { id: number; name: string }>();
  for (const roleData of rolesData) {
    if (!rolesMap.has(roleData.userId)) {
      rolesMap.set(roleData.userId, {
        id: roleData.roleId,
        name: roleData.roleName,
      });
    }
  }

  // Filter by roleId if specified
  let filteredResult = result;
  if (roleId !== undefined) {
    filteredResult = result.filter((emp) => {
      if (!emp.userId) return false;
      const userRole = rolesMap.get(emp.userId);
      return userRole && userRole.id === roleId;
    });
  }

  return filteredResult.map((emp) => ({
    id: emp.id,
    employeeId: emp.employeeId,
    userId: emp.userId,
    name: emp.fullName,
    role: emp.userId ? rolesMap.get(emp.userId)?.name || null : null,
    roleId: emp.userId ? rolesMap.get(emp.userId)?.id || null : null,
    positionId: emp.positionId,
    positionName: emp.positionName,
    status: emp.status || "available",
    isAvailable: emp.status === "available", // Boolean flag for availability
  }));
};

/**
 * Get all employees whose user has role "Executive" or "Manager".
 * Returns minimal data: id, userId, userName, employeeId, department, position, reportsToName, role, status, isActive, createdAt, updatedAt.
 */
export const getInspectors = async () => {
  const result = await db
    .select({
      id: employees.id,
      userId: users.id,
      userName: users.fullName,
      employeeId: employees.employeeId,
      departmentId: departments.id,
      departmentName: departments.name,
      positionId: positions.id,
      positionName: positions.name,
      reportsToName: reportsToUser.fullName,
      roleName: roles.name,
      status: employees.status,
      isActive: users.isActive,
      createdAt: employees.createdAt,
      updatedAt: employees.updatedAt,
    })
    .from(employees)
    .innerJoin(users, eq(employees.userId, users.id))
    .innerJoin(userRoles, eq(users.id, userRoles.userId))
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .leftJoin(positions, eq(employees.positionId, positions.id))
    .leftJoin(reportsToUser, eq(employees.reportsTo, reportsToUser.id))
    .where(
      and(
        eq(employees.isDeleted, false),
        eq(roles.isDeleted, false),
        inArray(roles.name, ["Executive", "Manager"]),
      ),
    )
    .orderBy(users.fullName);

  return result.map((row) => ({
    id: row.id,
    userId: row.userId,
    userName: row.userName,
    employeeId: row.employeeId,
    department: row.departmentId
      ? { id: row.departmentId, name: row.departmentName }
      : null,
    position: row.positionId
      ? { id: row.positionId, name: row.positionName }
      : null,
    reportsToName: row.reportsToName ?? null,
    role: row.roleName,
    status: row.status ?? null,
    isActive: row.isActive ?? null,
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
  }));
};

/**
 * Get all employees whose role is Technician.
 */
export const getTechnicians = async () => {
  const result = await db
    .select({
      id: employees.id,
      userId: users.id,
      userName: users.fullName,
      employeeId: employees.employeeId,
      departmentId: departments.id,
      departmentName: departments.name,
      positionId: positions.id,
      positionName: positions.name,
      reportsToName: reportsToUser.fullName,
      roleName: roles.name,
      status: employees.status,
      isActive: users.isActive,
      createdAt: employees.createdAt,
      updatedAt: employees.updatedAt,
    })
    .from(employees)
    .innerJoin(users, eq(employees.userId, users.id))
    .innerJoin(userRoles, eq(users.id, userRoles.userId))
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .leftJoin(positions, eq(employees.positionId, positions.id))
    .leftJoin(reportsToUser, eq(employees.reportsTo, reportsToUser.id))
    .where(
      and(
        eq(employees.isDeleted, false),
        eq(roles.isDeleted, false),
        eq(roles.name, "Technician"),
      ),
    )
    .orderBy(users.fullName);

  return result.map((row) => ({
    id: row.id,
    userId: row.userId,
    userName: row.userName,
    employeeId: row.employeeId,
    department: row.departmentId
      ? { id: row.departmentId, name: row.departmentName }
      : null,
    position: row.positionId
      ? { id: row.positionId, name: row.positionName }
      : null,
    reportsToName: row.reportsToName ?? null,
    role: row.roleName,
    status: row.status ?? null,
    isActive: row.isActive ?? null,
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
  }));
};

/**
 * Get all employees with role "Technician" who are not assigned to any vehicle (unassigned drivers).
 */
export const getUnassignedDrivers = async () => {
  const result = await db
    .select({
      id: employees.id,
      userId: users.id,
      userName: users.fullName,
      employeeId: employees.employeeId,
      departmentId: departments.id,
      departmentName: departments.name,
      positionId: positions.id,
      positionName: positions.name,
      reportsToName: reportsToUser.fullName,
      roleName: roles.name,
      status: employees.status,
      isActive: users.isActive,
      createdAt: employees.createdAt,
      updatedAt: employees.updatedAt,
    })
    .from(employees)
    .innerJoin(users, eq(employees.userId, users.id))
    .innerJoin(userRoles, eq(users.id, userRoles.userId))
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .leftJoin(positions, eq(employees.positionId, positions.id))
    .leftJoin(reportsToUser, eq(employees.reportsTo, reportsToUser.id))
    .leftJoin(
      vehicles,
      and(
        eq(vehicles.assignedToEmployeeId, employees.id),
        eq(vehicles.isDeleted, false),
      ),
    )
    .where(
      and(
        eq(employees.isDeleted, false),
        eq(roles.isDeleted, false),
        eq(roles.name, "Technician"),
        sql`${vehicles.id} IS NULL`,
      ),
    )
    .orderBy(users.fullName);

  return result.map((row) => ({
    id: row.id,
    userId: row.userId,
    userName: row.userName,
    employeeId: row.employeeId,
    department: row.departmentId
      ? { id: row.departmentId, name: row.departmentName }
      : null,
    position: row.positionId
      ? { id: row.positionId, name: row.positionName }
      : null,
    reportsToName: row.reportsToName ?? null,
    role: row.roleName,
    status: row.status ?? null,
    isActive: row.isActive ?? null,
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
  }));
};

/**
 * Get jobs and dispatch tasks assigned to an employee for a given date (date mandatory).
 * Returns unique jobs and list of dispatch tasks (with job details) for that date.
 */
export const getEmployeeJobsAndDispatchForDate = async (
  employeeId: number,
  date: string,
) => {
  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) {
    throw new Error("Invalid date format");
  }
  const startOfDay = new Date(dateObj);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(dateObj);
  endOfDay.setHours(23, 59, 59, 999);

  const rows = await db
    .select({
      dispatchTaskId: dispatchTasks.id,
      dispatchTitle: dispatchTasks.title,
      dispatchTaskType: dispatchTasks.taskType,
      dispatchPriority: dispatchTasks.priority,
      dispatchStatus: dispatchTasks.status,
      dispatchStartTime: dispatchTasks.startTime,
      dispatchEndTime: dispatchTasks.endTime,
      dispatchJobId: dispatchTasks.jobId,
      jobId: jobs.id,
      jobNumber: jobs.jobNumber,
      jobStatus: jobs.status,
      jobType: jobs.jobType,
      scheduledStartDate: jobs.scheduledStartDate,
      scheduledEndDate: jobs.scheduledEndDate,
      siteAddress: jobs.siteAddress,
    })
    .from(dispatchAssignments)
    .innerJoin(
      dispatchTasks,
      and(
        eq(dispatchAssignments.taskId, dispatchTasks.id),
        eq(dispatchTasks.isDeleted, false),
        lte(dispatchTasks.startTime, endOfDay),
        gte(dispatchTasks.endTime, startOfDay),
      ),
    )
    .innerJoin(jobs, eq(dispatchTasks.jobId, jobs.id))
    .where(
      and(
        eq(dispatchAssignments.technicianId, employeeId),
        eq(dispatchAssignments.isDeleted, false),
      ),
    )
    .orderBy(dispatchTasks.startTime);

  const jobMap = new Map<
    string,
    {
      id: string;
      jobNumber: string | null;
      status: string | null;
      jobType: string | null;
      scheduledStartDate: string | null;
      scheduledEndDate: string | null;
      siteAddress: string | null;
    }
  >();
  const dispatchTasksList: Array<{
    id: string;
    title: string | null;
    taskType: string | null;
    priority: string | null;
    status: string | null;
    startTime: Date | null;
    endTime: Date | null;
    jobId: string | null;
    jobDetails: {
      id: string;
      jobNumber: string | null;
      status: string | null;
      jobType: string | null;
      scheduledStartDate: string | null;
      scheduledEndDate: string | null;
      siteAddress: string | null;
    } | null;
  }> = [];

  for (const row of rows) {
    const jId = row.jobId;
    if (jId && !jobMap.has(jId)) {
      jobMap.set(jId, {
        id: jId,
        jobNumber: row.jobNumber ?? null,
        status: row.jobStatus ?? null,
        jobType: row.jobType ?? null,
        scheduledStartDate: row.scheduledStartDate ?? null,
        scheduledEndDate: row.scheduledEndDate ?? null,
        siteAddress: row.siteAddress ?? null,
      });
    }
    const jobDetails = jId ? (jobMap.get(jId) ?? null) : null;
    dispatchTasksList.push({
      id: row.dispatchTaskId,
      title: row.dispatchTitle ?? null,
      taskType: row.dispatchTaskType ?? null,
      priority: row.dispatchPriority ?? null,
      status: row.dispatchStatus ?? null,
      startTime: row.dispatchStartTime ?? null,
      endTime: row.dispatchEndTime ?? null,
      jobId: row.dispatchJobId ?? null,
      jobDetails,
    });
  }

  return {
    date,
    jobs: Array.from(jobMap.values()),
    dispatchTasks: dispatchTasksList,
  };
};

// ===========================================================================
// Bulk Delete
// ===========================================================================

export const bulkDeleteEmployees = async (ids: number[], deletedBy: string) => {
  const now = new Date();
  const result = await db
    .update(employees)
    .set({ isDeleted: true, deletedAt: now, deletedBy, updatedAt: now })
    .where(and(inArray(employees.id, ids), eq(employees.isDeleted, false)))
    .returning({ id: employees.id });
  return { deleted: result.length, skipped: ids.length - result.length };
};
