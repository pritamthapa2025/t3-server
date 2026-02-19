import { db } from "../config/db.js";
import { jobs, jobTeamMembers } from "../drizzle/schema/jobs.schema.js";
import { dispatchTasks } from "../drizzle/schema/dispatch.schema.js";
import { bidsTable } from "../drizzle/schema/bids.schema.js";
import { invoices } from "../drizzle/schema/invoicing.schema.js";
import { employees, revenueTargets } from "../drizzle/schema/org.schema.js";
import { users } from "../drizzle/schema/auth.schema.js";
import { alias } from "drizzle-orm/pg-core";
import { eq, and, sql, gte, lte, desc, count, sum, inArray } from "drizzle-orm";

/** Optional date range filter (YYYY-MM-DD), same pattern as reports API */
export type DateRangeFilter = { startDate: string; endDate: string };

/**
 * ============================================================================
 * DASHBOARD SERVICE
 * ============================================================================
 * Aggregates data from multiple tables for dashboard overview
 */

/**
 * Get complete dashboard overview in one call
 */
export const getDashboardOverview = async (
  organizationId?: string,
  dateRange?: DateRangeFilter,
) => {
  const [
    revenueStats,
    activeJobsStats,
    teamUtilization,
    todaysDispatch,
    activeBidsStats,
    performance,
    priorityJobs,
  ] = await Promise.all([
    getRevenueStats(organizationId, dateRange),
    getActiveJobsStats(organizationId, dateRange),
    getTeamUtilization(organizationId, dateRange),
    getTodaysDispatch(organizationId, dateRange),
    getActiveBidsStats(organizationId, dateRange),
    getPerformanceOverview(organizationId, dateRange),
    getPriorityJobs(organizationId, { limit: 10 }, dateRange),
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

/** Invoice statuses that count as revenue (invoiced; excludes cancelled/void) */
const REVENUE_INVOICE_STATUSES = [
  "draft",
  "pending",
  "sent",
  "viewed",
  "partial",
  "paid",
  "overdue",
] as const;

/**
 * Get revenue statistics for the last 6 months (or for date range when provided).
 * Revenue = invoiced amount by invoice date (all non-cancelled/void invoices), scoped by org via job → bid.
 */
export const getRevenueStats = async (
  organizationId?: string,
  dateRange?: DateRangeFilter,
) => {
  const today = new Date();
  const rangeStart = dateRange
    ? new Date(dateRange.startDate + "T00:00:00.000")
    : (() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 6);
        d.setHours(0, 0, 0, 0);
        return d;
      })();
  const rangeEnd = dateRange
    ? new Date(dateRange.endDate + "T23:59:59.999")
    : (() => {
        const d = new Date(today);
        d.setHours(23, 59, 59, 999);
        return d;
      })();

  let invoiceJobIdFilter: ReturnType<typeof inArray> | undefined;
  if (organizationId) {
    const jobIdsResult = await db
      .select({ id: jobs.id })
      .from(jobs)
      .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
      .where(eq(bidsTable.organizationId, organizationId));
    const jobIds = jobIdsResult.map((r) => r.id);
    if (jobIds.length === 0) {
      const currentMonthNum = rangeEnd.getMonth() + 1;
      const currentYear = rangeEnd.getFullYear();
      const [targetRow] = await db
        .select({ targetAmount: revenueTargets.targetAmount })
        .from(revenueTargets)
        .where(
          and(
            eq(revenueTargets.isDeleted, false),
            eq(revenueTargets.month, currentMonthNum),
            eq(revenueTargets.year, currentYear),
          ),
        )
        .limit(1);
      return {
        currentMonthTotal: 0,
        currentMonthTarget: targetRow ? Number(targetRow.targetAmount) : 0,
        total: 0,
        growthPercentage: 0,
        chartData: [],
      };
    }
    invoiceJobIdFilter = inArray(invoices.jobId, jobIds);
  }

  const invoiceWhereBase = and(
    ...(invoiceJobIdFilter ? [invoiceJobIdFilter] : []),
    inArray(invoices.status, [...REVENUE_INVOICE_STATUSES]),
    eq(invoices.isDeleted, false),
    gte(invoices.invoiceDate, rangeStart),
    lte(invoices.invoiceDate, rangeEnd),
  );

  // Get monthly revenue by invoice date, including year so we can match targets
  const monthlyRevenue = await db
    .select({
      month: sql<string>`TO_CHAR(${invoices.invoiceDate}, 'Mon')`,
      monthNum: sql<number>`EXTRACT(MONTH FROM ${invoices.invoiceDate})`,
      year: sql<number>`EXTRACT(YEAR FROM ${invoices.invoiceDate})`,
      revenue: sum(invoices.totalAmount),
    })
    .from(invoices)
    .where(invoiceWhereBase)
    .groupBy(
      sql`TO_CHAR(${invoices.invoiceDate}, 'Mon')`,
      sql`EXTRACT(MONTH FROM ${invoices.invoiceDate})`,
      sql`EXTRACT(YEAR FROM ${invoices.invoiceDate})`,
    )
    .orderBy(
      sql`EXTRACT(YEAR FROM ${invoices.invoiceDate})`,
      sql`EXTRACT(MONTH FROM ${invoices.invoiceDate})`,
    );

  // "Current" month = last month in range (rangeEnd's month); previous = month before
  const currentMonthNum = rangeEnd.getMonth() + 1; // JS months are 0-indexed
  const currentYear = rangeEnd.getFullYear();

  const firstDayOfCurrentMonth = new Date(currentYear, rangeEnd.getMonth(), 1);
  const lastDayOfCurrentMonth = new Date(
    currentYear,
    rangeEnd.getMonth() + 1,
    0,
    23, 59, 59, 999,
  );
  const firstDayOfPrevMonth = new Date(currentYear, rangeEnd.getMonth() - 1, 1);
  const lastDayOfPrevMonth = new Date(
    currentYear,
    rangeEnd.getMonth(),
    0,
    23, 59, 59, 999,
  );

  const [currentMonthRevenue, previousMonthRevenue] = await Promise.all([
    db
      .select({ total: sum(invoices.totalAmount) })
      .from(invoices)
      .where(
        and(
          ...(invoiceJobIdFilter ? [invoiceJobIdFilter] : []),
          inArray(invoices.status, [...REVENUE_INVOICE_STATUSES]),
          eq(invoices.isDeleted, false),
          gte(invoices.invoiceDate, firstDayOfCurrentMonth),
          lte(invoices.invoiceDate, lastDayOfCurrentMonth),
        ),
      ),
    db
      .select({ total: sum(invoices.totalAmount) })
      .from(invoices)
      .where(
        and(
          ...(invoiceJobIdFilter ? [invoiceJobIdFilter] : []),
          inArray(invoices.status, [...REVENUE_INVOICE_STATUSES]),
          eq(invoices.isDeleted, false),
          gte(invoices.invoiceDate, firstDayOfPrevMonth),
          lte(invoices.invoiceDate, lastDayOfPrevMonth),
        ),
      ),
  ]);

  // Fetch revenue targets for all years covered by the queried range
  const startYear = rangeStart.getFullYear();
  const endYear = currentYear;
  const targetRows = await db
    .select({
      month: revenueTargets.month,
      year: revenueTargets.year,
      targetAmount: revenueTargets.targetAmount,
    })
    .from(revenueTargets)
    .where(
      and(
        eq(revenueTargets.isDeleted, false),
        gte(revenueTargets.year, startYear),
        lte(revenueTargets.year, endYear),
      ),
    );

  // Build a quick lookup: "YYYY-M" → targetAmount
  const targetMap = new Map<string, number>(
    targetRows.map((t) => [`${t.year}-${t.month}`, Number(t.targetAmount)]),
  );

  const currentTotal = Number(currentMonthRevenue[0]?.total || 0);
  const previousTotal = Number(previousMonthRevenue[0]?.total || 0);
  const growthPercentage =
    previousTotal > 0
      ? ((currentTotal - previousTotal) / previousTotal) * 100
      : 0;

  const chartData = monthlyRevenue.map((item) => ({
    month: item.month,
    year: item.year,
    revenue: Number(item.revenue || 0),
    target: targetMap.get(`${item.year}-${item.monthNum}`) ?? 0,
  }));

  const total = chartData.reduce((acc, d) => acc + d.revenue, 0);

  // Current-month target (used by the summary card)
  const currentMonthTarget = targetMap.get(`${currentYear}-${currentMonthNum}`) ?? 0;

  return {
    currentMonthTotal: currentTotal,
    currentMonthTarget,
    total,
    growthPercentage: Math.round(growthPercentage),
    chartData,
  };
};

/**
 * Get active jobs statistics for the last 6 months (or for date range when provided).
 * When assignedToEmployeeId is set (e.g. Technician), only jobs assigned to that employee are counted.
 */
export const getActiveJobsStats = async (
  organizationId?: string,
  dateRange?: DateRangeFilter,
  options?: { assignedToEmployeeId?: number },
) => {
  const today = new Date();
  const rangeStart = dateRange
    ? new Date(dateRange.startDate)
    : (() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 6);
        return d;
      })();
  const rangeEnd = dateRange ? new Date(dateRange.endDate) : today;

  const bidOrgFilter = organizationId
    ? eq(bidsTable.organizationId, organizationId)
    : undefined;

  const dateFilter = and(
    gte(jobs.actualStartDate, rangeStart),
    lte(jobs.actualStartDate, rangeEnd),
  );

  const assignedToEmployeeId = options?.assignedToEmployeeId;

  const baseJobWhere = and(
    ...(bidOrgFilter ? [bidOrgFilter] : []),
    eq(jobs.isDeleted, false),
  );

  let monthlyJobsQuery = db
    .select({
      month: sql<string>`TO_CHAR(${jobs.actualStartDate}, 'Mon')`,
      monthNum: sql<number>`EXTRACT(MONTH FROM ${jobs.actualStartDate})`,
      jobs: count(jobs.id),
    })
    .from(jobs)
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(and(baseJobWhere, dateFilter))
    .groupBy(
      sql`TO_CHAR(${jobs.actualStartDate}, 'Mon')`,
      sql`EXTRACT(MONTH FROM ${jobs.actualStartDate})`,
    )
    .orderBy(sql`EXTRACT(MONTH FROM ${jobs.actualStartDate})`);

  if (assignedToEmployeeId != null) {
    monthlyJobsQuery = monthlyJobsQuery.innerJoin(
      jobTeamMembers,
      and(
        eq(jobTeamMembers.jobId, jobs.id),
        eq(jobTeamMembers.employeeId, assignedToEmployeeId),
        eq(jobTeamMembers.isActive, true),
      ),
    ) as typeof monthlyJobsQuery;
  }

  const monthlyJobs = await monthlyJobsQuery;

  let activeCountQuery = db
    .select({ count: count(jobs.id) })
    .from(jobs)
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(and(baseJobWhere, eq(jobs.status, "in_progress")));

  if (assignedToEmployeeId != null) {
    activeCountQuery = activeCountQuery.innerJoin(
      jobTeamMembers,
      and(
        eq(jobTeamMembers.jobId, jobs.id),
        eq(jobTeamMembers.employeeId, assignedToEmployeeId),
        eq(jobTeamMembers.isActive, true),
      ),
    ) as typeof activeCountQuery;
  }

  const activeJobsCount = await activeCountQuery;

  const firstDayOfPrevMonth = new Date(
    rangeEnd.getFullYear(),
    rangeEnd.getMonth() - 1,
    1,
  );
  const lastDayOfPrevMonth = new Date(
    rangeEnd.getFullYear(),
    rangeEnd.getMonth(),
    0,
  );

  let lastMonthQuery = db
    .select({ count: count(jobs.id) })
    .from(jobs)
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(
      and(
        baseJobWhere,
        eq(jobs.status, "in_progress"),
        gte(jobs.createdAt, firstDayOfPrevMonth),
        lte(jobs.createdAt, lastDayOfPrevMonth),
      ),
    );

  if (assignedToEmployeeId != null) {
    lastMonthQuery = lastMonthQuery.innerJoin(
      jobTeamMembers,
      and(
        eq(jobTeamMembers.jobId, jobs.id),
        eq(jobTeamMembers.employeeId, assignedToEmployeeId),
        eq(jobTeamMembers.isActive, true),
      ),
    ) as typeof lastMonthQuery;
  }

  const lastMonthActiveJobs = await lastMonthQuery;

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
 * Get team utilization statistics (optionally scoped to date range)
 */
export const getTeamUtilization = async (
  organizationId?: string,
  dateRange?: DateRangeFilter,
) => {
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

  const jobDateFilter = dateRange
    ? and(
        sql`${jobs.scheduledStartDate} <= ${dateRange.endDate}`,
        sql`${jobs.scheduledEndDate} >= ${dateRange.startDate}`,
      )
    : undefined;

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
        ...(jobDateFilter ? [jobDateFilter] : []),
        eq(jobTeamMembers.isActive, true),
        eq(jobs.status, "in_progress"),
        eq(jobs.isDeleted, false),
      ),
    );

  const total = Number(totalEmployees[0]?.count || 1);
  const assigned = Number(assignedEmployees[0]?.count || 0);
  const utilizationPercentage = Math.round((assigned / total) * 100);

  const chartData = Array.from({ length: 6 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (5 - i));
    return {
      month: date.toLocaleString("en", { month: "short" }),
      utilization: utilizationPercentage,
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
 * Get today's dispatch - employees assigned to jobs for today (or for startDate when date range provided)
 */
export const getTodaysDispatch = async (
  organizationId?: string,
  dateRange?: DateRangeFilter,
) => {
  const today = new Date().toISOString().split("T")[0]!;
  const dispatchDate = dateRange ? dateRange.startDate : today;

  const dispatchBidOrgFilter = organizationId
    ? eq(bidsTable.organizationId, organizationId)
    : undefined;

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
      dispatchDate: sql<string>`(${dispatchTasks.startTime})::date`,
    })
    .from(jobTeamMembers)
    .innerJoin(employees, eq(jobTeamMembers.employeeId, employees.id))
    .innerJoin(users, eq(employees.userId, users.id))
    .innerJoin(jobs, eq(jobTeamMembers.jobId, jobs.id))
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .innerJoin(
      dispatchTasks,
      and(
        eq(dispatchTasks.jobId, jobs.id),
        eq(dispatchTasks.isDeleted, false),
        sql`(${dispatchTasks.startTime})::date = ${dispatchDate}::date`,
      ),
    )
    .where(
      and(
        ...(dispatchBidOrgFilter ? [dispatchBidOrgFilter] : []),
        eq(jobTeamMembers.isActive, true),
        eq(employees.isDeleted, false),
        eq(jobs.isDeleted, false),
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
 * Get active bids statistics (optionally filter by createdAt in date range)
 */
export const getActiveBidsStats = async (
  organizationId?: string,
  dateRange?: DateRangeFilter,
) => {
  const bidsOrgFilter = organizationId
    ? eq(bidsTable.organizationId, organizationId)
    : undefined;

  const createdAtFilter = dateRange
    ? and(
        gte(bidsTable.createdAt, new Date(dateRange.startDate)),
        lte(bidsTable.createdAt, new Date(dateRange.endDate)),
      )
    : undefined;

  const baseWhere = and(
    ...(bidsOrgFilter ? [bidsOrgFilter] : []),
    ...(createdAtFilter ? [createdAtFilter] : []),
    eq(bidsTable.isDeleted, false),
  );

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
      and(baseWhere, sql`${bidsTable.status} IN ('in_progress', 'submitted')`),
    )
    .orderBy(desc(bidsTable.createdAt))
    .limit(5);

  const totalBids = await db
    .select({
      count: count(bidsTable.id),
    })
    .from(bidsTable)
    .where(baseWhere);

  const wonBids = await db
    .select({
      count: count(bidsTable.id),
    })
    .from(bidsTable)
    .where(and(baseWhere, eq(bidsTable.marked, "won")));

  const total = Number(totalBids[0]?.count || 0);
  const won = Number(wonBids[0]?.count || 0);
  const winRate = total > 0 ? Math.round((won / total) * 100) : 0;

  const pipeline = await db
    .select({
      total: sum(bidsTable.bidAmount),
    })
    .from(bidsTable)
    .where(
      and(baseWhere, sql`${bidsTable.status} IN ('in_progress', 'submitted')`),
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
 * Get performance overview (optionally scoped to date range)
 * Invoices are scoped by organization via job → bid (invoices table has no organizationId).
 */
export const getPerformanceOverview = async (
  organizationId?: string,
  dateRange?: DateRangeFilter,
) => {
  const today = new Date();
  const rangeEnd = dateRange ? new Date(dateRange.endDate) : today;
  const perfBidOrgFilter = organizationId
    ? eq(bidsTable.organizationId, organizationId)
    : undefined;

  let invoiceJobIdFilter:
    | ReturnType<typeof inArray>
    | ReturnType<typeof sql>
    | undefined;
  if (organizationId) {
    const jobIdsResult = await db
      .select({ id: jobs.id })
      .from(jobs)
      .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
      .where(eq(bidsTable.organizationId, organizationId));
    const jobIds = jobIdsResult.map((r) => r.id);
    invoiceJobIdFilter =
      jobIds.length > 0 ? inArray(invoices.jobId, jobIds) : sql`false`;
  }

  const completedJobDateFilter = dateRange
    ? and(
        gte(jobs.actualEndDate, new Date(dateRange.startDate)),
        lte(jobs.actualEndDate, new Date(dateRange.endDate)),
      )
    : undefined;

  const totalCompletedJobs = await db
    .select({ count: count(jobs.id) })
    .from(jobs)
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(
      and(
        ...(perfBidOrgFilter ? [perfBidOrgFilter] : []),
        ...(completedJobDateFilter ? [completedJobDateFilter] : []),
        eq(jobs.status, "completed"),
        eq(jobs.isDeleted, false),
      ),
    );

  const onTimeJobs = await db
    .select({ count: count(jobs.id) })
    .from(jobs)
    .innerJoin(bidsTable, eq(jobs.bidId, bidsTable.id))
    .where(
      and(
        ...(perfBidOrgFilter ? [perfBidOrgFilter] : []),
        ...(completedJobDateFilter ? [completedJobDateFilter] : []),
        eq(jobs.status, "completed"),
        eq(jobs.isDeleted, false),
        sql`${jobs.actualEndDate} <= ${jobs.scheduledEndDate}`,
      ),
    );

  const totalCompleted = Number(totalCompletedJobs[0]?.count || 0);
  const onTime = Number(onTimeJobs[0]?.count || 0);
  const onTimePercentage =
    totalCompleted > 0 ? Math.round((onTime / totalCompleted) * 100) : 0;

  const clientRating: number | null = null;

  const bidDateFilter = dateRange
    ? and(
        gte(bidsTable.createdAt, new Date(dateRange.startDate)),
        lte(bidsTable.createdAt, new Date(dateRange.endDate)),
      )
    : undefined;

  const totalBids = await db
    .select({ count: count(bidsTable.id) })
    .from(bidsTable)
    .where(
      and(
        ...(perfBidOrgFilter ? [perfBidOrgFilter] : []),
        ...(bidDateFilter ? [bidDateFilter] : []),
        eq(bidsTable.isDeleted, false),
      ),
    );

  const wonBids = await db
    .select({ count: count(bidsTable.id) })
    .from(bidsTable)
    .where(
      and(
        ...(perfBidOrgFilter ? [perfBidOrgFilter] : []),
        ...(bidDateFilter ? [bidDateFilter] : []),
        eq(bidsTable.marked, "won"),
        eq(bidsTable.isDeleted, false),
      ),
    );

  const total = Number(totalBids[0]?.count || 0);
  const won = Number(wonBids[0]?.count || 0);
  const bidWinRate = total > 0 ? Math.round((won / total) * 100) : 0;

  const firstDayOfMonth = new Date(
    rangeEnd.getFullYear(),
    rangeEnd.getMonth(),
    1,
  );
  const currentMonthRevenue = await db
    .select({ total: sum(invoices.totalAmount) })
    .from(invoices)
    .where(
      and(
        ...(invoiceJobIdFilter ? [invoiceJobIdFilter] : []),
        eq(invoices.isDeleted, false),
        eq(invoices.status, "paid"),
        gte(invoices.paidDate, firstDayOfMonth),
      ),
    );

  const currentRevenue = Number(currentMonthRevenue[0]?.total || 0);

  const currentMonthNum = rangeEnd.getMonth() + 1;
  const currentYear = rangeEnd.getFullYear();
  const [targetRow] = await db
    .select({ targetAmount: revenueTargets.targetAmount })
    .from(revenueTargets)
    .where(
      and(
        eq(revenueTargets.isDeleted, false),
        eq(revenueTargets.month, currentMonthNum),
        eq(revenueTargets.year, currentYear),
      ),
    )
    .limit(1);

  const monthlyGoalTarget = targetRow ? Number(targetRow.targetAmount) : 0;
  const goalProgress =
    monthlyGoalTarget > 0
      ? Math.round((currentRevenue / monthlyGoalTarget) * 100)
      : 0;

  return {
    onTimeJobsPercentage: onTimePercentage,
    clientRating,
    bidWinRate,
    monthlyGoal: {
      current: currentRevenue,
      target: monthlyGoalTarget,
      percentage: goalProgress,
    },
  };
};

/**
 * Get priority jobs for dashboard table (optionally filter by due date in range).
 * When assignedToEmployeeId is set (e.g. Technician), only jobs assigned to that employee are returned.
 */
export const getPriorityJobs = async (
  organizationId?: string,
  options: { limit?: number; search?: string; assignedToEmployeeId?: number } = {},
  dateRange?: DateRangeFilter,
) => {
  const { limit = 10, search, assignedToEmployeeId } = options;
  const priorityBidOrgFilter = organizationId
    ? eq(bidsTable.organizationId, organizationId)
    : undefined;

  const dueDateFilter = dateRange
    ? and(
        gte(jobs.scheduledEndDate, dateRange.startDate),
        lte(jobs.scheduledEndDate, dateRange.endDate),
      )
    : undefined;

  const baseWhere = and(
    ...(priorityBidOrgFilter ? [priorityBidOrgFilter] : []),
    ...(dueDateFilter ? [dueDateFilter] : []),
    eq(jobs.isDeleted, false),
    sql`${jobs.status} IN ('in_progress', 'planned', 'on_hold')`,
  );

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
    .where(baseWhere)
    .$dynamic();

  if (assignedToEmployeeId != null) {
    query = query.innerJoin(
      jobTeamMembers,
      and(
        eq(jobTeamMembers.jobId, jobs.id),
        eq(jobTeamMembers.employeeId, assignedToEmployeeId),
        eq(jobTeamMembers.isActive, true),
      ),
    ) as typeof query;
  }

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

// ─── Revenue Target Aliases ───────────────────────────────────────────────────
const createdByUser = alias(users, "rt_created_by_user");
const updatedByUser = alias(users, "rt_updated_by_user");

// ─── Revenue Target Service ───────────────────────────────────────────────────

export type CreateRevenueTargetInput = {
  month: number;
  year: number;
  targetAmount: number;
  label?: string;
  notes?: string;
  createdBy?: string | undefined;
};

export type UpdateRevenueTargetInput = {
  month?: number;
  year?: number;
  targetAmount?: number;
  label?: string;
  notes?: string;
  updatedBy?: string | undefined;
};

const revenueTargetSelect = {
  id: revenueTargets.id,
  month: revenueTargets.month,
  year: revenueTargets.year,
  targetAmount: revenueTargets.targetAmount,
  label: revenueTargets.label,
  notes: revenueTargets.notes,
  createdBy: revenueTargets.createdBy,
  createdByName: createdByUser.fullName,
  updatedBy: revenueTargets.updatedBy,
  updatedByName: updatedByUser.fullName,
  isDeleted: revenueTargets.isDeleted,
  createdAt: revenueTargets.createdAt,
  updatedAt: revenueTargets.updatedAt,
};

export const getRevenueTargetById = async (id: string) => {
  const [row] = await db
    .select(revenueTargetSelect)
    .from(revenueTargets)
    .leftJoin(createdByUser, eq(revenueTargets.createdBy, createdByUser.id))
    .leftJoin(updatedByUser, eq(revenueTargets.updatedBy, updatedByUser.id))
    .where(and(eq(revenueTargets.id, id), eq(revenueTargets.isDeleted, false)));

  if (!row) return null;

  const { createdByName, updatedByName, ...rest } = row;
  return { ...rest, createdByName: createdByName ?? null, updatedByName: updatedByName ?? null };
};

export const listRevenueTargets = async (year?: number) => {
  const rows = await db
    .select(revenueTargetSelect)
    .from(revenueTargets)
    .leftJoin(createdByUser, eq(revenueTargets.createdBy, createdByUser.id))
    .leftJoin(updatedByUser, eq(revenueTargets.updatedBy, updatedByUser.id))
    .where(
      and(
        eq(revenueTargets.isDeleted, false),
        ...(year ? [eq(revenueTargets.year, year)] : []),
      ),
    )
    .orderBy(revenueTargets.year, revenueTargets.month);

  return rows.map(({ createdByName, updatedByName, ...rest }) => ({
    ...rest,
    createdByName: createdByName ?? null,
    updatedByName: updatedByName ?? null,
  }));
};

export const createRevenueTarget = async (input: CreateRevenueTargetInput) => {
  const result = await db
    .insert(revenueTargets)
    .values({
      month: input.month,
      year: input.year,
      targetAmount: String(input.targetAmount),
      label: input.label,
      notes: input.notes,
      createdBy: input.createdBy,
    })
    .returning({ id: revenueTargets.id });

  if (!result[0]) throw new Error("Failed to create revenue target");
  return getRevenueTargetById(result[0].id);
};

export const updateRevenueTarget = async (id: string, input: UpdateRevenueTargetInput) => {
  const existing = await getRevenueTargetById(id);
  if (!existing) return null;

  await db
    .update(revenueTargets)
    .set({
      ...(input.month !== undefined && { month: input.month }),
      ...(input.year !== undefined && { year: input.year }),
      ...(input.targetAmount !== undefined && { targetAmount: String(input.targetAmount) }),
      ...(input.label !== undefined && { label: input.label }),
      ...(input.notes !== undefined && { notes: input.notes }),
      updatedBy: input.updatedBy,
      updatedAt: new Date(),
    })
    .where(and(eq(revenueTargets.id, id), eq(revenueTargets.isDeleted, false)));

  return getRevenueTargetById(id);
};

export const deleteRevenueTarget = async (id: string, deletedBy?: string) => {
  const existing = await getRevenueTargetById(id);
  if (!existing) return null;

  await db
    .update(revenueTargets)
    .set({
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: deletedBy ?? null,
    })
    .where(eq(revenueTargets.id, id));

  return { id };
};
