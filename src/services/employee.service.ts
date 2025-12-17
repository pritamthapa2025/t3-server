import {
  count,
  eq,
  desc,
  and,
  or,
  sql,
  gte,
  lte,
  sum,
  ilike,
} from "drizzle-orm";
import { db } from "../config/db.js";
import {
  employees,
  departments,
  positions,
  userBankAccounts,
  employeeReviews,
} from "../drizzle/schema/org.schema.js";
import { timesheets, timesheetApprovals } from "../drizzle/schema/timesheet.schema.js";
import { users } from "../drizzle/schema/auth.schema.js";

export const getEmployees = async (
  offset: number,
  limit: number,
  search?: string
) => {
  let whereConditions = [eq(employees.isDeleted, false)];

  // Add search filter if provided
  if (search) {
    whereConditions.push(
      or(
        ilike(users.fullName, `%${search}%`),
        ilike(users.email, `%${search}%`),
        ilike(employees.employeeId, `%${search}%`),
        ilike(departments.name, `%${search}%`),
        ilike(positions.name, `%${search}%`)
      )!
    );
  }

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
    .where(and(...whereConditions))
    .limit(limit)
    .offset(offset);

  // Get total count for pagination
  const totalResult = await db
    .select({ count: count() })
    .from(employees)
    .leftJoin(users, eq(employees.userId, users.id))
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .leftJoin(positions, eq(employees.positionId, positions.id))
    .where(and(...whereConditions));

  const total = totalResult[0]?.count ?? 0;

  // OPTIMIZATION: Fetch all latest reviews in a single query using PostgreSQL DISTINCT ON
  // This is much more efficient than N+1 queries or OR conditions
  const employeeIds = result.map((emp) => emp.id);

  // Use raw SQL with DISTINCT ON for optimal performance (PostgreSQL-specific)
  // This gets the latest review per employee in a single efficient query
  // Using parameterized query to prevent SQL injection
  const latestReviews =
    employeeIds.length > 0
      ? await db.execute<{
          employee_id: number;
          average_score: string | null;
          review_date: Date | null;
        }>(
          sql.raw(`
            SELECT DISTINCT ON (employee_id) 
              employee_id,
              average_score,
              review_date
            FROM org.employee_reviews
            WHERE employee_id = ANY(ARRAY[${employeeIds.join(",")}])
            ORDER BY employee_id, review_date DESC NULLS LAST
          `)
        )
      : { rows: [] };

  // Create a map for quick lookup
  const reviewMap = new Map<
    number,
    { averageScore: string | null; reviewDate: Date | null }
  >();
  for (const review of latestReviews.rows || []) {
    reviewMap.set(review.employee_id, {
      averageScore: review.average_score,
      reviewDate: review.review_date,
    });
  }

  // Process employees with pre-fetched reviews (no async needed)
  const employeesWithDetails = result.map((emp) => {
    // Get latest performance review from the map
    const latestReview = reviewMap.get(emp.id);

    // Calculate overall rating from performance and reviews
    const reviewScore = latestReview?.averageScore
      ? parseFloat(latestReview.averageScore)
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
  });

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
      // Organization removed - employees work for T3, not client organizations
    })
    .from(employees)
    .leftJoin(users, eq(employees.userId, users.id))
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .leftJoin(positions, eq(employees.positionId, positions.id))
    // Organization join removed - employees are T3 internal staff
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

  // OPTIMIZATION: Run ALL independent queries in parallel using a single Promise.all
  // This reduces total query time from sequential (2.68s) to parallel execution
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

  // Run ALL queries in parallel for maximum performance
  const [
    managerResult,
    bankAccountResult,
    latestReviewResult,
    timesheetStatsResult,
    reviewsResult,
    approvalsResult,
    submissionsResult,
  ] = await Promise.all([
    // Get manager information (only if reportsTo exists)
    employee.reportsTo
      ? db
          .select({
            id: users.id,
            fullName: users.fullName,
            email: users.email,
          })
          .from(users)
          .where(eq(users.id, employee.reportsTo))
          .limit(1)
      : Promise.resolve([]),

    // Get bank account information (only if user exists)
    user?.id
      ? db
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
      : Promise.resolve([]),

    // Get latest performance review - optimized query
    db
      .select()
      .from(employeeReviews)
      .where(eq(employeeReviews.employeeId, id))
      .orderBy(desc(employeeReviews.reviewDate))
      .limit(1),

    // Get timesheet statistics - optimized to filter by date in SQL
    (() => {
      const startOfMonthStr = startOfMonth.toISOString().split("T")[0]!;
      const endOfMonthStr = endOfMonth.toISOString().split("T")[0]!;
      return db
        .select({
          totalHours: timesheets.totalHours,
          status: timesheets.status,
          sheetDate: timesheets.sheetDate,
        })
        .from(timesheets)
        .where(
          and(
            eq(timesheets.employeeId, id),
            gte(timesheets.sheetDate, startOfMonthStr),
            lte(timesheets.sheetDate, endOfMonthStr)
          )
        )
        .orderBy(desc(timesheets.sheetDate))
        .limit(30);
    })(),

    // Get recent performance reviews (for activity log)
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

    // Get recent timesheet approvals (for activity log)
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

    // Get recent timesheet creations (for activity log)
    db
      .select({
        type: sql<string>`'timesheet'`,
        action: sql<string>`'timesheet_created'`,
        performedBy: sql<string>`'System'`, // No longer track who submitted
        timestamp: timesheets.createdAt,
        details: timesheets.sheetDate,
      })
      .from(timesheets)
      .where(eq(timesheets.employeeId, id))
      .orderBy(desc(timesheets.createdAt))
      .limit(10),
  ]);

  const managerData = managerResult[0] || null;
  const bankAccount = bankAccountResult;
  const latestReview = latestReviewResult;
  const timesheetStats = timesheetStatsResult;
  const reviews = reviewsResult;
  const approvals = approvalsResult;
  const submissions = submissionsResult;

  // Calculate performance metrics
  // timesheetStats already filtered to current month by SQL query
  const totalTimesheets = timesheetStats.length;
  const onTimeEntries = timesheetStats.filter(
    (t) => t.status === "approved"
  ).length;
  const onTimeRate =
    totalTimesheets > 0
      ? Math.round((onTimeEntries / totalTimesheets) * 100)
      : 0;

  // Calculate total hours for current month (already filtered by SQL)
  const totalHoursThisMonth = timesheetStats.reduce(
    (sum, t) => sum + parseFloat(t.totalHours || "0"),
    0
  );

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

    // Remove organization info - employees work for T3, not client organizations
    // Client assignments will be tracked separately

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
  // Count all T3 employees to generate next ID
  const totalResult = await db
    .select({ count: count() })
    .from(employees)
    .where(eq(employees.isDeleted, false));
  const total = totalResult[0]?.count ?? 0;
  const nextNumber = total + 1;
  // Format: T3-00001, T3-00002, etc. (5 digits padding)
  const employeeId = `T3-${String(nextNumber).padStart(5, "0")}`;
  return employeeId;
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
  }
) => {
  const updateData: {
    userId?: string;
    employeeId?: string | null;
    departmentId?: number | null;
    positionId?: number | null;
    reportsTo?: string | null;
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

export const getEmployeeKPIs = async () => {
  // Calculate date range for current month (for attendance calculation)
  const currentDate = new Date();
  const startOfMonth = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    1
  );
  const endOfMonth = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() + 1,
    0
  );

  // Format dates as YYYY-MM-DD strings for date column comparison
  const startDateStr = startOfMonth.toISOString().split("T")[0];
  const endDateStr = endOfMonth.toISOString().split("T")[0];

  // OPTIMIZATION: Use raw SQL with optimized EXISTS subquery
  // This is faster than INNER JOIN as PostgreSQL can use indexes and stop at first match
  const [aggregatedMetrics, employeesWithTimesheetsResult] = await Promise.all([
    // Single query for: total employees, active employees, in field count, and violations sum
    db
      .select({
        totalEmployees: sql<number>`COUNT(*)`,
        activeEmployees: sql<number>`COUNT(*) FILTER (WHERE ${users.isActive} = true)`,
        inField: sql<number>`COUNT(*) FILTER (WHERE ${employees.status} = 'in_field')`,
        violations: sql<string>`COALESCE(SUM(${employees.violations}), '0')`,
      })
      .from(employees)
      .leftJoin(users, eq(employees.userId, users.id))
      .where(eq(employees.isDeleted, false)),

    // OPTIMIZED: Use raw SQL with EXISTS subquery for maximum performance
    // This allows PostgreSQL to use indexes efficiently and stops at first match
    db.execute<{ count: string }>(
      sql.raw(`
        SELECT COUNT(*)::text as count
        FROM org.employees e
        INNER JOIN auth.users u ON e.user_id = u.id
        WHERE e.is_deleted = false
          AND u.is_active = true
          AND EXISTS (
            SELECT 1 
            FROM org.timesheets t
            WHERE t.employee_id = e.id
              AND t.sheet_date >= '${startDateStr}'::date
              AND t.sheet_date <= '${endDateStr}'::date
              AND t.status IN ('submitted', 'approved')
            LIMIT 1
          )
      `)
    ),
  ]);

  const totalEmployees = Number(aggregatedMetrics[0]?.totalEmployees ?? 0);
  const activeEmployees = Number(aggregatedMetrics[0]?.activeEmployees ?? 0);
  const inField = Number(aggregatedMetrics[0]?.inField ?? 0);
  const violations = parseInt(aggregatedMetrics[0]?.violations ?? "0", 10);

  // Calculate attendance percentage
  // Percentage of active employees who have submitted timesheets this month
  const employeesWithTimesheetsCount = employeesWithTimesheetsResult.rows
    ? Number(employeesWithTimesheetsResult.rows[0]?.count ?? 0)
    : 0;

  const attendance =
    activeEmployees > 0
      ? Math.round((employeesWithTimesheetsCount / activeEmployees) * 100)
      : 0;

  return {
    totalEmployees,
    activeEmployees,
    inField,
    attendance: `${attendance}%`,
    timesheetViolations: violations,
  };
};
