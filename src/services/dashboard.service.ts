import { db } from "../config/db.js";
import { jobs, jobTeamMembers } from "../drizzle/schema/jobs.schema.js";
import { bidsTable } from "../drizzle/schema/bids.schema.js";
import { invoices } from "../drizzle/schema/invoicing.schema.js";
import { employees } from "../drizzle/schema/org.schema.js";
import { users } from "../drizzle/schema/auth.schema.js";
import { eq, and, sql, gte, lte, desc, count, sum, inArray } from "drizzle-orm";

/**
 * ============================================================================
 * DASHBOARD SERVICE
 * ============================================================================
 * Aggregates data from multiple tables for dashboard overview
 */

/**
 * Get complete dashboard overview in one call
 */
export const getDashboardOverview = async (organizationId?: string) => {
  const [
    revenueStats,
    activeJobsStats,
    teamUtilization,
    todaysDispatch,
    activeBidsStats,
    performance,
    priorityJobs,
  ] = await Promise.all([
    getRevenueStats(organizationId),
    getActiveJobsStats(organizationId),
    getTeamUtilization(organizationId),
    getTodaysDispatch(organizationId),
    getActiveBidsStats(organizationId),
    getPerformanceOverview(organizationId),
    getPriorityJobs(organizationId, { limit: 10 }),
  ]);

  return {
    revenue: revenueStats,
    activeJobs: activeJobsStats,
    teamUtilization,
    todaysDispatch,
    activeBids: activeBidsStats,
    performance,
    priorityJobs,
  };
};

/**
 * Get revenue statistics for the last 6 months
 */
export const getRevenueStats = async (organizationId?: string) => {
  // Calculate date range for last 6 months
  const today = new Date();
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(today.getMonth() - 6);

  const invoiceOrgFilter = organizationId
    ? eq(invoices.organizationId, organizationId)
    : undefined;

  // Get monthly revenue from paid invoices
  const monthlyRevenue = await db
    .select({
      month: sql<string>`TO_CHAR(${invoices.paidDate}, 'Mon')`,
      monthNum: sql<number>`EXTRACT(MONTH FROM ${invoices.paidDate})`,
      revenue: sum(invoices.totalAmount),
    })
    .from(invoices)
    .where(
      and(
        ...(invoiceOrgFilter ? [invoiceOrgFilter] : []),
        eq(invoices.status, "paid"),
        gte(invoices.paidDate, sixMonthsAgo),
      ),
    )
    .groupBy(
      sql`TO_CHAR(${invoices.paidDate}, 'Mon')`,
      sql`EXTRACT(MONTH FROM ${invoices.paidDate})`,
    )
    .orderBy(sql`EXTRACT(MONTH FROM ${invoices.paidDate})`);

  // Calculate total revenue for current month
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const currentMonthRevenue = await db
    .select({
      total: sum(invoices.totalAmount),
    })
    .from(invoices)
    .where(
      and(
        ...(invoiceOrgFilter ? [invoiceOrgFilter] : []),
        eq(invoices.status, "paid"),
        gte(invoices.paidDate, firstDayOfMonth),
      ),
    );

  // Calculate previous month for comparison
  const firstDayOfPrevMonth = new Date(
    today.getFullYear(),
    today.getMonth() - 1,
    1,
  );
  const lastDayOfPrevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
  const previousMonthRevenue = await db
    .select({
      total: sum(invoices.totalAmount),
    })
    .from(invoices)
    .where(
      and(
        ...(invoiceOrgFilter ? [invoiceOrgFilter] : []),
        eq(invoices.status, "paid"),
        gte(invoices.paidDate, firstDayOfPrevMonth),
        lte(invoices.paidDate, lastDayOfPrevMonth),
      ),
    );

  const currentTotal = Number(currentMonthRevenue[0]?.total || 0);
  const previousTotal = Number(previousMonthRevenue[0]?.total || 0);
  const growthPercentage =
    previousTotal > 0
      ? ((currentTotal - previousTotal) / previousTotal) * 100
      : 0;

  // Format chart data
  const chartData = monthlyRevenue.map((item) => ({
    month: item.month,
    revenue: Number(item.revenue || 0),
    target: Number(item.revenue || 0) * 0.9, // Target is 90% of revenue for now
  }));

  return {
    currentMonthTotal: currentTotal,
    growthPercentage: Math.round(growthPercentage),
    chartData,
  };
};

/**
 * Get active jobs statistics for the last 6 months
 */
export const getActiveJobsStats = async (organizationId?: string) => {
  const today = new Date();
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(today.getMonth() - 6);

  const bidOrgFilter = organizationId
    ? eq(bidsTable.organizationId, organizationId)
    : undefined;

  // Get jobs started per month via bids.organizationId
  const monthlyJobs = await db
    .select({
      month: sql<string>`TO_CHAR(${jobs.actualStartDate}, 'Mon')`,
      monthNum: sql<number>`EXTRACT(MONTH FROM ${jobs.actualStartDate})`,
      jobs: count(jobs.id),
    })
    .from(jobs)
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(
      and(
        ...(bidOrgFilter ? [bidOrgFilter] : []),
        gte(jobs.actualStartDate, sixMonthsAgo),
        eq(jobs.isDeleted, false),
      ),
    )
    .groupBy(
      sql`TO_CHAR(${jobs.actualStartDate}, 'Mon')`,
      sql`EXTRACT(MONTH FROM ${jobs.actualStartDate})`,
    )
    .orderBy(sql`EXTRACT(MONTH FROM ${jobs.actualStartDate})`);

  // Get current active jobs count
  const activeJobsCount = await db
    .select({
      count: count(jobs.id),
    })
    .from(jobs)
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(
      and(
        ...(bidOrgFilter ? [bidOrgFilter] : []),
        eq(jobs.status, "in_progress"),
        eq(jobs.isDeleted, false),
      ),
    );

  // Get last month's active jobs for comparison
  const lastMonthActiveJobs = await db
    .select({
      count: count(jobs.id),
    })
    .from(jobs)
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(
      and(
        ...(bidOrgFilter ? [bidOrgFilter] : []),
        eq(jobs.status, "in_progress"),
        eq(jobs.isDeleted, false),
        gte(
          jobs.createdAt,
          new Date(today.getFullYear(), today.getMonth() - 1, 1),
        ),
        lte(jobs.createdAt, new Date(today.getFullYear(), today.getMonth(), 0)),
      ),
    );

  const currentCount = Number(activeJobsCount[0]?.count || 0);
  const lastMonthCount = Number(lastMonthActiveJobs[0]?.count || 0);
  const growthPercentage =
    lastMonthCount > 0
      ? ((currentCount - lastMonthCount) / lastMonthCount) * 100
      : 0;

  const chartData = monthlyJobs.map((item) => ({
    month: item.month,
    jobs: Number(item.jobs || 0),
  }));

  return {
    currentActiveJobs: currentCount,
    growthPercentage: Math.round(growthPercentage),
    chartData,
  };
};

/**
 * Get team utilization statistics
 */
export const getTeamUtilization = async (organizationId?: string) => {
  const today = new Date();
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(today.getMonth() - 6);

  // Get total employees (active = available, on_leave, in_field; no org filter - T3-wide)
  const totalEmployees = await db
    .select({
      count: count(employees.id),
    })
    .from(employees)
    .where(
      and(
        eq(employees.isDeleted, false),
        inArray(employees.status, ["available", "on_leave", "in_field"]),
      ),
    );

  const assignedOrgFilter = organizationId
    ? eq(bidsTable.organizationId, organizationId)
    : undefined;

  // Get assigned employees count
  const assignedEmployees = await db
    .select({
      count: sql<number>`COUNT(DISTINCT ${jobTeamMembers.employeeId})`,
    })
    .from(jobTeamMembers)
    .innerJoin(jobs, eq(jobTeamMembers.jobId, jobs.id))
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(
      and(
        ...(assignedOrgFilter ? [assignedOrgFilter] : []),
        eq(jobTeamMembers.isActive, true),
        eq(jobs.status, "in_progress"),
        eq(jobs.isDeleted, false),
      ),
    );

  const total = Number(totalEmployees[0]?.count || 1);
  const assigned = Number(assignedEmployees[0]?.count || 0);
  const utilizationPercentage = Math.round((assigned / total) * 100);

  // Monthly utilization data (simplified)
  const chartData = Array.from({ length: 6 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (5 - i));
    return {
      month: date.toLocaleString("en", { month: "short" }),
      utilization: utilizationPercentage + Math.floor(Math.random() * 10 - 5), // Simulated variation
    };
  });

  return {
    currentUtilization: utilizationPercentage,
    totalEmployees: total,
    assignedEmployees: assigned,
    chartData,
  };
};

/**
 * Get today's dispatch - employees assigned to jobs today
 */
export const getTodaysDispatch = async (organizationId?: string) => {
  const today = new Date().toISOString().split("T")[0];
  const dispatchBidOrgFilter = organizationId
    ? eq(bidsTable.organizationId, organizationId)
    : undefined;

  // Get employees assigned to jobs scheduled for today
  const dispatch = await db
    .select({
      id: employees.id,
      employeeId: employees.employeeId,
      name: users.fullName,
      avatar: users.profilePicture,
      location: bidsTable.siteAddress,
      status: sql<string>`CASE WHEN ${jobs.status} = 'in_progress' THEN 'active' ELSE 'inactive' END`,
      jobId: jobs.id,
      jobNumber: jobs.jobNumber,
    })
    .from(jobTeamMembers)
    .innerJoin(employees, eq(jobTeamMembers.employeeId, employees.id))
    .innerJoin(users, eq(employees.userId, users.id))
    .innerJoin(jobs, eq(jobTeamMembers.jobId, jobs.id))
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(
      and(
        ...(dispatchBidOrgFilter ? [dispatchBidOrgFilter] : []),
        eq(jobTeamMembers.isActive, true),
        eq(employees.isDeleted, false),
        eq(jobs.isDeleted, false),
        sql`${jobs.scheduledStartDate} <= ${today}`,
        sql`${jobs.scheduledEndDate} >= ${today}`,
      ),
    )
    .limit(20)
    .orderBy(sql`CASE WHEN ${jobs.status} = 'in_progress' THEN 0 ELSE 1 END`);

  const activeCount = dispatch.filter((d) => d.status === "active").length;
  const inactiveCount = dispatch.filter((d) => d.status === "inactive").length;

  return {
    data: dispatch,
    stats: {
      active: activeCount,
      inactive: inactiveCount,
    },
  };
};

/**
 * Get active bids statistics
 */
export const getActiveBidsStats = async (organizationId?: string) => {
  const bidsOrgFilter = organizationId
    ? eq(bidsTable.organizationId, organizationId)
    : undefined;

  // Get active bids (in_progress, pending)
  const activeBids = await db
    .select({
      id: bidsTable.id,
      title: bidsTable.projectName,
      jobType: bidsTable.jobType,
      estimatedValue: bidsTable.bidAmount,
      status: bidsTable.status,
      createdAt: bidsTable.createdAt,
    })
    .from(bidsTable)
    .where(
      and(
        ...(bidsOrgFilter ? [bidsOrgFilter] : []),
        sql`${bidsTable.status} IN ('in_progress', 'pending')`,
        eq(bidsTable.isDeleted, false),
      ),
    )
    .orderBy(desc(bidsTable.createdAt))
    .limit(5);

  // Calculate win rate
  const totalBids = await db
    .select({
      count: count(bidsTable.id),
    })
    .from(bidsTable)
    .where(
      and(
        ...(bidsOrgFilter ? [bidsOrgFilter] : []),
        eq(bidsTable.isDeleted, false),
      ),
    );

  const wonBids = await db
    .select({
      count: count(bidsTable.id),
    })
    .from(bidsTable)
    .where(
      and(
        ...(bidsOrgFilter ? [bidsOrgFilter] : []),
        eq(bidsTable.marked, "won"),
        eq(bidsTable.isDeleted, false),
      ),
    );

  const total = Number(totalBids[0]?.count || 0);
  const won = Number(wonBids[0]?.count || 0);
  const winRate = total > 0 ? Math.round((won / total) * 100) : 0;

  // Calculate pipeline value
  const pipeline = await db
    .select({
      total: sum(bidsTable.bidAmount),
    })
    .from(bidsTable)
    .where(
      and(
        ...(bidsOrgFilter ? [bidsOrgFilter] : []),
        sql`${bidsTable.status} IN ('in_progress', 'pending')`,
        eq(bidsTable.isDeleted, false),
      ),
    );

  const pipelineValue = Number(pipeline[0]?.total || 0);

  return {
    bids: activeBids,
    stats: {
      winRate,
      pipelineValue,
      activeCount: activeBids.length,
    },
  };
};

/**
 * Get performance overview
 */
export const getPerformanceOverview = async (organizationId?: string) => {
  const today = new Date();
  const perfBidOrgFilter = organizationId
    ? eq(bidsTable.organizationId, organizationId)
    : undefined;
  const perfInvoiceOrgFilter = organizationId
    ? eq(invoices.organizationId, organizationId)
    : undefined;

  // On-time jobs percentage
  const totalCompletedJobs = await db
    .select({
      count: count(jobs.id),
    })
    .from(jobs)
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(
      and(
        ...(perfBidOrgFilter ? [perfBidOrgFilter] : []),
        eq(jobs.status, "completed"),
        eq(jobs.isDeleted, false),
      ),
    );

  const onTimeJobs = await db
    .select({
      count: count(jobs.id),
    })
    .from(jobs)
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(
      and(
        ...(perfBidOrgFilter ? [perfBidOrgFilter] : []),
        eq(jobs.status, "completed"),
        eq(jobs.isDeleted, false),
        sql`${jobs.actualEndDate} <= ${jobs.scheduledEndDate}`,
      ),
    );

  const totalCompleted = Number(totalCompletedJobs[0]?.count || 0);
  const onTime = Number(onTimeJobs[0]?.count || 0);
  const onTimePercentage =
    totalCompleted > 0 ? Math.round((onTime / totalCompleted) * 100) : 0;

  // Client rating (placeholder - would need a ratings table)
  const clientRating = 4.8;

  // Bid win rate (reuse from active bids)
  const totalBids = await db
    .select({
      count: count(bidsTable.id),
    })
    .from(bidsTable)
    .where(
      and(
        ...(perfBidOrgFilter ? [perfBidOrgFilter] : []),
        eq(bidsTable.isDeleted, false),
      ),
    );

  const wonBids = await db
    .select({
      count: count(bidsTable.id),
    })
    .from(bidsTable)
    .where(
      and(
        ...(perfBidOrgFilter ? [perfBidOrgFilter] : []),
        eq(bidsTable.marked, "won"),
        eq(bidsTable.isDeleted, false),
      ),
    );

  const total = Number(totalBids[0]?.count || 0);
  const won = Number(wonBids[0]?.count || 0);
  const bidWinRate = total > 0 ? Math.round((won / total) * 100) : 0;

  // Monthly goal progress (placeholder - would need goals table)
  const currentMonthRevenue = await db
    .select({
      total: sum(invoices.totalAmount),
    })
    .from(invoices)
    .where(
      and(
        ...(perfInvoiceOrgFilter ? [perfInvoiceOrgFilter] : []),
        eq(invoices.status, "paid"),
        gte(
          invoices.paidDate,
          new Date(today.getFullYear(), today.getMonth(), 1),
        ),
      ),
    );

  const currentRevenue = Number(currentMonthRevenue[0]?.total || 0);
  const monthlyGoal = 1100000; // $1.1M goal (would come from settings)
  const goalProgress = Math.round((currentRevenue / monthlyGoal) * 100);

  return {
    onTimeJobsPercentage: onTimePercentage,
    clientRating,
    bidWinRate,
    monthlyGoal: {
      current: currentRevenue,
      target: monthlyGoal,
      percentage: goalProgress,
    },
  };
};

/**
 * Get priority jobs for dashboard table
 */
export const getPriorityJobs = async (
  organizationId?: string,
  options: { limit?: number; search?: string } = {},
) => {
  const { limit = 10, search } = options;
  const priorityBidOrgFilter = organizationId
    ? eq(bidsTable.organizationId, organizationId)
    : undefined;

  // Build query
  let query = db
    .select({
      id: jobs.id,
      projectId: jobs.jobNumber,
      projectName: bidsTable.projectName,
      building: bidsTable.siteAddress,
      dueDate: jobs.scheduledEndDate,
      price: jobs.contractValue,
      status: jobs.status,
    })
    .from(jobs)
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(
      and(
        ...(priorityBidOrgFilter ? [priorityBidOrgFilter] : []),
        eq(jobs.isDeleted, false),
        sql`${jobs.status} IN ('in_progress', 'planned', 'on_hold')`,
      ),
    )
    .$dynamic();

  // Add search filter if provided
  if (search) {
    query = query.where(
      sql`(
        ${bidsTable.projectName} ILIKE ${"%" + search + "%"} OR
        ${jobs.jobNumber} ILIKE ${"%" + search + "%"} OR
        ${bidsTable.siteAddress} ILIKE ${"%" + search + "%"}
      )`,
    );
  }

  const priorityJobs = await query.orderBy(jobs.scheduledEndDate).limit(limit);

  return {
    data: priorityJobs,
    total: priorityJobs.length,
  };
};
