import { count, eq, desc, and, or, sql, ilike, inArray } from "drizzle-orm";
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

export const getEmployees = async (offset: number, limit: number) => {
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

      // Remove organization data - employees don't belong to client orgs
    })
    .from(employees)
    .leftJoin(users, eq(employees.userId, users.id))
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .leftJoin(positions, eq(employees.positionId, positions.id))
    // Remove organization join - employees are T3 internal staff
    .where(eq(employees.isDeleted, false))
    .limit(limit)
    .offset(offset);

  // Get total count for pagination
  const totalResult = await db
    .select({ count: count() })
    .from(employees)
    .where(eq(employees.isDeleted, false));

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
          emp.positionName.toLowerCase().includes("technician") ||
          emp.positionName.toLowerCase().includes("engineer")
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
    })
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
        roleNameLower.includes("technician") ||
        roleNameLower.includes("engineer")
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
            eq(userBankAccounts.isDeleted, false)
          )
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
    1
  );
  const endOfMonth = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth() + 1,
    0
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
    (t) => t.status === "approved"
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
          submission.details
        ).toLocaleDateString()}`;
      }

      allActivities.push(activity);
    });
  }

  // Add employee profile update activity (if recently updated)
  if (employee.updatedAt) {
    const daysSinceUpdate = Math.floor(
      (Date.now() - new Date(employee.updatedAt).getTime()) /
        (1000 * 60 * 60 * 24)
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
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
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
            (Date.now() - new Date(user.lastLogin).getTime()) / (1000 * 60 * 60)
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

export const generateEmployeeId = async (): Promise<string> => {
  try {
    // Use PostgreSQL sequence for atomic ID generation (thread-safe)
    const result = await db.execute<{ nextval: string }>(
      sql.raw(`SELECT nextval('org.employee_id_seq')::text as nextval`)
    );

    const nextNumber = parseInt(result.rows[0]?.nextval || "1");

    // Format: T3-0001 to T3-9999 (4 digits), then T3-10001 (5 digits), T3-100001 (6 digits), etc.
    // Dynamically calculate padding: minimum 4 digits, then use actual number of digits
    const numDigits = String(nextNumber).length;
    const padding = Math.max(4, numDigits);
    return `T3-${String(nextNumber).padStart(padding, "0")}`;
  } catch (error) {
    // Fallback to old method if sequence doesn't exist yet
    console.warn(
      "Employee ID sequence not found, using fallback method:",
      error
    );

    const totalResult = await db
      .select({ count: count() })
      .from(employees)
      .where(eq(employees.isDeleted, false));
    const total = totalResult[0]?.count ?? 0;
    const nextNumber = total + 1;

    // Format: T3-0001 to T3-9999 (4 digits), then T3-10001 (5 digits), T3-100001 (6 digits), etc.
    // Dynamically calculate padding: minimum 4 digits, then use actual number of digits
    const numDigits = String(nextNumber).length;
    const padding = Math.max(4, numDigits);
    return `T3-${String(nextNumber).padStart(padding, "0")}`;
  }
};

export const createEmployee = async (data: {
  userId: string;
  employeeId?: string;
  departmentId?: number;
  positionId?: number;
  reportsTo?: string;
  startDate?: Date;
}) => {
  // Auto-generate employeeId if not provided (T3 employees don't need organizationId)
  const employeeId = data.employeeId || (await generateEmployeeId());

  const [employee] = await db
    .insert(employees)
    .values({
      userId: data.userId,
      employeeId: employeeId,
      departmentId: data.departmentId || null,
      positionId: data.positionId || null,
      reportsTo: data.reportsTo || null,
      startDate: data.startDate || null,
    })
    .returning();
  return employee;
};

export const updateEmployee = async (
  id: number,
  data: {
    userId?: string;
    employeeId?: string;
    departmentId?: number;
    positionId?: number;
    reportsTo?: string;
    status?: "available" | "on_leave" | "in_field" | "terminated" | "suspended";
    startDate?: Date | null;
    endDate?: Date | null;
  }
) => {
  const updateData: {
    userId?: string;
    employeeId?: string | null;
    departmentId?: number | null;
    positionId?: number | null;
    reportsTo?: string | null;
    status?: "available" | "on_leave" | "in_field" | "terminated" | "suspended";
    startDate?: Date | null;
    endDate?: Date | null;
    updatedAt: Date;
  } = {
    updatedAt: new Date(),
  };

  if (data.userId !== undefined) {
    updateData.userId = data.userId;
  }
  if (data.employeeId !== undefined) {
    updateData.employeeId = data.employeeId || null;
  }
  if (data.departmentId !== undefined) {
    updateData.departmentId = data.departmentId || null;
  }
  if (data.positionId !== undefined) {
    updateData.positionId = data.positionId || null;
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

  const [employee] = await db
    .update(employees)
    .set(updateData)
    .where(eq(employees.id, id))
    .returning();
  return employee || null;
};

export const deleteEmployee = async (id: number) => {
  const [employee] = await db
    .delete(employees)
    .where(eq(employees.id, id))
    .returning();
  return employee || null;
};

export const getEmployeesSimple = async (
  search?: string,
  positionId?: number,
  roleId?: number
) => {
  let whereConditions = [eq(employees.isDeleted, false)];

  // Search filter
  if (search) {
    whereConditions.push(
      or(
        ilike(users.fullName, `%${search}%`),
        ilike(users.email, `%${search}%`),
        ilike(employees.employeeId, `%${search}%`)
      )!
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
            and(inArray(userRoles.userId, userIds), eq(roles.isDeleted, false))
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



